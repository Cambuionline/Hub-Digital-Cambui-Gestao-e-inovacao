import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/firestore-admin';
import {FieldValue} from 'firebase-admin/firestore';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso restrito'},{status:403});const id=req.nextUrl.searchParams.get('announcementId');if(!id||!/^[A-Za-z0-9_-]{1,150}$/.test(id))return NextResponse.json({error:'Informe uma publicação válida'},{status:400});const snap=await adminDb().collection('hub_enrollments').where('announcementId','==',id).limit(500).get();return NextResponse.json({items:snap.docs.map(d=>({id:d.id,userEmail:d.get('userEmail'),status:d.get('status'),attendance:d.get('attendance')??'pending',registeredAt:d.get('registeredAt')?.toDate?.()?.toISOString?.()??null}))},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Falha ao consultar inscrições'},{status:503})}}

export async function PATCH(req:NextRequest){try{
 const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso restrito'},{status:403});
 const raw=await req.text();if(raw.length>600)return NextResponse.json({error:'Dados excedem o limite'},{status:413});
 let body:unknown;try{body=JSON.parse(raw)}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return NextResponse.json({error:'Dados inválidos'},{status:400});
 const {id,attendance} = body as Record<string,unknown>;
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,300}$/.test(id)||!['present','absent','pending'].includes(String(attendance)))return NextResponse.json({error:'Inscrição ou presença inválida'},{status:400});
 const db=adminDb(),ref=db.collection('hub_enrollments').doc(id);
 const result=await db.runTransaction(async tx=>{const enrollment=await tx.get(ref);if(!enrollment.exists)return 'NOT_FOUND';if(enrollment.get('status')!=='registered')return 'CANCELLED';const announcement=await tx.get(db.collection('hub_announcements').doc(enrollment.get('announcementId')));if(!announcement.exists||announcement.get('status')==='deleted')return 'UNAVAILABLE';tx.update(ref,{attendance,attendanceUpdatedAt:FieldValue.serverTimestamp(),attendanceUpdatedBy:admin.uid});return 'OK'});
 if(result!=='OK')return NextResponse.json({error:result==='CANCELLED'?'Inscrição cancelada não permite presença':result==='NOT_FOUND'?'Inscrição não encontrada':'Evento indisponível'},{status:409});
 return NextResponse.json({ok:true,id,attendance},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('attendance update failed',e);return NextResponse.json({error:'Não foi possível atualizar a presença'},{status:503})}}
