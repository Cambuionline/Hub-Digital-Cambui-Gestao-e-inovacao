import {NextRequest,NextResponse} from 'next/server';
import {requireSuperadmin} from '@/lib/admin-guard';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 try{
  if(!await requireSuperadmin(req))return reply({error:'Acesso restrito'},403);
  const db=adminDb();
  const snap=await db.collection('hub_live_sessions').orderBy('createdAt','desc').limit(200).get();
  const now=Date.now();
  const sessions=snap.docs.map(doc=>({id:doc.id,room:String(doc.get('room')??''),title:String(doc.get('title')??''),kind:String(doc.get('kind')??''),start:String(doc.get('start')??''),end:String(doc.get('end')??''),status:String(doc.get('status')??''),capacity:typeof doc.get('capacity')==='number'?doc.get('capacity') as number:null,registeredCount:Number(doc.get('registeredCount')??0),announcementId:typeof doc.get('announcementId')==='string'?doc.get('announcementId') as string:null}));
  const [counts,announcementDocs]=await Promise.all([Promise.all(sessions.map(s=>db.collection('hub_live_presence').doc(s.id).collection('members').count().get())),Promise.all(sessions.map(s=>s.announcementId?db.collection('hub_announcements').doc(s.announcementId).get():Promise.resolve(null)))]);
  const items=sessions.map((s,i)=>({...s,registeredCount:announcementDocs[i]?.exists?Number(announcementDocs[i]?.get('registeredCount')??0):s.registeredCount,attendanceCount:counts[i].data().count,phase:s.status==='cancelled'?'cancelled':Date.parse(s.end)<=now?'completed':Date.parse(s.start)<=now?'ongoing':'upcoming'}));
  return reply({items,summary:{total:items.length,upcoming:items.filter(s=>s.phase==='upcoming').length,ongoing:items.filter(s=>s.phase==='ongoing').length,completed:items.filter(s=>s.phase==='completed').length,cancelled:items.filter(s=>s.phase==='cancelled').length,registrations:items.reduce((n,s)=>n+s.registeredCount,0),uniqueAttendancesPerSession:items.reduce((n,s)=>n+s.attendanceCount,0)},limited:snap.size===200});
 }catch{return reply({error:'Não foi possível gerar o relatório'},503)}
}
