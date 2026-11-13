import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/firestore-admin';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso negado'},{status:403});const snap=await adminDb().collection('organizations').where('status','==','pending_review').limit(50).get();return NextResponse.json({organizations:snap.docs.map(d=>({id:d.id,name:d.get('name'),type:d.get('type'),ownerEmail:d.get('ownerEmail'),status:d.get('status')}))},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Falha ao consultar organizações'},{status:503})}}
