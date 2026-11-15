import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/firestore-admin';
import {requireMember} from '@/lib/member-guard';
import {requireSuperadmin} from '@/lib/admin-guard';
import {FieldValue} from 'firebase-admin/firestore';
export const runtime='nodejs';
const ids=['sala-1','sala-2','sala-3','sala-4'];
type Slot={id:string;start:string;end:string;title:string;kind:string;url:string;status:string};
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 try{
  const member=await requireMember(req);if(!member)return reply({error:'Acesso restrito'},403);
  const now=Date.now();
  const docs=await Promise.all(ids.map(id=>adminDb().collection('hub_live_rooms').doc(id).get()));
  return reply({rooms:docs.map((doc,index)=>({id:ids[index],name:'Sala '+(index+1),sessions:((doc.get('sessions')??[]) as Slot[]).filter(s=>s.status==='scheduled'&&Date.parse(s.end)>now).map(s=>({id:s.id,title:s.title,kind:s.kind,start:s.start,end:s.end,announcementId:(s as Slot & {announcementId?:string}).announcementId??null,joinable:Date.parse(s.start)-15*60000<=now&&now<Date.parse(s.end)})).sort((a,b)=>a.start.localeCompare(b.start))}))});
 }catch{return reply({error:'Não foi possível consultar a programação'},503)}
}
export async function POST(req:NextRequest){
 try{
  const member=await requireMember(req);if(!member)return reply({error:'Acesso restrito'},403);
  const body=await req.json() as {room?:string;id?:string};
  if(!ids.includes(body.room??'')||!body.id||!/^[A-Za-z0-9_-]{1,150}$/.test(body.id))return reply({error:'Atividade inválida'},400);
  const db=adminDb(),snap=await db.collection('hub_live_rooms').doc(body.room!).get();
  const slot=((snap.get('sessions')??[]) as Slot[]).find(s=>s.id===body.id&&s.status==='scheduled');
  if(!slot)return reply({error:'Atividade indisponível'},404);
  if(typeof slot.url!=='string'||!slot.url.startsWith('https://'))return reply({error:'O gestor ainda não configurou o link da transmissão'},409);
  const session=await db.collection('hub_live_sessions').doc(body.id).get();
  const announcementId=session.get('announcementId') as string|undefined;
  if(announcementId){
   const enrollment=await db.collection('hub_enrollments').doc(announcementId+'_'+member.uid).get();
   if(!enrollment.exists||enrollment.get('status')!=='registered')return reply({error:'Inscrição confirmada na agenda necessária para acessar esta atividade'},403);
  }else{
   const enrollment=await db.collection('hub_live_registrations').doc(body.id+'_'+member.uid).get();
   if(!enrollment.exists||enrollment.get('status')!=='registered')return reply({error:'Inscrição necessária para acessar esta atividade'},403);
  }
  const now=Date.now();if(now<Date.parse(slot.start)-15*60000||now>=Date.parse(slot.end))return reply({error:'A sala abre 15 minutos antes do início e fecha ao final da atividade'},403);
  // The link is only disclosed to authenticated members during the allowed time window.
  const presence=db.collection('hub_live_presence').doc(body.id!).collection('members').doc(member.uid);
  await presence.set({uid:member.uid,room:body.room,sessionId:body.id,lastJoinedAt:FieldValue.serverTimestamp(),joinCount:FieldValue.increment(1)},{merge:true});
  return reply({url:slot.url,title:slot.title});
 }catch{return reply({error:'Não foi possível acessar a sala'},503)}
}
