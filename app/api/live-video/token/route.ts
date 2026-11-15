import {NextRequest,NextResponse} from 'next/server';
import {AccessToken} from 'livekit-server-sdk';
import {adminDb} from '@/lib/firestore-admin';
import {requireMember} from '@/lib/member-guard';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 try{
  const body=await req.json() as {room?:string;id?:string};
  if(!/^sala-[1-4]$/.test(body.room??'')||!/^[A-Za-z0-9_-]{1,150}$/.test(body.id??''))return reply({error:'Sala ou atividade inválida'},400);
  const manager=await requireSuperadmin(req).catch(()=>null);
  const member=manager??await requireMember(req).catch(()=>null);
  if(!member)return reply({error:'Autenticação necessária'},401);
  const db=adminDb(),session=await db.collection('hub_live_sessions').doc(body.id!).get();
  if(!session.exists||session.get('room')!==body.room||session.get('status')!=='scheduled')return reply({error:'Atividade indisponível'},404);
  const now=Date.now(),start=Date.parse(String(session.get('start'))),end=Date.parse(String(session.get('end')));
  if(!Number.isFinite(start)||!Number.isFinite(end)||now<start-15*60000||now>=end)return reply({error:'A sala abre 15 minutos antes do início e encerra no horário agendado'},403);
  if(!manager){
   const announcementId=session.get('announcementId') as string|undefined;
   const enrollment=announcementId?await db.collection('hub_enrollments').doc(announcementId+'_'+member.uid).get():await db.collection('hub_live_registrations').doc(session.id+'_'+member.uid).get();
   if(!enrollment.exists||enrollment.get('status')!=='registered')return reply({error:'Inscrição confirmada necessária para participar'},403);
  }
  const host=process.env.LIVEKIT_URL??'',key=process.env.LIVEKIT_API_KEY??'',secret=process.env.LIVEKIT_API_SECRET??'';
  if(!/^wss:\/\/[^\s]+$/.test(host)||!key||!secret)return reply({error:'Vídeo nativo aguardando configuração do provedor LiveKit'},503);
  const roomName='hub-'+body.room+'-'+session.id;
  const token=new AccessToken(key,secret,{identity:member.uid,name:manager?'Gestor':member.email??'Participante',ttl:'30m'});
  token.addGrant({roomJoin:true,room:roomName,canPublish:!!manager,canPublishData:!!manager,canSubscribe:true});
  return reply({serverUrl:host,token:await token.toJwt(),roomName,role:manager?'presenter':'viewer',title:String(session.get('title')??'Atividade')});
 }catch(e){console.error('video token issue',e);return reply({error:'Não foi possível autorizar a transmissão'},503)}
}
