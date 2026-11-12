import {NextRequest,NextResponse} from 'next/server';
import {adminAuth} from '@/lib/firebase-admin';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const header=request.headers.get('authorization')??'';
 if(!header.startsWith('Bearer '))return NextResponse.json({error:'Não autenticado'},{status:401});
 try{
  const auth=adminAuth();const decoded=await auth.verifyIdToken(header.slice(7),true);
  const user=await auth.getUser(decoded.uid);
  if(!user.emailVerified||decoded.admin!==true||user.disabled)return NextResponse.json({error:'Acesso não autorizado'},{status:403});
  return NextResponse.json({uid:decoded.uid,email:user.email,role:'superadmin'},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Token inválido ou serviço indisponível'},{status:401});}
}
