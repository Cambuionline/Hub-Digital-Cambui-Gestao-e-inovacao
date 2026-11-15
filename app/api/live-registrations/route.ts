import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {requireMember} from '@/lib/member-guard';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
const respond=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 try{
  const member=await requireMember(req);if(!member)return respond({error:'Acesso restrito'},403);
  const db=adminDb();
  const [snap,enrollments]=await Promise.all([db.collection('hub_live_registrations').where('uid','==',member.uid).limit(200).get(),db.collection('hub_enrollments').where('userUid','==',member.uid).limit(200).get()]);
  const registered=enrollments.docs.filter(d=>d.get('status')==='registered');
  const announcements=await Promise.all(registered.map(d=>db.collection('hub_announcements').doc(String(d.get('announcementId'))).get()));
  const linked=announcements.filter(d=>d.exists&&d.get('status')==='published'&&d.get('sessionId')).map(d=>({id:d.get('sessionId'),room:d.get('room'),status:'registered'}));
  return respond({registrations:[...snap.docs.map(d=>({id:d.get('sessionId'),room:d.get('room'),status:d.get('status')})),...linked]});
 }catch{return respond({error:'Não foi possível consultar inscrições'},503)}
}
export async function POST(req:NextRequest){
 try{
  const member=await requireMember(req);if(!member)return respond({error:'Acesso restrito'},403);
  const body=await req.json() as {id?:string;room?:string};
  if(!body.id||!/^[A-Za-z0-9_-]{1,150}$/.test(body.id)||!/^sala-[1-4]$/.test(body.room??''))return respond({error:'Atividade inválida'},400);
  const db=adminDb(),session=db.collection('hub_live_sessions').doc(body.id),registration=db.collection('hub_live_registrations').doc(body.id+'_'+member.uid);
  const result=await db.runTransaction(async tx=>{
   const [doc,existing]=await Promise.all([tx.get(session),tx.get(registration)]);
   if(!doc.exists||doc.get('room')!==body.room||doc.get('status')!=='scheduled'||Date.parse(doc.get('end')??'')<=Date.now())throw Error('UNAVAILABLE');
   if(doc.get('announcementId'))throw Error('AGENDA');
   if(existing.exists&&existing.get('status')==='registered')return 'already';
   const capacity=doc.get('capacity');const count=Number(doc.get('registeredCount')??0);
   if(typeof capacity==='number'&&capacity>0&&count>=capacity)throw Error('FULL');
   tx.set(registration,{uid:member.uid,sessionId:body.id,room:body.room,status:'registered',updatedAt:FieldValue.serverTimestamp(),createdAt:existing.exists?existing.get('createdAt'):FieldValue.serverTimestamp()});
   tx.update(session,{registeredCount:FieldValue.increment(1)});
   return 'registered';
  });
  return respond({ok:true,status:result});
 }catch(e){if(e instanceof Error&&e.message==='UNAVAILABLE')return respond({error:'Atividade não disponível'},404);if(e instanceof Error&&e.message==='AGENDA')return respond({error:'Esta atividade utiliza inscrições pela Agenda do HUB.'},409);if(e instanceof Error&&e.message==='FULL')return respond({error:'Vagas esgotadas'},409);return respond({error:'Não foi possível concluir inscrição'},503)}
}
export async function DELETE(req:NextRequest){
 try{
  const member=await requireMember(req);if(!member)return respond({error:'Acesso restrito'},403);
  const body=await req.json() as {id?:string};
  if(!body.id||!/^[A-Za-z0-9_-]{1,150}$/.test(body.id))return respond({error:'Atividade inválida'},400);
  const db=adminDb(),session=db.collection('hub_live_sessions').doc(body.id),registration=db.collection('hub_live_registrations').doc(body.id+'_'+member.uid);
  await db.runTransaction(async tx=>{
   const [doc,existing]=await Promise.all([tx.get(session),tx.get(registration)]);
   if(!existing.exists||existing.get('status')!=='registered')throw Error('NOT_FOUND');
   if(!doc.exists)throw Error('NOT_FOUND');
   if(doc.get('announcementId'))throw Error('AGENDA');
   tx.update(registration,{status:'cancelled',updatedAt:FieldValue.serverTimestamp()});
   tx.update(session,{registeredCount:FieldValue.increment(-1)});
  });
  return respond({ok:true});
 }catch(e){return respond({error:e instanceof Error&&e.message==='AGENDA'?'Cancele esta inscrição pela Agenda do HUB.':e instanceof Error&&e.message==='NOT_FOUND'?'Inscrição não encontrada':'Não foi possível cancelar inscrição'},e instanceof Error&&e.message==='AGENDA'?409:e instanceof Error&&e.message==='NOT_FOUND'?404:503)}
}
