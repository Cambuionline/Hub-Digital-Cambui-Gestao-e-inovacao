import {NextRequest,NextResponse} from 'next/server';
import {adminDb} from '@/lib/firestore-admin';
import {requireSuperadmin} from '@/lib/admin-guard';
import {FieldValue} from 'firebase-admin/firestore';
export const runtime='nodejs';
export async function GET(req:NextRequest){const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso restrito'},{status:403});try{const snap=await adminDb().collection('hub_email_outbox').orderBy('createdAt','desc').limit(100).get();return NextResponse.json({items:snap.docs.map(d=>({id:d.id,status:d.get('status'),kind:d.get('kind'),to:d.get('to'),subject:d.get('subject'),attempts:d.get('attempts')??0,error:d.get('error')??null}))},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Falha na consulta'},{status:503})}}
export async function POST(req:NextRequest){
 const admin=await requireSuperadmin(req);if(!admin)return NextResponse.json({error:'Acesso restrito'},{status:403});
 const apiKey=process.env.RESEND_API_KEY,from=process.env.HUB_EMAIL_FROM;
 if(!apiKey||!from)return NextResponse.json({error:'Envio de e-mails não configurado. Defina RESEND_API_KEY e HUB_EMAIL_FROM na Vercel.'},{status:503});
 let body:{id?:unknown};try{body=await req.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 if(typeof body.id!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(body.id))return NextResponse.json({error:'Identificador inválido'},{status:400});
 const ref=adminDb().collection('hub_email_outbox').doc(body.id);
 try{
  const locked=await adminDb().runTransaction(async tx=>{const doc=await tx.get(ref);if(!doc.exists||doc.get('status')!=='pending')return false;tx.update(ref,{status:'sending',attempts:FieldValue.increment(1),processingAt:FieldValue.serverTimestamp()});return true});
  if(!locked)return NextResponse.json({error:'Mensagem não está pendente'},{status:409});
  const doc=await ref.get();
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':body.id},body:JSON.stringify({from,to:[doc.get('to')],subject:doc.get('subject'),text:doc.get('text')})});
  if(!response.ok){const details=(await response.text()).slice(0,350);await ref.update({status:'failed',error:'Provedor HTTP '+response.status+': '+details,failedAt:FieldValue.serverTimestamp()});return NextResponse.json({error:'Provedor recusou o envio',status:response.status},{status:502})}
  const sent=await response.json() as {id?:string};await ref.update({status:'sent',providerId:sent.id??null,sentAt:FieldValue.serverTimestamp(),error:FieldValue.delete()});return NextResponse.json({ok:true,status:'sent',providerId:sent.id??null})
 }catch(e){console.error('email dispatch failed',e);return NextResponse.json({error:'Não foi possível concluir envio. Consulte o status da mensagem antes de tentar novamente.'},{status:503})}
}
