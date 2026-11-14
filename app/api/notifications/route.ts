import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/firestore-admin';
import {requireMember} from '@/lib/member-guard';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
 const member=await requireMember(req);if(!member)return NextResponse.json({error:'Acesso restrito'},{status:401});
 const db=adminDb();
 const [incoming,outgoing]=await Promise.all([db.collection('connections').where('recipientUid','==',member.uid).limit(50).get(),db.collection('connections').where('requesterUid','==',member.uid).limit(50).get()]);
 const pending=incoming.docs.filter(d=>d.get('status')==='pending');
 const accepted=outgoing.docs.filter(d=>d.get('status')==='accepted');
 const notifications=await Promise.all([...pending.map(async d=>{const p=await db.collection('users').doc(d.get('requesterUid')).get();return {id:'connection:'+d.id,type:'connection_request',title:'Nova solicitação de conexão',description:(p.get('displayName')??'Um participante')+' deseja se conectar.',href:'/conexoes',createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()??null}}),...accepted.map(async d=>{const org=await db.collection('organizations').doc(d.get('organizationId')).get();return {id:'accepted:'+d.id,type:'connection_accepted',title:'Conexão aprovada',description:'Sua conexão com '+(org.get('name')??'uma organização')+' foi aprovada.',href:'/mensagens?connectionId='+encodeURIComponent(d.id),createdAt:d.get('updatedAt')?.toDate?.()?.toISOString?.()??null}})]);
 let adminNotifications:typeof notifications=[];
 const admin=await requireSuperadmin(req);
 if(admin){const [users,orgs]=await Promise.all([db.collection('users').where('status','==','pending_review').limit(50).get(),db.collection('organizations').where('status','==','pending_review').limit(50).get()]);
 adminNotifications=[...users.docs.map(d=>({id:'user:'+d.id,type:'profile_review',title:'Perfil aguardando aprovação',description:d.get('displayName')??d.get('email')??'Novo participante',href:'/admin',createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()??null})),...orgs.docs.map(d=>({id:'org:'+d.id,type:'organization_review',title:'Organização aguardando aprovação',description:d.get('name')??'Nova organização',href:'/admin',createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()??null}))];}
 const announcements=await db.collection('hub_announcements').where('status','==','published').limit(100).get();
 const announcementNotifications=announcements.docs.map(d=>({id:'announcement:'+d.id,type:d.get('kind')??'opportunity',title:d.get('title')??'Novidade no HUB',description:d.get('description')??'',href:d.get('href')??'/',createdAt:d.get('createdAt')?.toDate?.()?.toISOString?.()??null}));
 const all=[...notifications,...adminNotifications,...announcementNotifications].sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??'')).slice(0,100);
 const readDocs=await db.collection('users').doc(member.uid).collection('notification_reads').limit(500).get();
 const readMap=new Map(readDocs.docs.map(d=>[d.id,d.get('sourceTimestamp')??null]));
 return NextResponse.json({notifications:all.map(n=>({...n,read:readMap.has(encodeURIComponent(n.id))&&readMap.get(encodeURIComponent(n.id))===(n.createdAt??null)}))},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Não foi possível consultar notificações'},{status:503})}
}

export async function POST(req:NextRequest){
 try{
 const member=await requireMember(req);if(!member)return NextResponse.json({error:'Acesso restrito'},{status:401});
 const body=await req.json() as {id?:unknown;sourceTimestamp?:unknown};
 if(typeof body.id!=='string'||body.id.length>220||! /^(connection|accepted|user|org|announcement):[A-Za-z0-9_-]{1,150}$/.test(body.id)||!(body.sourceTimestamp===null||typeof body.sourceTimestamp==='string'&&body.sourceTimestamp.length<80))return NextResponse.json({error:'Notificação inválida'},{status:400});
 // Recompute accessible notifications before allowing a read marker to be saved.
 const auth=req.headers.get('authorization')??'';
 const own=await GET(new NextRequest(req.url,{headers:{authorization:auth}}));
 if(!own.ok)return NextResponse.json({error:'Acesso não autorizado'},{status:403});
 const data=await own.json() as {notifications:{id:string;createdAt:string|null}[]};
 const target=data.notifications.find(n=>n.id===body.id&&n.createdAt===body.sourceTimestamp);
 if(!target)return NextResponse.json({error:'Notificação indisponível'},{status:404});
 await adminDb().collection('users').doc(member.uid).collection('notification_reads').doc(encodeURIComponent(target.id)).set({sourceTimestamp:target.createdAt,readAt:new Date(),type:target.id.split(':')[0]});
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Falha ao marcar notificação como lida'},{status:503})}
}
