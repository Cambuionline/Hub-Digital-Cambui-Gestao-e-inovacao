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
  let query=db.collection('hub_admin_messages').where('adminUid','==',admin.uid).where('direction','==','member_to_admin').orderBy('createdAt','desc').limit(PAGE_SIZE+1);
  if(cursor){const cursorDoc=await db.collection('hub_admin_messages').doc(cursor).get();if(!cursorDoc.exists||cursorDoc.get('adminUid')!==admin.uid||cursorDoc.get('direction')!=='member_to_admin'||!cursorDoc.get('createdAt'))return reply({error:'Cursor inválido'},400);query=query.startAfter(cursorDoc)}
  const [snap,totalSnapshot,incomingSnapshot,readSnapshot]=await Promise.all([query.get(),db.collection('hub_admin_messages').where('adminUid','==',admin.uid).count().get(),db.collection('hub_admin_messages').where('adminUid','==',admin.uid).where('direction','==','member_to_admin').count().get(),db.collection('hub_admin_messages').where('adminUid','==',admin.uid).where('direction','==','member_to_admin').where('readAt','>',Timestamp.fromMillis(0)).count().get()]);
  const page=snap.docs.slice(0,PAGE_SIZE);
  const nextCursor=snap.docs.length>PAGE_SIZE?page[page.length-1].id:null;
  const messages=page.map(d=>({id:d.id,uid:String(d.get('recipientUid')??''),text:String(d.get('text')??''),createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()??null,readAt:d.get('readAt')?.toDate?.()?.toISOString?.()??null}));
  const latest=new Map<string,{uid:string;lastText:string;lastAt:string|null;unread:number}>();
  for(const m of messages.sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??''))){
   if(!m.uid)continue;const previous=latest.get(m.uid);
   if(!previous)latest.set(m.uid,{uid:m.uid,lastText:m.text,lastAt:m.createdAt,unread:m.readAt?0:1});
   else if(!m.readAt)previous.unread++;
  }
  return reply({unread:messages.filter(m=>!m.readAt).length,unreadGlobal:Math.max(0,incomingSnapshot.data().count-readSnapshot.data().count),conversations:[...latest.values()],nextCursor,hasMore:!!nextCursor,partial:!!nextCursor,totalStored:totalSnapshot.data().count,pageSize:PAGE_SIZE,returnedMessages:messages.length});
 }catch(e){
  console.error('admin inbox indexed query failed; attempting single-field fallback',e);
  try{
   const admin=await requireSuperadmin(req);if(!admin)return reply({error:'Acesso restrito'},403);
   const db=adminDb(),cursor=req.nextUrl.searchParams.get('cursor');
   if(cursor&&(cursor.length>150||!/^[A-Za-z0-9_-]+$/.test(cursor)))return reply({error:'Cursor inválido'},400);
   // Single-field index fallback: scan bounded chunks until we collect incoming
   // messages, instead of showing an empty inbox when outgoing messages dominate.
   const MAX_SCAN=2000,CHUNK=250;
   let scanned=0,position=cursor;
   const incoming:{uid:string;lastText:string;lastAt:string|null;readAt:unknown}[]=[];
   while(scanned<MAX_SCAN&&incoming.length<PAGE_SIZE){
    let query=db.collection('hub_admin_messages').where('adminUid','==',admin.uid).orderBy('__name__').limit(CHUNK);
    if(position){
     const cursorDoc=await db.collection('hub_admin_messages').doc(position).get();
     if(!cursorDoc.exists||cursorDoc.get('adminUid')!==admin.uid)return reply({error:'Cursor inválido'},400);
     query=query.startAfter(cursorDoc);
    }
    const snap=await query.get();
    if(snap.empty){position=null;break}
    for(const doc of snap.docs){
     position=doc.id;scanned++;
     if(doc.get('direction')!=='member_to_admin')continue;
     const uid=String(doc.get('recipientUid')??doc.get('senderUid')??'');
     if(!uid)continue;
     incoming.push({uid,lastText:String(doc.get('text')??''),lastAt:doc.get('createdAt')?.toDate?.()?.toISOString?.()??null,readAt:doc.get('readAt')});
     if(incoming.length>=PAGE_SIZE)break;
    }
    if(snap.size<CHUNK){position=null;break}
   }
   incoming.sort((a,b)=>(b.lastAt??'').localeCompare(a.lastAt??''));
   const conversations=new Map<string,{uid:string;lastText:string;lastAt:string|null;unread:number}>();
   for(const msg of incoming){
    const existing=conversations.get(msg.uid);
    if(!existing)conversations.set(msg.uid,{uid:msg.uid,lastText:msg.lastText,lastAt:msg.lastAt,unread:msg.readAt?0:1});
    else if(!msg.readAt)existing.unread++;
   }
   const nextCursor=position;
   return reply({conversations:[...conversations.values()],unread:incoming.filter(m=>!m.readAt).length,unreadGlobal:null,totalStored:null,nextCursor,hasMore:!!nextCursor,partial:!!nextCursor,degraded:true,scannedMessages:scanned,warning:'Modo de compatibilidade: foram examinadas até 2.000 mensagens por consulta. Contagem global e ordem completa exigem índices compostos do Firestore.'});
  }catch(fallbackError){console.error('admin inbox fallback failed',fallbackError);return reply({error:'Não foi possível consultar mensagens. Verifique os índices do Firestore e os logs da API.'},503)}
 }
}
