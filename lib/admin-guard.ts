import 'server-only';
import {NextRequest} from 'next/server';
import {adminAuth} from '@/lib/firebase-admin';
export async function requireSuperadmin(request:NextRequest){
 const bearer=request.headers.get('authorization')??'';
 if(!bearer.startsWith('Bearer '))return null;
 const decoded=await adminAuth().verifyIdToken(bearer.slice(7),true);
 const user=await adminAuth().getUser(decoded.uid);
 if(user.disabled||!user.emailVerified||decoded.admin!==true)return null;
 return {uid:decoded.uid,email:user.email??''};
}
