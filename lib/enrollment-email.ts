import 'server-only';
import {adminDb} from '@/lib/firestore-admin';
import {FieldValue} from 'firebase-admin/firestore';
export type EnrollmentEmailKind='registered'|'waitlisted'|'cancelled'|'transferred';
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;
export async function queueEnrollmentEmail(args:{kind:EnrollmentEmailKind;announcementId:string;userUid:string;email:string|null|undefined;targetAnnouncementId?:string}){
 if(!args.email||!validEmail(args.email))return;
 const db=adminDb();const announcement=await db.collection('hub_announcements').doc(args.targetAnnouncementId??args.announcementId).get();
 const title=String(announcement.get('title')??'atividade do HUB');
 const label:Record<EnrollmentEmailKind,string>={registered:'Inscrição confirmada',waitlisted:'Lista de espera',cancelled:'Inscrição cancelada',transferred:'Transferência para nova turma'};
 const detail:Record<EnrollmentEmailKind,string>={registered:'Sua inscrição foi confirmada.',waitlisted:'Sua solicitação está na lista de espera. Você receberá informações sobre novas turmas.',cancelled:'Sua inscrição foi cancelada.',transferred:'Sua vaga foi confirmada em uma nova turma.'};
 const doc=db.collection('hub_email_outbox').doc();
 await doc.set({kind:args.kind,announcementId:args.announcementId,targetAnnouncementId:args.targetAnnouncementId??null,userUid:args.userUid,to:args.email,subject:label[args.kind]+' — '+title,text:detail[args.kind]+'\nAtividade: '+title+'\nAcesse sua Agenda no HUB Digital Cambuí para consultar os detalhes.',status:'pending',attempts:0,createdAt:FieldValue.serverTimestamp()});
}
