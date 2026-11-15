import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from '@/lib/firestore-admin';
import {requireMember} from '@/lib/member-guard';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const manager=await requireSuperadmin(req).catch(()=>null),member=manager??await requireMember(req).catch(()=>null);
  if(!member)return NextResponse.json({error:'Autenticação necessária'},{status:401});
  const body=await req.json() as {room?:string;id?:string;event?:string};
  if(!/^sala-[1-4]$/.test(body.room??'')||!/^[A-Za-z0-9_-]{1,150}$/.test(body.id??'')||!['joined','heartbeat','left'].includes(body.event??''))return NextResponse.json({error:'Dados inválidos'},{status:400});
  const db=adminDb(),session=await db.collection('hub_live_sessions').doc(body.id!).get();
  if(!session.exists||session.get('room')!==body.room)return NextResponse.json({error:'Atividade inexistente'},{status:404});
  const start=Date.parse(String(session.get('start'))),end=Date.parse(String(session.get('end'))),now=Date.now();
  if(!Number.isFinite(start)||!Number.isFinite(end)||now<start-15*60000||now>end+5*60000)return NextResponse.json({error:'Fora da janela da atividade'},{status:403});
  if(!manager){
   const announcementId=session.get('announcementId') as string|undefined;
   const enrollment=announcementId?await db.collection('hub_enrollments').doc(announcementId+'_'+member.uid).get():await db.collection('hub_live_registrations').doc(body.id+'_'+member.uid).get();
   if(!enrollment.exists||enrollment.get('status')!=='registered')return NextResponse.json({error:'Inscrição necessária'},{status:403});
  }
  const ref=session.ref.collection('attendance').doc(member.uid);
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref),last=snap.get('lastSeenAt')?.toMillis?.() as number|undefined;
   if(body.event==='heartbeat'&&last&&now-last<10000)return;
   if(body.event==='joined')tx.set(ref,{uid:member.uid,role:manager?'presenter':'viewer',firstJoinedAt:snap.exists?snap.get('firstJoinedAt'):FieldValue.serverTimestamp(),lastSeenAt:FieldValue.serverTimestamp(),lastLeftAt:null,joinCount:FieldValue.increment(1),source:'browser-client'},{merge:true});
   else if(body.event==='heartbeat'){if(snap.exists)tx.update(ref,{lastSeenAt:FieldValue.serverTimestamp()})}
   else if(snap.exists)tx.update(ref,{lastLeftAt:FieldValue.serverTimestamp(),lastSeenAt:FieldValue.serverTimestamp()});
  });
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('attendance event',e);return NextResponse.json({error:'Falha ao registrar participação'},{status:503})}
}
