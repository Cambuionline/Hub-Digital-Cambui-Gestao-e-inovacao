import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/firestore-admin';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  const admin=await requireSuperadmin(req);
  if(!admin)return NextResponse.json({error:'Acesso negado'},{status:403,headers:{'Cache-Control':'no-store'}});
  const status=req.nextUrl.searchParams.get('status')??'pending_review';
  if(!['pending_review','approved','rejected'].includes(status))return NextResponse.json({error:'Filtro inválido'},{status:400});
  const snapshot=await adminDb().collection('users').where('status','==',status).limit(50).get();
  const users=snapshot.docs.map(d=>{const v=d.data();return {uid:d.id,displayName:v.displayName??'',email:v.email??'',roleRequested:v.roleRequested??'',status:v.status??''}});
  return NextResponse.json({users,limit:50},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Falha ao consultar solicitações'},{status:503});}
}
