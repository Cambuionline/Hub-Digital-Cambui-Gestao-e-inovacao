import {NextRequest,NextResponse} from 'next/server';
import {FieldValue,Timestamp} from 'firebase-admin/firestore';
import {requireSuperadmin} from '@/lib/admin-guard';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
const rooms=['sala-1','sala-2','sala-3','sala-4'] as const;
type Slot={id:string;start:string;end:string;title:string;kind:string;url:string;capacity:number|null;status:'scheduled'|'cancelled'};
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const validUrl=(value:string)=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')}catch{return false}};
export async function GET(req:NextRequest){
 try{
  if(!await requireSuperadmin(req))return reply({error:'Acesso restrito'},403);
  const snap=await Promise.all(rooms.map(id=>adminDb().collection('hub_live_rooms').doc(id).get()));
  return reply({rooms:snap.map((d,i)=>({id:rooms[i],name:'Sala '+(i+1),sessions:((d.get('sessions')??[]) as Slot[]).filter(x=>x.status==='scheduled').sort((a,b)=>a.start.localeCompare(b.start))}))});
 }catch{return reply({error:'Não foi possível consultar as salas'},503)}
}
export async function POST(req:NextRequest){
 try{
  const admin=await requireSuperadmin(req);if(!admin)return reply({error:'Acesso restrito'},403);
  const body=await req.json() as Record<string,unknown>;
  const room=String(body.room??''),title=String(body.title??'').trim(),kind=String(body.kind??''),url=String(body.url??'').trim();
  const start=String(body.start??''),end=String(body.end??'');
  const capacity=body.capacity===null||body.capacity===undefined||body.capacity===''?null:Number(body.capacity);
  const startMs=Date.parse(start),endMs=Date.parse(end);
  if((capacity!==null&&(!Number.isInteger(capacity)||capacity<1||capacity>10000))||!rooms.some(x=>x===room)||title.length<5||title.length>120||!['live','meeting','workshop','training','incubation','acceleration'].includes(kind)||!validUrl(url)||!Number.isFinite(startMs)||!Number.isFinite(endMs)||!/^\d{4}-\d{2}-\d{2}T/.test(start)||!/^\d{4}-\d{2}-\d{2}T/.test(end)||startMs<Date.now()+60000||endMs<=startMs||endMs-startMs>8*3600000)return reply({error:'Verifique sala, título, link HTTPS e período (até 8 horas, início futuro)'},400);
  const db=adminDb(),ref=db.collection('hub_live_rooms').doc(room),id=db.collection('hub_live_sessions').doc().id;
  const slot:Slot={id,start:new Date(startMs).toISOString(),end:new Date(endMs).toISOString(),title,kind,url,capacity,status:'scheduled'};
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   const current=(snap.get('sessions')??[]) as Slot[];
   const active=current.filter(x=>x.status==='scheduled'&&Date.parse(x.end)>Date.now());
   if(active.some(x=>startMs<Date.parse(x.end)&&endMs>Date.parse(x.start)))throw new Error('CONFLICT');
   if(active.length>=300)throw new Error('LIMIT');
   tx.set(ref,{sessions:[...active,slot],updatedAt:FieldValue.serverTimestamp(),updatedBy:admin.uid},{merge:true});
   tx.set(db.collection('hub_live_sessions').doc(id),{...slot,room,createdBy:admin.uid,registeredCount:0,createdAt:Timestamp.now()});
  });
  return reply({ok:true,session:slot},201);
 }catch(e){if(e instanceof Error&&e.message==='CONFLICT')return reply({error:'A sala já possui uma atividade neste horário'},409);if(e instanceof Error&&e.message==='LIMIT')return reply({error:'Limite de agendamentos futuros atingido'},409);return reply({error:'Não foi possível agendar a atividade'},503)}
}
export async function DELETE(req:NextRequest){
 try{
  const admin=await requireSuperadmin(req);if(!admin)return reply({error:'Acesso restrito'},403);
  const body=await req.json() as {room?:string;id?:string};
  if(!rooms.some(x=>x===body.room)||!body.id||!/^[A-Za-z0-9_-]{1,150}$/.test(body.id))return reply({error:'Agendamento inválido'},400);
  const db=adminDb(),ref=db.collection('hub_live_rooms').doc(body.room!);
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),items=(snap.get('sessions')??[]) as Slot[];
   if(!items.some(x=>x.id===body.id&&x.status==='scheduled'))throw new Error('NOT_FOUND');
   tx.update(ref,{sessions:items.map(x=>x.id===body.id?{...x,status:'cancelled' as const}:x),updatedAt:FieldValue.serverTimestamp()});
   tx.update(db.collection('hub_live_sessions').doc(body.id!),{status:'cancelled',cancelledBy:admin.uid,cancelledAt:FieldValue.serverTimestamp()});
  });
  return reply({ok:true});
 }catch(e){return reply({error:e instanceof Error&&e.message==='NOT_FOUND'?'Agendamento não encontrado':'Não foi possível cancelar'},e instanceof Error&&e.message==='NOT_FOUND'?404:503)}
}
