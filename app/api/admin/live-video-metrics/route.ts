import {NextRequest,NextResponse} from 'next/server';
import {requireSuperadmin} from '@/lib/admin-guard';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso restrito'},{status:403});
  const room=req.nextUrl.searchParams.get('room')??'',id=req.nextUrl.searchParams.get('id')??'';
  if(!/^sala-[1-4]$/.test(room)||!/^[A-Za-z0-9_-]{1,150}$/.test(id))return NextResponse.json({error:'Atividade inválida'},{status:400});
  const db=adminDb(),session=await db.collection('hub_live_sessions').doc(id).get();
  if(!session.exists||session.get('room')!==room)return NextResponse.json({error:'Atividade não encontrada'},{status:404});
  const chat=session.ref.collection('chat'),blocked=session.ref.collection('chat_blocked');
  const [total,hidden,pinned,restricted,latest]=await Promise.all([
   chat.count().get(),
   chat.where('hidden','==',true).count().get(),
   chat.where('pinned','==',true).count().get(),
   blocked.count().get(),
   chat.orderBy('createdAt','desc').limit(100).get()
  ]);
  const authors=new Set(latest.docs.filter(d=>!d.get('hidden')).map(d=>String(d.get('uid')??'')).filter(Boolean));
  return NextResponse.json({
   session:{id,room,title:String(session.get('title')??''),start:String(session.get('start')??''),end:String(session.get('end')??''),chatLocked:!!session.get('chatLocked')},
   metrics:{messagesTotal:total.data().count,messagesHidden:hidden.data().count,messagesPinned:pinned.data().count,usersRestricted:restricted.data().count,uniqueAuthorsInLast100:authors.size},
   note:'Autores únicos calculados somente nas 100 mensagens mais recentes. Este painel não representa audiência conectada ao vídeo.'
  },{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('live metrics',e);return NextResponse.json({error:'Não foi possível carregar indicadores da transmissão'},{status:503})}
}
