import {NextRequest,NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {adminAuth} from '@/lib/firebase-admin';
import {adminDb} from '@/lib/firestore-admin';
import {requireSuperadmin} from '@/lib/admin-guard';
export const runtime='nodejs';
const response=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const validUid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{10,128}$/.test(v);
export async function GET(req:NextRequest){
 try{const admin=await requireSuperadmin(req);if(!admin)return response({error:'Acesso restrito'},403);
 const pageToken=req.nextUrl.searchParams.get('pageToken')??undefined;
 if(pageToken&&pageToken.length>2048)return response({error:'Página inválida'},400);
 const result=await adminAuth().listUsers(100,pageToken);
 const db=adminDb();const docs=await db.getAll(...result.users.map(u=>db.collection('users').doc(u.uid)));
 return response({users:result.users.map((u,i)=>({uid:u.uid,email:u.email??'',displayName:docs[i].get('displayName')??u.displayName??'',status:docs[i].get('status')??'sem perfil',roleRequested:docs[i].get('roleRequested')??'',disabled:u.disabled,deleted:docs[i].get('status')==='deleted',isAdmin:u.uid===admin.uid||u.customClaims?.admin===true})),nextPageToken:result.pageToken??null});
 }catch(e){console.error('admin user list failed',e);return response({error:'Falha ao consultar perfis'},503)}
}
export async function PATCH(req:NextRequest){
 try{const admin=await requireSuperadmin(req);if(!admin)return response({error:'Acesso restrito'},403);
 const raw=await req.text();if(raw.length>1000)return response({error:'Requisição muito grande'},413);
 let body:Record<string,unknown>;try{body=JSON.parse(raw)}catch{return response({error:'JSON inválido'},400)}
 const {uid,action}=body;
 if(!validUid(uid)||!['block','unblock','delete'].includes(String(action)))return response({error:'Ação inválida'},400);
 if(uid===admin.uid)return response({error:'Não é permitido modificar a própria conta'},403);
 const auth=adminAuth();const target=await auth.getUser(uid);
 if(target.customClaims?.admin===true)return response({error:'Não é permitido modificar outra conta administrativa'},403);
 const db=adminDb(),ref=db.collection('users').doc(uid);
 if(action==='delete'){
   await auth.updateUser(uid,{disabled:true});
   await db.runTransaction(async tx=>{const snap=await tx.get(ref);tx.set(ref,{status:'deleted',disabled:true,deletedAt:FieldValue.serverTimestamp(),deletedBy:admin.uid,updatedAt:FieldValue.serverTimestamp()},{merge:true});tx.create(db.collection('auditLogs').doc(),{actorUid:admin.uid,action:'profile.deactivated',resource:'users/'+uid,previousStatus:snap.get('status')??null,createdAt:FieldValue.serverTimestamp()})});
   await auth.revokeRefreshTokens(uid);
   return response({ok:true,status:'deleted',note:'Perfil desativado e ocultado. Dados preservados para auditoria.'});
 }
 const disabled=action==='block';
 await auth.updateUser(uid,{disabled});
 await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.get('status')==='deleted')throw Error('DELETED');tx.set(ref,{disabled,updatedAt:FieldValue.serverTimestamp(),blockedAt:disabled?FieldValue.serverTimestamp():FieldValue.delete(),blockedBy:disabled?admin.uid:FieldValue.delete()},{merge:true});tx.create(db.collection('auditLogs').doc(),{actorUid:admin.uid,action:disabled?'profile.blocked':'profile.unblocked',resource:'users/'+uid,createdAt:FieldValue.serverTimestamp()})});
 if(disabled)await auth.revokeRefreshTokens(uid);
 return response({ok:true,disabled});
 }catch(e){console.error('admin user action failed',e);return response({error:e instanceof Error&&e.message==='DELETED'?'Perfil excluído não pode ser desbloqueado':'Não foi possível concluir a operação'},e instanceof Error&&e.message==='DELETED'?409:503)}
}
export async function POST(req:NextRequest){
 try{const admin=await requireSuperadmin(req);if(!admin)return response({error:'Acesso restrito'},403);
 const raw=await req.text();if(raw.length>3000)return response({error:'Mensagem muito grande'},413);
 let body:Record<string,unknown>;try{body=JSON.parse(raw)}catch{return response({error:'JSON inválido'},400)}
 if(!validUid(body.uid)||typeof body.subject!=='string'||typeof body.message!=='string'||body.subject.trim().length<3||body.subject.trim().length>120||body.message.trim().length<3||body.message.trim().length>1200)return response({error:'Mensagem inválida'},400);
 const target=await adminAuth().getUser(body.uid);if(target.disabled)return response({error:'Conta bloqueada ou desativada'},409);
 const doc=await adminDb().collection('hub_admin_messages').add({recipientUid:body.uid,subject:body.subject.trim(),text:body.message.trim(),senderUid:admin.uid,createdAt:FieldValue.serverTimestamp()});
 await adminDb().collection('auditLogs').add({actorUid:admin.uid,action:'admin_message.sent',resource:'hub_admin_messages/'+doc.id,createdAt:FieldValue.serverTimestamp()});
 return response({ok:true,id:doc.id},201);
 }catch(e){console.error('admin message failed',e);return response({error:'Não foi possível enviar a mensagem'},503)}
}
