# Persistência de perfis — Fase 2.3

## Modelo de segurança
- Firestore mantém **deny-all** para acesso direto do navegador.
- Somente o backend usa Firebase Admin SDK para ler/criar `users/{uid}`.
- A API valida Firebase ID Token com revogação, conta ativa e e-mail verificado.
- O UID e o e-mail são sempre obtidos do Firebase Authentication, nunca do corpo da requisição.
- `POST /api/profile` cria somente o documento do próprio usuário, por transação, com `status=pending_review` e `roleRequested` sem privilégios.
- Perfis existentes não são sobrescritos pelo POST; não há rota pública para conceder papéis, aprovar cadastros ou associar organizações.
- `GET /api/profile` consulta exclusivamente o próprio documento.
- `Authorization: Bearer <Firebase ID token>` é obrigatório.

## Variáveis privadas necessárias (Production e Preview)
`FIREBASE_ADMIN_PROJECT_ID=hub-digital-cambui`
`FIREBASE_ADMIN_CLIENT_EMAIL` e `FIREBASE_ADMIN_PRIVATE_KEY` da conta de serviço exclusiva do projeto. Nunca versionar valores reais. Configurar com privilégios mínimos e proteger o acesso às variáveis.

## Limitações para homologação
- Cadastro em Firebase Auth e criação do documento de perfil são passos separados; o usuário precisa entrar e concluir o perfil após verificar o e-mail.
- Falta implementar App Check, limitação de taxa distribuída, logging seguro e testes do Emulator.
- A criação de perfis ainda não foi homologada em Firebase real.
- Não liberar aprovação, escrita em outras coleções ou dados privados até implementar autorização, auditoria e testes.
