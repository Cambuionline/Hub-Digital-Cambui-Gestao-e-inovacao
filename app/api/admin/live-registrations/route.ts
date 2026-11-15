import {NextRequest,NextResponse} from 'next/server';
import {requireSuperadmin} from '@/lib/admin-guard';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
const respond=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 try{
  if(!await requireSuperadmin(req))return respond({error:'Acesso restrito'},403);
  const id=req.nextUrl.searchParams.get('id')??'',room=req.nextUrl.searchParams.get('room')??'';
  if(!/^[A-Za-z0-9_-]{1,150}$/.test(id)||!/^sala-[1-4]$/.test(room))return respond({error:'Identificador inválido'},400);
  const db=adminDb(),doc=await db.collection('hub_live_sessions').doc(id).get();
  if(!doc.exists||doc.get('room')!==room)return respond({error:'Atividade não encontrada'},404);
  const registrations=await db.collection('hub_live_registrations').where('sessionId','==',id).limit(500).get();
  const active=registrations.docs.filter(d=>d.get('status')==='registered');
  return respond({title:doc.get('title')??'',capacity:doc.get('capacity')??null,registeredCount:doc.get('registeredCount')??0,participants:active.map(d=>({uid:d.get('uid'),status:d.get('status')})),limited:registrations.size===500});
 }catch{return respond({error:'Não foi possível consultar inscrições'},503)}
}
