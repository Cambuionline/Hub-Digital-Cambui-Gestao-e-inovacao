'use client';
import {useEffect,useState} from 'react';
import {onAuthStateChanged,signOut,type User} from 'firebase/auth';
import {createFirebaseClient} from '@/lib/firebase';
type AdminData={uid:string;email:string;role:string};
type Organization={id:string;name:string;type:string;ownerEmail:string;status:string};
type PendingUser={uid:string;displayName:string;email:string;roleRequested:string;status:string};
export default function Admin(){const [status,setStatus]=useState('Validando identidade e permissão no servidor...');const [data,setData]=useState<AdminData|null>(null);const [user,setUser]=useState<User|null>(null);const [items,setItems]=useState<PendingUser[]>([]);const [loading,setLoading]=useState(false);const [working,setWorking]=useState('');const [notice,setNotice]=useState('');const [organizations,setOrganizations]=useState<Organization[]>([]);
 async function load(u:User){setLoading(true);try{const token=await u.getIdToken();const res=await fetch('/api/admin/users?status=pending_review',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!res.ok)throw new Error('Não foi possível consultar solicitações');const result=await res.json() as {users:PendingUser[]};setItems(result.users);const orgRes=await fetch('/api/admin/organizations',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!orgRes.ok)throw new Error('Não foi possível consultar organizações');const orgData=await orgRes.json() as {organizations:Organization[]};setOrganizations(orgData.organizations);setNotice('');}catch(e){setNotice(e instanceof Error?e.message:'Falha na consulta');}finally{setLoading(false)}}
 useEffect(()=>{let active=true;let unsubscribe=()=>{};try{const {auth}=createFirebaseClient();unsubscribe=onAuthStateChanged(auth,async current=>{if(!active)return;setUser(current);if(!current){setStatus('Acesso restrito. Faça login com uma conta autorizada.');setData(null);return;}try{const token=await current.getIdToken();const res=await fetch('/api/admin/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!active)return;if(!res.ok){setStatus(res.status===403?'Conta sem autorização administrativa.':'Não foi possível validar sua sessão.');setData(null);return;}const info=await res.json() as AdminData;setData(info);setStatus('');void load(current);}catch{if(active)setStatus('Falha na validação administrativa.');}});}catch{setStatus('Firebase não configurado neste ambiente.');}return()=>{active=false;unsubscribe();}},[]);
 async function review(uid:string,decision:'approved'|'rejected'){if(!user)return;const action=decision==='approved'?'aprovar':'rejeitar';if(!window.confirm('Confirma '+action+' este perfil?'))return;setWorking(uid);setNotice('');try{const token=await user.getIdToken();const res=await fetch('/api/admin/users/review',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({uid,decision})});const body=await res.json() as {error?:string};if(!res.ok)throw new Error(body.error??'Falha na análise');setItems(old=>old.filter(x=>x.uid!==uid));setNotice('Solicitação '+(decision==='approved'?'aprovada':'rejeitada')+' com registro de auditoria.');}catch(e){setNotice(e instanceof Error?e.message:'Falha na operação');}finally{setWorking('')}}
 async function reviewOrg(id:string,decision:'approved'|'rejected'){if(!user)return;if(!window.confirm('Confirma esta decisão sobre a organização?'))return;setWorking(id);setNotice('');try{const token=await user.getIdToken();const res=await fetch('/api/admin/organizations/review',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({id,decision})});const result=await res.json() as {error?:string};if(!res.ok)throw new Error(result.error??'Falha na análise');setOrganizations(old=>old.filter(o=>o.id!==id));setNotice('Organização analisada com registro de auditoria.')}catch(e){setNotice(e instanceof Error?e.message:'Erro ao analisar')}finally{setWorking('')}}
 return (
  <main className="admin-shell"><div className="admin-panel">
   <div className="eyebrow dark">ÁREA RESTRITA</div><h1>Painel Gestor</h1>
   {data ? <>
    <p>Identidade administrativa validada pelo servidor.</p>
    <div className="admin-detail"><strong>Conta:</strong> {data.email}<br/><strong>Perfil:</strong> Superadministrador</div>
    <section aria-label="Gestão de usuários"><h2>Solicitações de perfis</h2>
     <p>Analise os cadastros enviados pelos participantes. A aprovação não concede acesso administrativo.</p>
     <button className="button" disabled={loading||!user} onClick={()=>user&&void load(user)}>{loading?'Atualizando...':'Atualizar solicitações'}</button>
     <p role="status">{notice}</p>
     {!loading && items.length===0 ? <p className="muted">Nenhuma solicitação pendente encontrada.</p> :
      <div className="review-list">{items.map(item=><article key={item.uid} className="review-item">
       <div><strong>{item.displayName||'Sem nome'}</strong><p>{item.email} · {item.roleRequested}</p></div>
       <div className="review-actions"><button disabled={!!working} onClick={()=>void review(item.uid,'approved')}>Aprovar</button><button disabled={!!working} onClick={()=>void review(item.uid,'rejected')}>Rejeitar</button></div>
      </article>)}</div>}
    </section>
    <section aria-label="Gestão de organizações"><h2>Empresas e instituições pendentes</h2>{organizations.length===0?<p className="muted">Nenhuma organização pendente.</p>:<div className="review-list">{organizations.map(org=><article key={org.id} className="review-item"><div><strong>{org.name}</strong><p>{org.type} · {org.ownerEmail}</p></div><div className="review-actions"><button disabled={!!working} onClick={()=>void reviewOrg(org.id,'approved')}>Aprovar</button><button disabled={!!working} onClick={()=>void reviewOrg(org.id,'rejected')}>Rejeitar</button></div></article>)}</div>}</section>
    <h2>Outros módulos em desenvolvimento</h2>
    <div className="admin-modules"><span>Conteúdo institucional</span><span>Oportunidades e eventos</span><span>Auditoria e segurança</span></div>
    <button className="button" onClick={async()=>{const {auth}=createFirebaseClient();await signOut(auth);window.location.assign('/login')}}>Sair</button>
   </> : <><p role="status">{status}</p><a className="button" href="/login">Ir para login</a></>}
  </div></main>
 );
}
