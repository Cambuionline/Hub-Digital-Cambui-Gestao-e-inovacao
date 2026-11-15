import {NextRequest,NextResponse} from 'next/server';
import {FieldValue,Timestamp} from 'firebase-admin/firestore';
import {adminDb} from '@/lib/firestore-admin';
import {requireSuperadmin} from '@/lib/admin-guard';
import {requireMember} from '@/lib/member-guard';
export const runtime='nodejs';
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function authorize(req:NextRequest,room:string,id:string){
 const manager=await requireSuperadmin(req).catch(()=>null);
 const member=manager??await requireMember(req).catch(()=>null);
 if(!member)return {error:'Autenticação necessária',status:401} as const;
 const db=adminDb(),session=await db.collection('hub_live_sessions').doc(id).get();
 if(!session.exists||session.get('room')!==room||session.get('status')!=='scheduled')return {error:'Atividade indisponível',status:404} as const;
 const now=Date.now(),start=Date.parse(String(session.get('start'))),end=Date.parse(String(session.get('end')));
 if(!Number.isFinite(start)||!Number.isFinite(end)||now<start-15*60000||now>=end)return {error:'Chat disponível somente durante a janela da atividade',status:403} as const;
 if(!manager){
  const announcementId=session.get('announcementId') as string|undefined;
  const reg=announcementId?await db.collection('hub_enrollments').doc(announcementId+'_'+member.uid).get():await db.collection('hub_live_registrations').doc(id+'_'+member.uid).get();
  if(!reg.exists||reg.get('status')!=='registered')return {error:'Inscrição necessária',status:403} as const;
 }
 return {member,manager:!!manager,db,session} as const;
}
function params(req:NextRequest){const room=req.nextUrl.searchParams.get('room')??'',id=req.nextUrl.searchParams.get('id')??'';return {room,id,valid:/^sala-[1-4]$/.test(room)&&/^[A-Za-z0-9_-]{1,150}$/.test(id)}}
export async function GET(req:NextRequest){
 try{
  const {room,id,valid}=params(req);if(!valid)return reply({error:'Sala inválida'},400);
  const auth=await authorize(req,room,id);if('error'in auth)return reply({error:auth.error},auth.status);
  const snap=await auth.db.collection('hub_live_sessions').doc(id).collection('chat').orderBy('createdAt','desc').limit(60).get();
  return reply({messages:snap.docs.map(d=>({id:d.id,text:d.get('hidden')?'Mensagem removida pela moderação':String(d.get('text')??''),author:d.get('authorRole')==='manager'?'Gestor':String(d.get('authorName')??'Participante'),manager:d.get('authorRole')==='manager',hidden:!!d.get('hidden'),createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()??null})).reverse(),canModerate:auth.manager,chatLocked:!!auth.session.get('chatLocked')});
 }catch(e){console.error('live chat GET',e);return reply({error:'Falha ao consultar chat'},503)}
}
export async function POST(req:NextRequest){
 try{
  const {room,id,valid}=params(req);if(!valid)return reply({error:'Sala inválida'},400);
  const auth=await authorize(req,room,id);if('error'in auth)return reply({error:auth.error},auth.status);
  if(!auth.manager&&auth.session.get('chatLocked'))return reply({error:'O gestor pausou temporariamente o chat'},423);
  const body=await req.json() as {text?:unknown};const text=typeof body.text==='string'?body.text.trim():'';
  if(text.length<1||text.length>500)return reply({error:'Mensagem deve conter entre 1 e 500 caracteres'},400);
  const sessionRef=auth.db.collection('hub_live_sessions').doc(id),rateRef=sessionRef.collection('chat_rate').doc(auth.member.uid),messageRef=sessionRef.collection('chat').doc();
  await auth.db.runTransaction(async tx=>{
   const sessionState=await tx.get(sessionRef);if(!auth.manager&&sessionState.get('chatLocked'))throw Error('CHAT_LOCKED');
   const rate=await tx.get(rateRef);const last=rate.get('lastSentAt') as Timestamp|undefined;
   if(last&&Date.now()-last.toMillis()<3000)throw Error('RATE_LIMIT');
   tx.set(rateRef,{lastSentAt:Timestamp.now()});
   tx.create(messageRef,{text,uid:auth.member.uid,authorName:auth.manager?'Gestor':auth.member.email?.split('@')[0]??'Participante',authorRole:auth.manager?'manager':'member',hidden:false,createdAt:FieldValue.serverTimestamp()});
  });
  return reply({ok:true},201);
 }catch(e){if(e instanceof Error&&e.message==='CHAT_LOCKED')return reply({error:'O gestor pausou temporariamente o chat'},423);if(e instanceof Error&&e.message==='RATE_LIMIT')return reply({error:'Aguarde 3 segundos antes de enviar outra mensagem'},429);console.error('live chat POST',e);return reply({error:'Não foi possível enviar a mensagem'},503)}
}
export async function DELETE(req:NextRequest){
 try{
  const {room,id,valid}=params(req);if(!valid)return reply({error:'Sala inválida'},400);
  const auth=await authorize(req,room,id);if('error'in auth)return reply({error:auth.error},auth.status);
  if(!auth.manager)return reply({error:'Moderação exclusiva do gestor'},403);
  const body=await req.json() as {messageId?:string};
  if(!/^[A-Za-z0-9_-]{1,150}$/.test(body.messageId??''))return reply({error:'Mensagem inválida'},400);
  const ref=auth.db.collection('hub_live_sessions').doc(id).collection('chat').doc(body.messageId!);
  const snap=await ref.get();if(!snap.exists)return reply({error:'Mensagem não encontrada'},404);
  await ref.update({hidden:true,text:'',moderatedAt:FieldValue.serverTimestamp(),moderatedBy:auth.member.uid});
  return reply({ok:true});
 }catch(e){console.error('live chat DELETE',e);return reply({error:'Falha ao moderar mensagem'},503)}
}

export async function PATCH(req:NextRequest){
 try{
  const {room,id,valid}=params(req);if(!valid)return reply({error:'Sala inválida'},400);
  const auth=await authorize(req,room,id);if('error'in auth)return reply({error:auth.error},auth.status);
  if(!auth.manager)return reply({error:'Ação exclusiva do gestor'},403);
  const body=await req.json() as {locked?:unknown};
  if(typeof body.locked!=='boolean')return reply({error:'Estado inválido'},400);
  await auth.session.ref.update({chatLocked:body.locked,chatLockedBy:auth.member.uid,chatLockedAt:FieldValue.serverTimestamp()});
  return reply({ok:true,chatLocked:body.locked});
 }catch(e){console.error('live chat PATCH',e);return reply({error:'Falha ao atualizar estado do chat'},503)}
}
