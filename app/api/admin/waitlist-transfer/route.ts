import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from '@/lib/firestore-admin';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
const valid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(v);
export async function POST(req:NextRequest){
 try{
  const admin=await requireSuperadmin(req);
  if(!admin)return NextResponse.json({error:'Acesso administrativo necessário'},{status:403});
  const raw=await req.text();if(raw.length>600)return NextResponse.json({error:'Solicitação muito grande'},{status:413});
  let body:Record<string,unknown>;try{body=JSON.parse(raw)}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
  if(!valid(body.sourceAnnouncementId)||!valid(body.targetAnnouncementId)||!valid(body.userUid)||body.sourceAnnouncementId===body.targetAnnouncementId)return NextResponse.json({error:'Origem, nova turma ou participante inválido'},{status:400});
  const db=adminDb(),source=db.collection('hub_announcements').doc(body.sourceAnnouncementId),target=db.collection('hub_announcements').doc(body.targetAnnouncementId);
  const oldRef=db.collection('hub_enrollments').doc(body.sourceAnnouncementId+'_'+body.userUid),newRef=db.collection('hub_enrollments').doc(body.targetAnnouncementId+'_'+body.userUid);
  const result=await db.runTransaction(async tx=>{
   const [a,b,old,existing]=await Promise.all([tx.get(source),tx.get(target),tx.get(oldRef),tx.get(newRef)]);
   if(!a.exists||!b.exists||a.get('status')!=='published'||b.get('status')!=='published'||!['event','course'].includes(a.get('kind'))||a.get('kind')!==b.get('kind'))return 'INVALID_ACTIVITY';
   if(!old.exists||old.get('status')!=='waitlisted'||old.get('userUid')!==body.userUid)return 'NOT_WAITLISTED';
   if(existing.exists&&['registered','waitlisted'].includes(existing.get('status')))return 'ALREADY_ENROLLED';
   const now=new Date(),today=[now.getUTCFullYear(),String(now.getUTCMonth()+1).padStart(2,'0'),String(now.getUTCDate()).padStart(2,'0')].join('-');
   if(typeof b.get('endDate')==='string'&&b.get('endDate')<today)return 'EXPIRED';
   const capacity=b.get('capacity'),count=Number(b.get('registeredCount')??0);
   if(typeof capacity==='number'&&capacity>0&&count>=capacity)return 'FULL';
   tx.set(newRef,{announcementId:body.targetAnnouncementId,userUid:body.userUid,userEmail:old.get('userEmail')??'',status:'registered',attendance:'pending',registeredAt:FieldValue.serverTimestamp(),transferredFrom:body.sourceAnnouncementId,transferredBy:admin.uid},{merge:true});
   tx.update(oldRef,{status:'transferred',transferredTo:body.targetAnnouncementId,transferredAt:FieldValue.serverTimestamp(),transferredBy:admin.uid});
   tx.update(source,{waitlistCount:Math.max(0,Number(a.get('waitlistCount')??0)-1)});
   tx.update(target,{registeredCount:count+1});
   return 'OK';
  });
  if(result!=='OK')return NextResponse.json({error:({INVALID_ACTIVITY:'Selecione uma nova turma publicada da mesma categoria',NOT_WAITLISTED:'Participante não está na lista de espera',ALREADY_ENROLLED:'Participante já está inscrito na nova turma',EXPIRED:'A nova turma já terminou',FULL:'A nova turma está lotada'} as Record<string,string>)[result]??'Transferência indisponível'},{status:409});
  return NextResponse.json({ok:true,status:'transferred',targetAnnouncementId:body.targetAnnouncementId},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('waitlist transfer failed',e);return NextResponse.json({error:'Não foi possível transferir o participante'},{status:503})}
}
