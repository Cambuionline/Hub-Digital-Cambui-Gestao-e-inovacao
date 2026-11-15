import {NextRequest,NextResponse} from 'next/server';
import {requireSuperadmin} from '@/lib/admin-guard';
import {adminDb} from '@/lib/firestore-admin';
export const runtime='nodejs';
const cell=(v:unknown)=>{const str=String(v??'').replace(/[\r\n]+/g,' ').replace(/^[=+@\-\t]/,'\u0027$&');return '"'+str.replace(/"/g,'""')+'"'};
export async function GET(req:NextRequest){
 try{
  const manager=await requireSuperadmin(req);if(!manager)return NextResponse.json({error:'Acesso restrito'},{status:403});
  const room=req.nextUrl.searchParams.get('room')??'',id=req.nextUrl.searchParams.get('id')??'';
  if(!/^sala-[1-4]$/.test(room)||!/^[A-Za-z0-9_-]{1,150}$/.test(id))return NextResponse.json({error:'Atividade inválida'},{status:400});
  const db=adminDb(),session=await db.collection('hub_live_sessions').doc(id).get();
  if(!session.exists||session.get('room')!==room)return NextResponse.json({error:'Atividade não encontrada'},{status:404});
  const chat=session.ref.collection('chat');
  const [total,hidden,pinned,blocked]=await Promise.all([chat.count().get(),chat.where('hidden','==',true).count().get(),chat.where('pinned','==',true).count().get(),session.ref.collection('chat_blocked').count().get()]);
  const rows:[string,string][]=[
   ['Relatório','Hub Digital Cambuí - Transmissão'],
   ['Atividade',String(session.get('title')??'')],
   ['Sala',room],['ID da atividade',id],
   ['Início previsto',String(session.get('start')??'')],
   ['Fim previsto',String(session.get('end')??'')],
   ['Mensagens registradas',String(total.data().count)],
   ['Mensagens ocultadas',String(hidden.data().count)],
   ['Mensagens destacadas',String(pinned.data().count)],
   ['Participantes com envio restrito',String(blocked.data().count)],
   ['Chat pausado',session.get('chatLocked')?'Sim':'Não'],
   ['Observação','Os indicadores de chat não equivalem à audiência de vídeo. Este relatório não inclui espectadores únicos.']
  ];
  const csv='\uFEFF'+[['Campo','Valor'],...rows].map(row=>row.map(cell).join(';')).join('\r\n');
  return new NextResponse(csv,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="relatorio-transmissao-'+room+'-'+id+'.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error('live report export',e);return NextResponse.json({error:'Falha ao exportar relatório'},{status:503})}
}
