'use client';
import {useEffect,useRef,useState} from 'react';
import {Room,RoomEvent,Track,type RemoteParticipant,type RemoteTrackPublication} from 'livekit-client';
import type {User} from 'firebase/auth';
type Props={user:User;roomId:string;sessionId:string;enabled:boolean};
export default function NativeVideo({user,roomId,sessionId,enabled}:Props){
 const [room,setRoom]=useState<Room|null>(null),[state,setState]=useState('Desconectado'),[error,setError]=useState(''),[mic,setMic]=useState(false),[cam,setCam]=useState(false),[role,setRole]=useState('viewer'),[participants,setParticipants]=useState(0);
 const localVideo=useRef<HTMLVideoElement>(null),remoteVideo=useRef<HTMLDivElement>(null),current=useRef<Room|null>(null);
 useEffect(()=>()=>{void current.current?.disconnect()},[]);
 async function connect(){
  setError('');setState('Conectando...');
  const connection=new Room({adaptiveStream:true,dynacast:true});
  try{
   const auth=await user.getIdToken();
   const response=await fetch('/api/live-video/token',{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify({room:roomId,id:sessionId})});
   const data=await response.json();if(!response.ok)throw Error(data.error??'Falha na autorização');
   setRole(data.role);
   connection.on(RoomEvent.ParticipantConnected,()=>setParticipants(connection.remoteParticipants.size));
   connection.on(RoomEvent.ParticipantDisconnected,()=>setParticipants(connection.remoteParticipants.size));
   const renderRemote=(publication:RemoteTrackPublication,participant:RemoteParticipant)=>{
    const track=publication.track;if(!track||!remoteVideo.current)return;
    const el=track.attach();el.setAttribute('data-track',participant.identity+'-'+publication.trackSid);
    el.style.width='100%';el.style.maxHeight='440px';el.style.objectFit='contain';
    remoteVideo.current.appendChild(el);
   };
   connection.on(RoomEvent.TrackSubscribed,renderRemote);
   connection.on(RoomEvent.TrackUnsubscribed,(track)=>track.detach().forEach(el=>el.remove()));
   connection.on(RoomEvent.Disconnected,()=>{setState('Desconectado');setRoom(null);setMic(false);setCam(false)});
   await connection.connect(data.serverUrl,data.token);
   current.current=connection;setRoom(connection);setState('Conectado');setParticipants(connection.remoteParticipants.size);
   for(const participant of connection.remoteParticipants.values())for(const pub of participant.trackPublications.values())if(pub.isSubscribed)renderRemote(pub,participant);
  }catch(e){await connection.disconnect();setState('Desconectado');setError(e instanceof Error?e.message:'Falha na conexão')}
 }
 async function toggleMic(){if(!room||role!=='presenter')return;try{if(mic){await room.localParticipant.setMicrophoneEnabled(false);setMic(false)}else{await room.localParticipant.setMicrophoneEnabled(true);setMic(true)}}catch(e){setError(e instanceof Error?e.message:'Microfone indisponível')}}
 async function toggleCam(){if(!room||role!=='presenter')return;try{if(cam){await room.localParticipant.setCameraEnabled(false);setCam(false)}else{await room.localParticipant.setCameraEnabled(true);const publication=room.localParticipant.getTrackPublication(Track.Source.Camera);if(publication?.track&&localVideo.current)publication.track.attach(localVideo.current);setCam(true)}}catch(e){setError(e instanceof Error?e.message:'Câmera indisponível')}}
 async function shareScreen(){if(!room||role!=='presenter')return;try{await room.localParticipant.setScreenShareEnabled(true)}catch(e){setError(e instanceof Error?e.message:'Não foi possível compartilhar a tela')}}
 async function leave(){await room?.disconnect();current.current=null;setRoom(null);setState('Desconectado');setMic(false);setCam(false);if(remoteVideo.current)remoteVideo.current.replaceChildren()}
 return <section style={{marginTop:20,border:'1px solid #d4ddeb',padding:20,borderRadius:14}}><h2>Vídeo nativo · WebRTC</h2><p role="status">{state} · {participants} participantes remotos · {role==='presenter'?'Apresentador':'Participante'}</p>{error&&<p role="alert" style={{color:'#b32c38'}}>{error}</p>}<div ref={remoteVideo} style={{background:'#101d33',minHeight:180,borderRadius:10,display:'grid',gap:8,padding:8}}/><video ref={localVideo} muted autoPlay playsInline style={{width:220,maxWidth:'100%',marginTop:10,borderRadius:8}}/><div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14}}>{!room?<button disabled={!enabled||state==='Conectando...'} onClick={()=>void connect()}>Entrar no vídeo nativo</button>:<><button disabled={role!=='presenter'} onClick={()=>void toggleMic()}>{mic?'Desativar microfone':'Ativar microfone'}</button><button disabled={role!=='presenter'} onClick={()=>void toggleCam()}>{cam?'Desativar câmera':'Ativar câmera'}</button><button disabled={role!=='presenter'} onClick={()=>void shareScreen()}>Compartilhar tela</button><button onClick={()=>void leave()}>Sair da transmissão</button></>}</div><p style={{fontSize:13,color:'#53617a'}}>Apenas o gestor publica áudio, vídeo e tela nesta primeira versão. Os participantes assistem. A infraestrutura LiveKit deve estar configurada para conectar.</p></section>
}
