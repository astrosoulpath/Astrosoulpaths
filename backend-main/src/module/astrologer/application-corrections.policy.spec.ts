import {requireCorrectionsReady,validateCorrectionFields} from './application-corrections.policy';
import {moderationInput,moderationTransition} from '../admin/admin-moderation.policy';
describe('Owner-only application correction policy',()=>{
 const saved={...process.env};afterEach(()=>{process.env={...saved};});
 it('fails closed unless all three activation gates are true',()=>{
  delete process.env.ADMIN_ASTROLOGER_CORRECTIONS_READY;expect(()=>requireCorrectionsReady()).toThrow();
  process.env.ADMIN_MODERATION_WRITES_ENABLED='true';process.env.ADMIN_MODERATION_SCHEMA_REVIEWED='true';process.env.ADMIN_ASTROLOGER_CORRECTIONS_READY='true';expect(()=>requireCorrectionsReady()).not.toThrow();
 });
 it('accepts exactly requested fields',()=>expect(()=>validateCorrectionFields(['bio','languages'],{languages:['English'],bio:'Updated biography'})).not.toThrow());
 it.each([{bio:'bio',isApproved:true},{},{languages:[]},null])('rejects missing/extra or malformed changes: %j',updates=>expect(()=>validateCorrectionFields(['bio'],updates)).toThrow());
 it('rejects unsupported and duplicate request fields',()=>{expect(()=>validateCorrectionFields(['isApproved'],{isApproved:true})).toThrow();expect(()=>validateCorrectionFields(['bio','bio'],{bio:'bio'})).toThrow();});
 it('requires explicit requested fields in the Admin command',()=>{
  const body={requestId:'00000000-0000-4000-8000-000000000001',expectedVersion:0,reason:'Please correct your biography',action:'REQUEST_CHANGES'};
  expect(()=>moderationInput(body)).toThrow();expect(moderationInput({...body,requestedFields:['bio']})).toMatchObject({requestedFields:['bio']});
  expect(()=>moderationInput({...body,action:'APPROVE',requestedFields:['bio']})).toThrow();
 });
 it('cannot approve or verify while corrections are outstanding',()=>{
  expect(moderationTransition('ASTROLOGER','UNREVIEWED','REQUEST_CHANGES')).toBe('NEEDS_CHANGES');
  expect(()=>moderationTransition('ASTROLOGER','NEEDS_CHANGES','VERIFY')).toThrow();expect(()=>moderationTransition('ASTROLOGER','NEEDS_CHANGES','APPROVE')).toThrow();
  expect(()=>moderationTransition('CUSTOMER','ACTIVE','REQUEST_CHANGES')).toThrow();
 });
});
