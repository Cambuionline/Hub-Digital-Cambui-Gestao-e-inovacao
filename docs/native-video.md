# Vídeo nativo — HUB Digital Cambuí

## Arquitetura
- Interface Next.js com SDK LiveKit Client (WebRTC).
- LiveKit SFU separado da Vercel, necessário para até quatro salas simultâneas.
- API `POST /api/live-video/token` autentica com Firebase, confere reserva e janela de 15 minutos antes do início até o encerramento, e verifica inscrição confirmada para participantes.
- Token LiveKit temporário de 30 minutos, vinculado à sala `hub-sala-N-SESSION_ID`.
- O gestor pode publicar áudio, câmera e compartilhamento de tela. Participantes têm permissão de visualização.
- Salas são isoladas pelo identificador da sessão; as quatro podem operar simultaneamente.
- A gravação, chat em tempo real, moderação, transmissão HLS, limites de audiência e controles avançados ainda não estão implementados.

## Variáveis necessárias na Vercel (Preview)
- `LIVEKIT_URL=wss://SEU-ENDPOINT-LIVEKIT`
- `LIVEKIT_API_KEY=...` (servidor apenas)
- `LIVEKIT_API_SECRET=...` (servidor apenas)

Nunca expor API_KEY e API_SECRET com prefixo `NEXT_PUBLIC_`. Não armazenar segredos no GitHub.

## Homologação
1. Provisionar um servidor LiveKit Cloud ou LiveKit autogerenciado, com TURN e TLS válidos.
2. Adicionar as três variáveis no ambiente Preview da Vercel e gerar novo deploy.
3. Criar uma atividade e inscrever um participante; abrir a sala na janela autorizada.
4. Gestor entra como apresentador, concede permissão de câmera/microfone e compartilha tela.
5. Participante autenticado entra como espectador, confirma áudio/vídeo; usuário não inscrito deve receber HTTP 403.
6. Testar quatro atividades simultâneas em salas diferentes, rede móvel, reconexão e encerramento.
7. Monitorar custos de minutos de participantes, tráfego, TURN e capacidade.

## Limitações
O status READY da Vercel só confirma o build, não a conectividade do LiveKit nem os testes de mídia. O SDK não cria por si só um servidor de vídeo. Sem as variáveis e o servidor, a API responde 503. A interface de transmissão externa permanece disponível como contingência.
