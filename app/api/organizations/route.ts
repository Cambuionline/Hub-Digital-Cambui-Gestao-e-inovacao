import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from '@/lib/firestore-admin';
import {requireMember} from '@/lib/member-guard';
export const runtime='nodejs';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 try{const user=await requireMember(req);if(!user)return reply({error:'Acesso restrito'},401);
 const snap=await adminDb().collection('organizations').where('ownerUid','==',user.uid).limit(30).get();
 return reply({organizations:snap.docs.map(d=>({id:d.id,name:d.get('name'),type:d.get('type'),description:d.get('description')??'',status:d.get('status')}))});
 }catch{return reply({error:'Falha ao consultar organizações'},503)}
}
export async function POST(req:NextRequest){
 try{const user=await requireMember(req);if(!user)return reply({error:'Acesso restrito'},401);
 const raw=await req.text();if(raw.length>3000)return reply({error:'Dados excedem o limite'},413);
 let p:unknown;try{p=JSON.parse(raw)}catch{return reply({error:'JSON inválido'},400)}
 if(!p||typeof p!=='object'||Array.isArray(p))return reply({error:'Dados inválidos'},400);
 const v=p as Record<string,unknown>,name=typeof v.name==='string'?v.name.trim():'',type=typeof v.type==='string'?v.type:'',description=typeof v.description==='string'?v.description.trim():'';
 if(name.length<3||name.length>160||description.length>1000||!['empresa','startup','ict','ong','governo','investidor_institucional','outra'].includes(type))return reply({error:'Preencha nome e tipo válidos'},400);
 const db=adminDb(),profile=await db.collection('users').doc(user.uid).get();
 if(!profile.exists||profile.get('status')!=='approved')return reply({error:'Seu perfil precisa estar aprovado para cadastrar uma organização'},403);
 const existing=await db.collection('organizations').where('ownerUid','==',user.uid).limit(10).get();if(existing.size>=10)return reply({error:'Limite de solicitações atingido'},409);
 const ref=db.collection('organizations').doc();await ref.create({name,type,description,ownerUid:user.uid,ownerEmail:user.email,status:'pending_review',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
 return reply({ok:true,id:ref.id,status:'pending_review'},201);
 }catch{return reply({error:'Não foi possível registrar a organização'},503)}
}

export async function PATCH(req:NextRequest){
 try{
  const user=await requireMember(req);if(!user)return reply({error:'Acesso restrito'},401);
  const raw=await req.text();if(raw.length>3000)return reply({error:'Dados excedem o limite'},413);
  let p:unknown;try{p=JSON.parse(raw)}catch{return reply({error:'JSON inválido'},400)}
  if(!p||typeof p!=='object'||Array.isArray(p))return reply({error:'Dados inválidos'},400);
  const v=p as Record<string,unknown>,id=typeof v.id==='string'?v.id:'',name=typeof v.name==='string'?v.name.trim():'',type=typeof v.type==='string'?v.type:'',description=typeof v.description==='string'?v.description.trim():'';
  if(!/^[a-zA-Z0-9_-]{10,120}$/.test(id)||name.length<3||name.length>160||description.length>1000||!['empresa','startup','ict','ong','governo','investidor_institucional','outra'].includes(type))return reply({error:'Dados inválidos'},400);
  const db=adminDb(),ref=db.collection('organizations').doc(id);
  await db.runTransaction(async tx=>{
   const doc=await tx.get(ref);if(!doc.exists)throw Error('NOT_FOUND');
   if(doc.get('ownerUid')!==user.uid)throw Error('FORBIDDEN');
   if(!['approved','pending_review','rejected'].includes(doc.get('status')))throw Error('INVALID_STATE');
   tx.update(ref,{name,type,description,status:'pending_review',updatedAt:FieldValue.serverTimestamp()});
   tx.create(db.collection('auditLogs').doc(),{actorUid:user.uid,action:'organization.updated',resource:'organizations/'+id,createdAt:FieldValue.serverTimestamp()});
  });
  return reply({ok:true,status:'pending_review'});
 }catch(e){const m=e instanceof Error?e.message:'';return reply({error:m==='NOT_FOUND'?'Organização não encontrada':m==='FORBIDDEN'?'Acesso negado':m==='INVALID_STATE'?'Estado não permite edição':'Falha ao atualizar organização'},m==='NOT_FOUND'?404:m==='FORBIDDEN'?403:m==='INVALID_STATE'?409:503)}
}
