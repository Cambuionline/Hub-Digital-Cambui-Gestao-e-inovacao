'use client';
import {useState} from 'react';
import {GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,sendEmailVerification,signOut} from 'firebase/auth';
import {createFirebaseClient} from '@/lib/firebase';
export default function Login(){
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function login(provider:'google'|'password'){
 setBusy(true);setMessage('');try{const {auth}=createFirebaseClient();const result=provider==='google'?await signInWithPopup(auth,new GoogleAuthProvider()):await signInWithEmailAndPassword(auth,email,password);
 if(!result.user.emailVerified){await sendEmailVerification(result.user);await signOut(auth);setMessage('Confirme seu e-mail antes de continuar.');return;}
 const token=await result.user.getIdTokenResult(true);if(token.claims.admin===true){window.location.assign('/admin');return;}setMessage('Conta autenticada. O painel administrativo exige autorização específica.');
 }catch{setMessage('Não foi possível entrar. Verifique as credenciais e configurações.');}finally{setBusy(false)}
 }
 return <main style={{maxWidth:430,margin:'8vh auto',padding:24}}><h1>Acesso ao HUB</h1><p>A autorização administrativa é concedida separadamente.</p><form onSubmit={e=>{e.preventDefault();void login('password')}}><label htmlFor="email">E-mail</label><input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={{display:'block',width:'100%',padding:12,margin:'8px 0 16px'}}/><label htmlFor="password">Senha</label><input id="password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:12,margin:'8px 0 16px'}}/><button disabled={busy} type="submit">Entrar</button></form><p><button disabled={busy} onClick={()=>void login('google')}>Entrar com Google</button></p><p role="status">{message}</p><a href="/">Voltar</a></main>
}
