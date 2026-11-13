import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from '@/lib/firestore-admin';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const admin=await requireSuperadmin(req);
  if(!admin)return NextResponse.json({error:'Acesso negado'},{status:403});
  const raw=await req.text();if(raw.length>1024)return NextResponse.json({error:'Requisição muito grande'},{status:413});
  let payload:unknown;try{payload=JSON.parse(raw)}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return NextResponse.json({error:'Dados inválidos'},{status:400});
  const {uid,decision} = payload as Record<string,unknown>;
  if(typeof uid!=='string'||uid.length<10||uid.length>128||!['approved','rejected'].includes(String(decision)))return NextResponse.json({error:'Solicitação inválida'},{status:400});
  if(uid===admin.uid)return NextResponse.json({error:'Não é permitido revisar a própria conta'},{status:403});
  const db=adminDb(),ref=db.collection('users').doc(uid);
  await db.runTransaction(async tx=>{
   const snapshot=await tx.get(ref);
   if(!snapshot.exists)throw new Error('NOT_FOUND');
   if(snapshot.get('status')!=='pending_review')throw new Error('ALREADY_REVIEWED');
   tx.update(ref,{status:decision,reviewedBy:admin.uid,reviewedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
   tx.create(db.collection('auditLogs').doc(),{actorUid:admin.uid,action:decision==='approved'?'profile.approved':'profile.rejected',resource:'users/'+uid,createdAt:FieldValue.serverTimestamp()});
  });
  return NextResponse.json({ok:true,status:decision},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const reason=e instanceof Error?e.message:'';if(reason==='NOT_FOUND')return NextResponse.json({error:'Perfil não encontrado'},{status:404});if(reason==='ALREADY_REVIEWED')return NextResponse.json({error:'Solicitação já analisada'},{status:409});return NextResponse.json({error:'Não foi possível analisar a solicitação'},{status:503});}
}
