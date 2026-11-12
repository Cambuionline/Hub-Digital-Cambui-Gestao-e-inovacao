# Fase 2 — segurança administrativa

Esta branch **não deve ser mesclada em main antes de homologação**.

1. Confirmar o e-mail administrativo no Firebase Authentication; cadastrar usuário não garante `emailVerified`.
2. Criar credenciais de conta de serviço com acesso mínimo e configurar apenas no servidor: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`. Nunca usar `NEXT_PUBLIC_` nessas credenciais.
3. Para atribuir a claim, executar o script localmente, em ambiente seguro, com `CONFIRM_INITIAL_ADMIN=admcambuionline@gmail.com node scripts/grant-initial-admin.mjs`. Não executar antes da verificação do e-mail e revisão de privilégios da conta de serviço.
4. Depois da alteração de claims, o usuário precisa renovar o token (sair e entrar).
5. Endpoint `GET /api/admin/me` exige `Authorization: Bearer <Firebase ID token>`; valida assinatura, revogação, conta ativa, e-mail verificado e claim `admin`.
6. **A página /admin atual ainda usa verificação no cliente e NÃO deve conter dados privilegiados**. Implementar sessão HttpOnly e proteção de rotas no servidor antes de publicar funcionalidades administrativas.
7. Firestore segue deny-all. Implementar regras por coleção e testes no Emulator antes de habilitar leitura/escrita.
8. MFA, rate limiting, CSRF e auditoria são pendências para homologação.
