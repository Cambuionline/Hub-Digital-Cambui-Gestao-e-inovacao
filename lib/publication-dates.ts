export type PublicationKind='event'|'course'|'opportunity';
export type PublicationDates={startDate:string|null;endDate:string|null;deadline:string|null};
const validDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export function validatePublicationDates(kind:PublicationKind,body:Record<string,unknown>):{dates?:PublicationDates;error?:string}{
 const start=body.startDate||null,end=body.endDate||null,deadline=body.deadline||null;
 if(kind==='event'||kind==='course'){
  if(!validDate(start)||!validDate(end))return {error:'Informe as datas de início e encerramento no formato AAAA-MM-DD.'};
  if(end<start)return {error:'A data de encerramento não pode ser anterior ao início.'};
  return {dates:{startDate:start,endDate:end,deadline:null}};
 }
 if(!validDate(deadline))return {error:'Informe a data limite da oportunidade no formato AAAA-MM-DD.'};
 return {dates:{startDate:null,endDate:null,deadline}};
}
