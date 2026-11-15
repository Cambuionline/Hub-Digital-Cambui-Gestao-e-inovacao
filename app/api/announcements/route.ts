import {validatePublicationDates,type PublicationKind} from '@/lib/publication-dates';
import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from '@/lib/firestore-admin';
import {requireMember} from '@/lib/member-guard';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
const kinds=['event','course','opportunity','workshop','mentoring','incubation','acceleration','meeting','consulting'] as const;
type Kind=typeof kinds[number];
function clean(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):''}
export async function GET(req:NextRequest){
 try{
 const member=await requireMember(req);
 if(!member)return NextResponse.json({error:'Autenticação necessária'},{status:401});
 const snap=await adminDb().collection('hub_announcements').where('status','==','published').limit(100).get();
 const items=snap.docs.map(d=>({id:d.id,kind:d.get('kind') as Kind,title:d.get('title')??'',description:d.get('description')??'',href:d.get('href')??'',room:d.get('room')??null,startAt:d.get('startAt')??null,endAt:d.get('endAt')??null,startDate:d.get('startDate')??null,endDate:d.get('endDate')??null,deadline:d.get('deadline')??null,capacity:d.get('capacity')??null,registeredCount:d.get('registeredCount')??0,waitlistCount:d.get('waitlistCount')??0,createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()??null})).sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??''));
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
 const capacity=body.capacity===null||body.capacity===undefined||body.capacity===''?null:Number(body.capacity);if(capacity!==null&&(!Number.isSafeInteger(capacity)||capacity<1||capacity>100000))return NextResponse.json({error:'Capacidade deve ser um número inteiro entre 1 e 100000'},{status:400});
 const validation=validatePublicationDates(kind as PublicationKind,body);if(!validation.dates)return NextResponse.json({error:validation.error},{status:400});
 const db=adminDb(),ref=db.collection('hub_announcements').doc();
 const room=typeof body.room==='string'?body.room:'',startAt=typeof body.startAt==='string'?body.startAt:'',endAt=typeof body.endAt==='string'?body.endAt:'';
 const wantsRoom=kind!=='opportunity'&&room!=='';
 if(wantsRoom){
  const begin=Date.parse(startAt),finish=Date.parse(endAt);
  if(!/^sala-[1-4]$/.test(room)||!Number.isFinite(begin)||!Number.isFinite(finish)||begin<Date.now()+60000||finish<=begin||finish-begin>8*3600000||new Date(begin).toISOString().slice(0,10)!==validation.dates.startDate||new Date(finish).toISOString().slice(0,10)!==validation.dates.endDate)return NextResponse.json({error:'Sala ou horário inválido. Informe início futuro e término em até 8 horas.'},{status:400});
  const roomRef=db.collection('hub_live_rooms').doc(room),sessionRef=db.collection('hub_live_sessions').doc();
  try{await db.runTransaction(async tx=>{
   const snap=await tx.get(roomRef);
   const sessions=(snap.get('sessions')??[]) as {id:string;start:string;end:string;status:string}[];
   const active=sessions.filter(x=>x.status==='scheduled'&&Date.parse(x.end)>Date.now());
   if(active.some(x=>begin<Date.parse(x.end)&&finish>Date.parse(x.start)))throw Error('ROOM_BUSY');
   if(active.length>=300)throw Error('ROOM_LIMIT');
   const slot={id:sessionRef.id,title,kind,start:new Date(begin).toISOString(),end:new Date(finish).toISOString(),status:'scheduled',capacity,url:null,announcementId:ref.id};
   tx.set(roomRef,{sessions:[...active,slot],updatedAt:FieldValue.serverTimestamp(),updatedBy:admin.uid},{merge:true});
   tx.set(sessionRef,{...slot,room,registeredCount:0,createdBy:admin.uid,createdAt:FieldValue.serverTimestamp()});
   tx.set(ref,{kind,title,description,href,...validation.dates,room,sessionId:sessionRef.id,startAt:slot.start,endAt:slot.end,capacity,registeredCount:0,waitlistCount:0,status:'published',createdBy:admin.uid,createdAt:FieldValue.serverTimestamp()});
  })}catch(e){if(e instanceof Error&&e.message==='ROOM_BUSY')return NextResponse.json({error:'Sala ocupada neste horário. Selecione outra sala ou período.'},{status:409});if(e instanceof Error&&e.message==='ROOM_LIMIT')return NextResponse.json({error:'Limite de reservas da sala atingido'},{status:409});throw e}
 }else{
  await ref.set({kind,title,description,href,...validation.dates,capacity:kind==='opportunity'?null:capacity,registeredCount:0,waitlistCount:0,status:'published',createdBy:admin.uid,createdAt:FieldValue.serverTimestamp()});
 }
 const saved=await ref.get();if(!saved.exists||saved.get('status')!=='published')return NextResponse.json({error:'Registro não confirmado no Firestore. Consulte a relação antes de tentar novamente.',id:ref.id},{status:503});
 return NextResponse.json({id:ref.id,ok:true,confirmed:true,title:saved.get('title'),status:saved.get('status')},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('announcement create failed',e);return NextResponse.json({error:'Falha ao gravar ou confirmar publicação no Firestore. Verifique a conexão do servidor e tente novamente.'},{status:503})}
}
