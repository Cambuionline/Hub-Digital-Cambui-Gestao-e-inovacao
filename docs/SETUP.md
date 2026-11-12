# Configuração inicial

1. Instalar Node.js 22 e executar `npm install` e `npm run build`.
2. Criar projeto Firebase exclusivo para o HUB.
3. Habilitar Firebase Authentication (e-mail/senha e Google) e verificação de e-mail.
4. Criar Firestore; as regras atuais negam todo acesso por segurança. **Não abrir regras indiscriminadamente.**
5. Configurar variáveis `NEXT_PUBLIC_FIREBASE_*` na Vercel e os domínios autorizados no Firebase Auth.
6. Criar atribuição administrativa segura com Firebase Admin SDK, custom claims e auditoria; não conceder acesso apenas por e-mail no frontend.
7. Implementar MFA, verificação server-side e políticas RBAC antes de liberar painel ou dados.
8. Não implantar como produção antes de executar build, testes e homologação.

A Fase 1 é um esqueleto funcional de navegação/autenticação, **não** a plataforma completa.
