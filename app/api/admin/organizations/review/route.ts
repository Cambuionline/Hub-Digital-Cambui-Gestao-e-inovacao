import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from '@/lib/firestore-admin';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
export async function POST(req:NextRequest){try{
 const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso negado'},{status:403});
 const raw=await req.text();if(raw.length>1024)return NextResponse.json({error:'Dados excedem limite'},{status:413});let p:unknown;try{p=JSON.parse(raw)}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 if(!p||typeof p!=='object'||Array.isArray(p))return NextResponse.json({error:'Dados inválidos'},{status:400});const {id,decision}=p as Record<string,unknown>;
 if(typeof id!=='string'||!/^[a-zA-Z0-9]{15,32}$/.test(id)||!['approved','rejected'].includes(String(decision)))return NextResponse.json({error:'Dados inválidos'},{status:400});
 const db=adminDb(),ref=db.collection('organizations').doc(id);
 await db.runTransaction(async tx=>{const doc=await tx.get(ref);if(!doc.exists)throw new Error('NOT_FOUND');if(doc.get('status')!=='pending_review')throw new Error('REVIEWED');tx.update(ref,{status:decision,reviewedBy:admin.uid,reviewedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});tx.create(db.collection('auditLogs').doc(),{actorUid:admin.uid,action:decision==='approved'?'organization.approved':'organization.rejected',resource:'organizations/'+id,createdAt:FieldValue.serverTimestamp()})});return NextResponse.json({ok:true,status:decision});
 }catch(e){const m=e instanceof Error?e.message:'';return NextResponse.json({error:m==='NOT_FOUND'?'Organização não encontrada':m==='REVIEWED'?'Solicitação já analisada':'Falha ao analisar organização'},{status:m==='NOT_FOUND'?404:m==='REVIEWED'?409:503})}}
