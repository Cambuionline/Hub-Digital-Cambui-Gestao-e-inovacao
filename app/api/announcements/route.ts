import {validatePublicationDates,type PublicationKind} from '@/lib/publication-dates';
import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from '@/lib/firestore-admin';
import {requireMember} from '@/lib/member-guard';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
const kinds=['event','course','opportunity'] as const;
type Kind=typeof kinds[number];
function clean(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):''}
export async function GET(req:NextRequest){
 try{
 const member=await requireMember(req);
 if(!member)return NextResponse.json({error:'Autenticação necessária'},{status:401});
 const snap=await adminDb().collection('hub_announcements').where('status','==','published').limit(100).get();
 const items=snap.docs.map(d=>({id:d.id,kind:d.get('kind') as Kind,title:d.get('title')??'',description:d.get('description')??'',href:d.get('href')??'',startDate:d.get('startDate')??null,endDate:d.get('endDate')??null,deadline:d.get('deadline')??null,createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()??null})).sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??''));
 return NextResponse.json({items},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Falha ao consultar publicações'},{status:503})}
}
export async function POST(req:NextRequest){
 try{
 const admin=await requireSuperadmin(req);
 if(!admin)return NextResponse.json({error:'Acesso administrativo necessário'},{status:403});
 const body=await req.json() as Record<string,unknown>;
 const kind=body.kind;
 const title=clean(body.title,120),description=clean(body.description,500),href=clean(body.href,400);
 if(!kinds.includes(kind as Kind)||title.length<5||description.length<10||!href.startsWith('/')||href.startsWith('//')||/[\\\r\n]/.test(href))return NextResponse.json({error:'Dados inválidos; informe tipo, título, descrição e rota interna'},{status:400});
 const validation=validatePublicationDates(kind as PublicationKind,body);if(!validation.dates)return NextResponse.json({error:validation.error},{status:400});
 const ref=await adminDb().collection('hub_announcements').add({kind,title,description,href,...validation.dates,status:'published',createdBy:admin.uid,createdAt:FieldValue.serverTimestamp()});
 const saved=await ref.get();if(!saved.exists||saved.get('status')!=='published')return NextResponse.json({error:'Registro não confirmado no Firestore. Consulte a relação antes de tentar novamente.',id:ref.id},{status:503});
 return NextResponse.json({id:ref.id,ok:true,confirmed:true,title:saved.get('title'),status:saved.get('status')},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('announcement create failed',e);return NextResponse.json({error:'Falha ao gravar ou confirmar publicação no Firestore. Verifique a conexão do servidor e tente novamente.'},{status:503})}
}
