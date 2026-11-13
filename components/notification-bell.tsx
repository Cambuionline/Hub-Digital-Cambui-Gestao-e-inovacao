'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {onAuthStateChanged,type User} from 'firebase/auth';
import {createFirebaseClient} from '@/lib/firebase';
type Conversation={id:string;organizationName:string;participantName:string;unread:number;lastMessageText:string};
export default function NotificationBell(){
 const [user,setUser]=useState<User|null>(null),[items,setItems]=useState<Conversation[]>([]),[open,setOpen]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let alive=true;let current:User|null=null;let inFlight=false;let unsubscribe=()=>{};try{const {auth}=createFirebaseClient();unsubscribe=onAuthStateChanged(auth,u=>{current=u;if(alive){setUser(u);if(!u){setItems([]);setOpen(false)}else void refresh(u)}})}catch{return}
 async function refresh(u:User){if(inFlight)return;inFlight=true;try{const token=await u.getIdToken();const r=await fetch('/api/messages/overview',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!r.ok)throw Error('Falha ao consultar notificações');const data=await r.json() as {conversations?:Conversation[]};if(alive&&current?.uid===u.uid){setItems((data.conversations??[]).filter(c=>c.unread>0));setError('')}}catch{if(alive)setError('Não foi possível atualizar as notificações.')}finally{inFlight=false}}
 const timer=setInterval(()=>{if(current&&document.visibilityState==='visible')void refresh(current)},20000);
 const focus=()=>{if(current)void refresh(current)};window.addEventListener('focus',focus);
 return()=>{alive=false;unsubscribe();clearInterval(timer);window.removeEventListener('focus',focus)}},[]);
 if(!user)return null;const total=items.reduce((sum,c)=>sum+c.unread,0);
 return <aside className="hub-notifications" aria-label="Notificações do HUB"><button type="button" className="hub-notification-trigger" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={'Notificações: '+total+' mensagens não lidas'}>🔔{total>0&&<span className="hub-notification-count">{total>99?'99+':total}</span>}</button>{open&&<div className="hub-notification-panel"><div className="hub-notification-heading"><strong>Notificações</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Fechar notificações">×</button></div>{error&&<p role="status">{error}</p>}{items.length===0?<p>Você não tem mensagens não lidas.</p>:items.map(c=><Link href={'/mensagens?connectionId='+encodeURIComponent(c.id)} className="hub-notification-item" key={c.id} onClick={()=>setOpen(false)}><strong>{c.organizationName}</strong><span>{c.participantName} · {c.unread} nova(s)</span><small>{c.lastMessageText}</small></Link>)}<Link href="/mensagens" className="hub-notification-all" onClick={()=>setOpen(false)}>Abrir central de mensagens</Link></div>}</aside>
}
