import 'server-only';
import {NextRequest} from 'next/server';
import {adminAuth} from '@/lib/firebase-admin';
export async function requireMember(req:NextRequest){
 const header=req.headers.get('authorization')??'';
 if(!header.startsWith('Bearer '))return null;
 const token=await adminAuth().verifyIdToken(header.slice(7),true);
 const user=await adminAuth().getUser(token.uid);
 if(user.disabled||!user.emailVerified||!user.email)return null;
 return {uid:user.uid,email:user.email};
}
