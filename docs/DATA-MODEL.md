# Modelo de dados — planejamento Fase 2

## Coleções propostas
- `users/{uid}`: displayName, email (servidor), roleRequested, status, createdAt, updatedAt. **Não confiar em role ou status fornecidos pelo cliente**.
- `organizations/{organizationId}`: name, type, description, status, createdAt.
- `memberships/{membershipId}`: uid, organizationId, role, status, createdAt.
- `opportunities/{id}`: organizationId, title, visibility, status, createdAt.
- `auditLogs/{id}`: actorUid, action, resource, timestamp; escrita somente backend.

## Fluxo de cadastro
1. Firebase Auth cria identidade com e-mail e senha.
2. E-mail precisa ser verificado.
3. Endpoint backend validará token e campos de perfil; persistência no Firestore será habilitada **após regras e testes no Emulator**.
4. Associação a organizações exige comprovação e aprovação; nunca conceder papel administrativo pelo formulário público.

## Estado atual
A página /cadastro cria somente a conta Firebase Auth e atualiza displayName; o perfil profissional escolhido não é persistido. Firestore permanece bloqueado por padrão. Não anunciar módulos de organização como ativos.
