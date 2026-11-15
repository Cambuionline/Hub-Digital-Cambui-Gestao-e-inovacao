import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/firestore-admin';
import {requireMember} from '@/lib/member-guard';
export const runtime='nodejs';
export async function GET(req:NextRequest,context:{params:Promise<{id:string}>}){
 try{
  const member=await requireMember(req);if(!member)return NextResponse.json({error:'Autenticação necessária'},{status:401});
  const {id}=await context.params;
  if(!/^[A-Za-z0-9_-]{1,150}$/.test(id))return NextResponse.json({error:'Identificador inválido'},{status:400});
  const doc=await adminDb().collection('hub_announcements').doc(id).get();
  if(!doc.exists||doc.get('status')!=='published')return NextResponse.json({error:'Atividade não encontrada'},{status:404});
  return NextResponse.json({activity:{id:doc.id,kind:doc.get('kind')??'event',title:doc.get('title')??'',description:doc.get('description')??'',href:doc.get('href')??'',room:doc.get('room')??null,startAt:doc.get('startAt')??null,endAt:doc.get('endAt')??null,startDate:doc.get('startDate')??null,endDate:doc.get('endDate')??null,deadline:doc.get('deadline')??null,capacity:doc.get('capacity')??null,registeredCount:doc.get('registeredCount')??0}},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Falha ao consultar atividade'},{status:503})}
}
