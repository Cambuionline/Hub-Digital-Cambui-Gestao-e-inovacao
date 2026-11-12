import {ORGANIZATION_TYPES,USER_ROLES} from './roles';
export type ProfileInput={displayName:string;role:string;organizationName?:string;organizationType?:string;description?:string};
export function validateProfile(input:ProfileInput){
 const errors:string[]=[];const name=input.displayName?.trim()??'';
 if(name.length<2||name.length>120)errors.push('Nome deve conter entre 2 e 120 caracteres.');
 if(!USER_ROLES.includes(input.role as typeof USER_ROLES[number])||['superadmin','diretor_hub','coordenador_adm','marketing','comunicacao'].includes(input.role))errors.push('Perfil solicitado não permitido no cadastro público.');
 if(input.organizationType&&!ORGANIZATION_TYPES.includes(input.organizationType as typeof ORGANIZATION_TYPES[number]))errors.push('Tipo de organização inválido.');
 if(input.organizationName&&input.organizationName.length>160)errors.push('Nome da organização muito longo.');
 if(input.description&&input.description.length>1000)errors.push('Descrição muito longa.');
 return {valid:errors.length===0,errors,normalized:{displayName:name,role:input.role,organizationName:input.organizationName?.trim()??'',organizationType:input.organizationType??'',description:input.description?.trim()??''}};
}
