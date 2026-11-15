import {NextRequest,NextResponse} from 'next/server';
import {requireSuperadmin} from '@/lib/admin-guard';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
const respond=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 try{
  if(!await requireSuperadmin(req))return respond({error:'Acesso restrito'},403);
  const room=req.nextUrl.searchParams.get('room')??'',id=req.nextUrl.searchParams.get('id')??'';
  if(!/^sala-[1-4]$/.test(room)||!/^[A-Za-z0-9_-]{1,150}$/.test(id))return respond({error:'Identificador inválido'},400);
  const db=adminDb(),doc=await db.collection('hub_live_sessions').doc(id).get();
  if(!doc.exists||doc.get('room')!==room)return respond({error:'Atividade não encontrada'},404);
  const members=db.collection('hub_live_presence').doc(id).collection('members');
  const [count,records]=await Promise.all([members.count().get(),members.orderBy('lastJoinedAt','desc').limit(100).get()]);
  return respond({session:{id,title:doc.get('title')??'',room,start:doc.get('start')??null,end:doc.get('end')??null,status:doc.get('status')??'scheduled'},uniqueParticipants:count.data().count,entries:records.docs.map(d=>({uid:d.id,joinCount:d.get('joinCount')??0,lastJoinedAt:d.get('lastJoinedAt')?.toDate?.()?.toISOString?.()??null})),limited:count.data().count>100});
 }catch{return respond({error:'Não foi possível consultar a presença'},503)}
}
