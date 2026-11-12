import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {adminAuth} from '@/lib/firebase-admin';
import {adminDb} from '@/lib/firestore-admin';
import {validateProfile} from '@/lib/profile-validation';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
function reply(body:object,status=200){return NextResponse.json(body,{status,headers:noStore});}
async function identity(req:NextRequest){
 const header=req.headers.get('authorization')??'';
 if(!header.startsWith('Bearer '))return null;
 const auth=adminAuth();const token=await auth.verifyIdToken(header.slice(7),true);
 const user=await auth.getUser(token.uid);
 if(user.disabled||!user.emailVerified||!user.email)return null;
 return {uid:user.uid,email:user.email,displayName:user.displayName??''};
}
export async function GET(req:NextRequest){
 try{const user=await identity(req);if(!user)return reply({error:'Autenticação e e-mail verificado são obrigatórios.'},401);
 const doc=await adminDb().collection('users').doc(user.uid).get();
 return reply({profile:doc.exists?doc.data():null});
 }catch{return reply({error:'Não foi possível consultar o perfil.'},503)}
}
export async function POST(req:NextRequest){
 try{
  const user=await identity(req);if(!user)return reply({error:'Autenticação e e-mail verificado são obrigatórios.'},401);
  if(Number(req.headers.get('content-length')??'0')>4096)return reply({error:'Dados excedem o limite.'},413);
  const raw=await req.text();if(raw.length>4096)return reply({error:'Dados excedem o limite.'},413);
  let payload:unknown;try{payload=JSON.parse(raw)}catch{return reply({error:'JSON inválido.'},400)}
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return reply({error:'Dados inválidos.'},400);
  const p=payload as Record<string,unknown>;
  const validation=validateProfile({displayName:typeof p.displayName==='string'?p.displayName:'',role:typeof p.role==='string'?p.role:'',organizationName:typeof p.organizationName==='string'?p.organizationName:undefined,organizationType:typeof p.organizationType==='string'?p.organizationType:undefined,description:typeof p.description==='string'?p.description:undefined});
  if(!validation.valid)return reply({errors:validation.errors},400);
  const ref=adminDb().collection('users').doc(user.uid);
  const outcome=await adminDb().runTransaction(async tx=>{const existing=await tx.get(ref);
   if(existing.exists)return {created:false};
   tx.create(ref,{uid:user.uid,email:user.email,displayName:validation.normalized.displayName,roleRequested:validation.normalized.role,status:'pending_review',organizationName:validation.normalized.organizationName,organizationType:validation.normalized.organizationType,description:validation.normalized.description,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return {created:true};
  });
  return reply({ok:true,created:outcome.created,status:outcome.created?'pending_review':'already_exists'},outcome.created?201:200);
 }catch{return reply({error:'Não foi possível salvar o perfil. Verifique a configuração do servidor.'},503)}
}
