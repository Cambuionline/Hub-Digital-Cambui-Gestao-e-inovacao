import {NextRequest,NextResponse} from 'next/server';
import {WebhookReceiver} from 'livekit-server-sdk';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
const json=(value:object,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 const key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET;
 if(!key||!secret)return json({error:'Webhook não configurado'},503);
 const signature=req.headers.get('authorization');
 if(!signature)return json({error:'Assinatura ausente'},401);
 let event;
 try{event=await new WebhookReceiver(key,secret).receive(await req.text(),signature)}
 catch(e){console.warn('Invalid LiveKit webhook signature',e);return json({error:'Assinatura inválida'},401)}
 if(event.event!=='participant_joined'&&event.event!=='participant_left')return json({ok:true,ignored:true});
 const roomName=event.room?.name??'',participant=event.participant;
 const match=/^hub-(sala-[1-4])-([A-Za-z0-9_-]{1,150})$/.exec(roomName);
 if(!match||!participant?.identity)return json({ok:true,ignored:true});
 const [,room,id]=match;
 try{
  const db=adminDb(),sessionRef=db.collection('hub_live_sessions').doc(id),session=await sessionRef.get();
  if(!session.exists||session.get('room')!==room)return json({ok:true,ignored:true});
  const identity=participant.identity;
  // Server-signed LiveKit events, never unauthenticated browser presence, are authoritative.
  const attendanceRef=sessionRef.collection('verified_attendance').doc(identity);
  const eventId=event.id;
  if(!eventId)return json({error:'Evento sem identificador'},400);
  const eventRef=sessionRef.collection('livekit_webhook_events').doc(eventId);
  await db.runTransaction(async tx=>{
   const [seen,attendance]=await Promise.all([tx.get(eventRef),tx.get(attendanceRef)]);
   if(seen.exists)return;
   const joined=event.event==='participant_joined';
   const eventTime=Number(event.createdAt)*1000;
   if(!Number.isFinite(eventTime)||eventTime<=0)throw Error('INVALID_EVENT_TIME');
   const previousEventTime=Number(attendance.get('lastEventTimeMs')??0);
   if(eventTime<previousEventTime){tx.create(eventRef,{type:event.event,receivedAt:FieldValue.serverTimestamp(),uid:identity,ignored:'out-of-order'});return}
   const now=eventTime,previousJoin=Number(attendance.get('lastJoinTimeMs')??0);
   const previousSeconds=Number(attendance.get('totalConnectedSeconds')??0);
   const active=!!attendance.get('active');
   const elapsed=active&&previousJoin&&now>=previousJoin?Math.floor((now-previousJoin)/1000):0;
   tx.create(eventRef,{type:event.event,receivedAt:FieldValue.serverTimestamp(),uid:identity,eventTimeMs:eventTime});
   if(joined)tx.set(attendanceRef,{uid:identity,room,role:participant.permission?.canPublish?'presenter':'viewer',firstJoinedAt:attendance.exists?attendance.get('firstJoinedAt'):FieldValue.serverTimestamp(),lastJoinedAt:FieldValue.serverTimestamp(),lastJoinTimeMs:eventTime,lastEventTimeMs:eventTime,lastLeftAt:null,active:true,totalConnectedSeconds:previousSeconds+(active?elapsed:0),joinCount:FieldValue.increment(1),source:'livekit-webhook'},{merge:true});
   else if(attendance.exists&&active)tx.update(attendanceRef,{lastLeftAt:FieldValue.serverTimestamp(),lastEventTimeMs:eventTime,active:false,totalConnectedSeconds:previousSeconds+elapsed});
   else if(attendance.exists)tx.update(attendanceRef,{lastEventTimeMs:eventTime});
  });
  return json({ok:true});
 }catch(e){console.error('LiveKit webhook persistence failure',e);return json({error:'Falha ao registrar evento'},503)}
}
