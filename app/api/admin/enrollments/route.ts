import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/firestore-admin';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso restrito'},{status:403});const id=req.nextUrl.searchParams.get('announcementId');if(!id||!/^[A-Za-z0-9_-]{1,150}$/.test(id))return NextResponse.json({error:'Informe uma publicação válida'},{status:400});const snap=await adminDb().collection('hub_enrollments').where('announcementId','==',id).limit(500).get();return NextResponse.json({items:snap.docs.map(d=>({id:d.id,userEmail:d.get('userEmail'),status:d.get('status'),registeredAt:d.get('registeredAt')?.toDate?.()?.toISOString?.()??null}))},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Falha ao consultar inscrições'},{status:503})}}
