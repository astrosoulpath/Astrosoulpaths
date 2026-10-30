import {BadRequestException,ServiceUnavailableException} from '@nestjs/common';
export const CORRECTION_FIELDS=['bio','languages','identityProof','certificates','experienceProofs'] as const;
export function requireCorrectionsReady(){
  if(process.env.ADMIN_MODERATION_WRITES_ENABLED!=='true'||process.env.ADMIN_MODERATION_SCHEMA_REVIEWED!=='true'||process.env.ADMIN_ASTROLOGER_CORRECTIONS_READY!=='true')throw new ServiceUnavailableException('Application corrections await reviewed schema activation');
}
export function validateCorrectionFields(requested:unknown,updates:unknown):asserts updates is Record<string,unknown>{
  if(!Array.isArray(requested)||requested.length<1||requested.some(k=>!CORRECTION_FIELDS.includes(k))||new Set(requested).size!==requested.length||!updates||typeof updates!=='object'||Array.isArray(updates))throw new BadRequestException('Requested corrections could not be validated');
  if(JSON.stringify(Object.keys(updates).sort())!==JSON.stringify([...requested].sort()))throw new BadRequestException('Submit only and all explicitly requested fields');
}
