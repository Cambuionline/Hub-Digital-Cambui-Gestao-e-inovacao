import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/firestore-admin';
import {requireSuperadmin} from '@/lib/admin-guard';
import {Timestamp} from 'firebase-admin/firestore';
export const runtime='nodejs';
const PAGE_SIZE=100;
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 try{
  const admin=await requireSuperadmin(req);if(!admin)return reply({error:'Acesso restrito'},403);
  const cursor=req.nextUrl.searchParams.get('cursor');
  if(cursor&&(cursor.length>150||!/^[A-Za-z0-9_-]+$/.test(cursor)))return reply({error:'Cursor inválido'},400);
  const db=adminDb();
  // Newest activity first. A document snapshot cursor prevents duplicate pages when timestamps tie.
  let query=db.collection('hub_admin_messages').where('adminUid','==',admin.uid).orderBy('createdAt','desc').limit(PAGE_SIZE+1);
  if(cursor){const cursorDoc=await db.collection('hub_admin_messages').doc(cursor).get();if(!cursorDoc.exists||cursorDoc.get('adminUid')!==admin.uid||!cursorDoc.get('createdAt'))return reply({error:'Cursor inválido'},400);query=query.startAfter(cursorDoc)}
  const [snap,totalSnapshot,incomingSnapshot,readSnapshot]=await Promise.all([query.get(),db.collection('hub_admin_messages').where('adminUid','==',admin.uid).count().get(),db.collection('hub_admin_messages').where('adminUid','==',admin.uid).where('direction','==','member_to_admin').count().get(),db.collection('hub_admin_messages').where('adminUid','==',admin.uid).where('direction','==','member_to_admin').where('readAt','>',Timestamp.fromMillis(0)).count().get()]);
  const page=snap.docs.slice(0,PAGE_SIZE);
  const nextCursor=snap.docs.length>PAGE_SIZE?page[page.length-1].id:null;
  const messages=page.filter(d=>d.get('direction')==='member_to_admin').map(d=>({id:d.id,uid:String(d.get('recipientUid')??''),text:String(d.get('text')??''),createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()??null,readAt:d.get('readAt')?.toDate?.()?.toISOString?.()??null}));
  const latest=new Map<string,{uid:string;lastText:string;lastAt:string|null;unread:number}>();
  for(const m of messages.sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??''))){
   if(!m.uid)continue;const previous=latest.get(m.uid);
   if(!previous)latest.set(m.uid,{uid:m.uid,lastText:m.text,lastAt:m.createdAt,unread:m.readAt?0:1});
   else if(!m.readAt)previous.unread++;
  }
  return reply({unread:messages.filter(m=>!m.readAt).length,unreadGlobal:Math.max(0,incomingSnapshot.data().count-readSnapshot.data().count),conversations:[...latest.values()],nextCursor,hasMore:!!nextCursor,partial:true,totalStored:totalSnapshot.data().count,pageSize:PAGE_SIZE,returnedMessages:messages.length});
 }catch(e){console.error('admin inbox pagination failed',e);return reply({error:'Não foi possível consultar mensagens'},503)}
}
