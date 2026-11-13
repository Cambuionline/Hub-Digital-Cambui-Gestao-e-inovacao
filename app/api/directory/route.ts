import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 const q=(req.nextUrl.searchParams.get('q')??'').trim().toLocaleLowerCase('pt-BR');const category=req.nextUrl.searchParams.get('category')??'';
 if(q.length>100||category.length>50)return NextResponse.json({error:'Filtro inválido'},{status:400});
 const snap=await adminDb().collection('organizations').where('status','==','approved').limit(200).get();
 const all=snap.docs.map(d=>({id:d.id,name:String(d.get('name')??''),type:String(d.get('type')??''),description:String(d.get('description')??'').slice(0,1000)}));
 const organizations=all.filter(o=>(!category||o.type===category)&&(!q||(o.name+' '+o.description+' '+o.type).toLocaleLowerCase('pt-BR').includes(q))).slice(0,50);
 return NextResponse.json({organizations,limit:50},{headers:{'Cache-Control':'public, max-age=30'}});
 }catch{return NextResponse.json({error:'Diretório indisponível'},{status:503})}}
