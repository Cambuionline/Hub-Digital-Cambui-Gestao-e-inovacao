export const ORGANIZATION_TYPES=['startup','empresa','ict','instituicao_publica','instituicao_privada','associacao','parque_tecnologico','investidor_institucional'] as const;
export const USER_ROLES=['usuario','empreendedor','investidor','mentor','prestador_servicos','diretor_hub','coordenador_adm','marketing','comunicacao','superadmin'] as const;
export type OrganizationType=typeof ORGANIZATION_TYPES[number];
export type UserRole=typeof USER_ROLES[number];
export type MembershipRole='owner'|'admin'|'member';
export const INITIAL_PROFILE_STATUS='pending_review' as const;
