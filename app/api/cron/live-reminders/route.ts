import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
const respond=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!=='Bearer '+secret)return respond({error:'Não autorizado'},401);
 try{
  const db=adminDb(),now=Date.now();
  // Called by a scheduler at least every five minutes. Queue reminders for sessions starting in 55-65 minutes.
  const from=new Date(now+55*60000).toISOString(),to=new Date(now+65*60000).toISOString();
  const sessions=await db.collection('hub_live_sessions').where('start','>=',from).where('start','<=',to).limit(100).get();
  let queued=0,skipped=0;
  for(const doc of sessions.docs){
   if(doc.get('status')!=='scheduled'||!doc.get('announcementId'))continue;
   const announcementId=String(doc.get('announcementId'));
   const enrollments=await db.collection('hub_enrollments').where('announcementId','==',announcementId).limit(500).get();
   for(const enrolled of enrollments.docs){
    if(enrolled.get('status')!=='registered')continue;
    const email=String(enrolled.get('userEmail')??'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))continue;
    const outbox=db.collection('hub_email_outbox').doc('live-reminder-'+doc.id+'-'+String(enrolled.get('userUid')));
    const title=String(doc.get('title')??'Atividade');
    const created=await db.runTransaction(async tx=>{
     const prior=await tx.get(outbox);if(prior.exists)return false;
     tx.create(outbox,{kind:'live_reminder_1h',announcementId,sessionId:doc.id,userUid:enrolled.get('userUid'),to:email,subject:'Sua atividade começa em aproximadamente 1 hora — '+title,text:'Lembrete: '+title+' está programada para '+new Date(String(doc.get('start'))).toLocaleString('pt-BR',{timeZone:'America/Bahia'})+'. Acesse o HUB Digital Cambuí e consulte sua inscrição e sala virtual.',status:'pending',attempts:0,createdAt:FieldValue.serverTimestamp()});
     return true;
    });if(created)queued++;else skipped++;
   }
  }
  return respond({ok:true,queued,skipped,scannedSessions:sessions.size,window:{from,to},note:'Mensagens adicionadas à fila; entrega depende do processador de e-mails configurado'});
 }catch(e){console.error('live reminders error',e);return respond({error:'Falha ao processar lembretes'},503)}
}
