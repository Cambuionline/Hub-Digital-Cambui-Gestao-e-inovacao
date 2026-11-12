import 'server-only';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
export function adminAuth(){
 const projectId=process.env.FIREBASE_ADMIN_PROJECT_ID;
 const clientEmail=process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
 const privateKey=process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g,'\n');
 if(!projectId||!clientEmail||!privateKey)throw new Error('Firebase Admin SDK não configurado');
 const app=getApps().find(a=>a.name==='hub-admin')??initializeApp({credential:cert({projectId,clientEmail,privateKey})},'hub-admin');
 return getAuth(app);
}
