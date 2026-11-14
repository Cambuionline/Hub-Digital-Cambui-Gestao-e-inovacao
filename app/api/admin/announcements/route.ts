import {validatePublicationDates,type PublicationKind} from '@/lib/publication-dates';
import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {requireSuperadmin} from '@/lib/admin-guard';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
const kinds=['event','course','opportunity'];
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(id);
const clean=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
export async function GET(req:NextRequest){
 try{
 const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso restrito'},{status:403});
 const snap=await adminDb().collection('hub_announcements').limit(200).get();
 const items=snap.docs.map(d=>({id:d.id,kind:d.get('kind')??'event',title:d.get('title')??'',description:d.get('description')??'',href:d.get('href')??'/',status:d.get('status')??'draft',startDate:d.get('startDate')??null,endDate:d.get('endDate')??null,deadline:d.get('deadline')??null,capacity:d.get('capacity')??null,registeredCount:d.get('registeredCount')??0,waitlistCount:d.get('waitlistCount')??0,createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()??null,updatedAt:d.get('updatedAt')?.toDate?.()?.toISOString?.()??null})).sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??''));
 return NextResponse.json({items},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Não foi possível carregar publicações'},{status:503})}
}
export async function PATCH(req:NextRequest){
 try{
 const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso restrito'},{status:403});
 const body=await req.json() as Record<string,unknown>;
 if(!validId(body.id)||!kinds.includes(String(body.kind)))return NextResponse.json({error:'Identificador ou categoria inválida'},{status:400});
 const title=clean(body.title,120),description=clean(body.description,500),href=clean(body.href,400);
 if(title.length<5||description.length<10||!href.startsWith('/')||href.startsWith('//')||/[\\\r\n]/.test(href))return NextResponse.json({error:'Título, descrição ou link inválidos'},{status:400});
 const validation=validatePublicationDates(body.kind as PublicationKind,body);if(!validation.dates)return NextResponse.json({error:validation.error},{status:400});
 const ref=adminDb().collection('hub_announcements').doc(body.id);
 const old=await ref.get();if(!old.exists||old.get('status')==='deleted')return NextResponse.json({error:'Publicação não encontrada'},{status:404});
 await ref.update({kind:body.kind,title,description,href,...validation.dates,updatedBy:admin.uid,updatedAt:FieldValue.serverTimestamp()});
 return NextResponse.json({ok:true,id:ref.id},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Não foi possível editar publicação'},{status:503})}
}
export async function DELETE(req:NextRequest){
 try{
 const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso restrito'},{status:403});
 const body=await req.json() as {id?:unknown};
 if(!validId(body.id))return NextResponse.json({error:'Identificador inválido'},{status:400});
 const ref=adminDb().collection('hub_announcements').doc(body.id);
 const old=await ref.get();if(!old.exists||old.get('status')==='deleted')return NextResponse.json({error:'Publicação não encontrada'},{status:404});
 await ref.update({status:'deleted',deletedBy:admin.uid,deletedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Não foi possível excluir publicação'},{status:503})}
}
