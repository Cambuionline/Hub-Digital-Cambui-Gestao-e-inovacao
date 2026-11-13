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
 return NextResponse.json({notifications:[...notifications,...adminNotifications].sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??'')).slice(0,100)},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Não foi possível consultar notificações'},{status:503})}
}
