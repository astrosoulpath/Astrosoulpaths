import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AI_LANGUAGES, aiLanguageAvailable, aiLanguageInstruction, detectAiLanguage, resolveAiLanguage } from './ai-language-policy';
import { OpenAiAstroProvider } from '../providers/openai-astro.provider';
import { AiAstroCategory } from './ai-astro-category';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { safeAiStreamError } from './ai-safe-error';

describe('AI chat language rollout and privacy', () => {
  it('redacts provider/private error text while retaining balance and language codes', () => {
    expect(safeAiStreamError(new Error('private birth data token https://secret'))).toBe('AI_ASTRO_STREAM_FAILED');
    expect(safeAiStreamError(new BadRequestException('INSUFFICIENT_BALANCE'))).toBe('INSUFFICIENT_BALANCE');
    expect(safeAiStreamError(new BadRequestException({code:'AI_LANGUAGE_NOT_VALIDATED',message:'private'}))).toBe('AI_LANGUAGE_NOT_VALIDATED');
    expect(safeAiStreamError(new UnauthorizedException('private token'))).toBe('AUTHENTICATION_REQUIRED');
  });
  it('keeps the reviewed JSON registry and compiled catalog identical', () => {
    expect(AI_LANGUAGES).toEqual(JSON.parse(readFileSync(join(__dirname,'ai-language-catalog.json'),'utf8')));
    expect(new Set(AI_LANGUAGES.map(row => row.code)).size).toBe(21);
    expect(AI_LANGUAGES.filter(row => row.enabled).map(row => row.code)).toEqual(['en','hi','hi-Latn']);
    expect(AI_LANGUAGES.every(row => !row.humanReviewed)).toBe(true);
  });
  it.each([['मुझे मेरी शादी के बारे में बताइए','hi'],['meri shaadi kab hogi','hi-Latn'],['hello','en']])('resolves initial message hint %s', (text, code) => {
    expect(resolveAiLanguage('auto', text)).toBe(code);
  });
  it('lets manual preference override detection without modifying original text', () => {
    const question='मेरी शादी कब होगी?';expect(resolveAiLanguage('en',question)).toBe('en');expect(question).toBe('मेरी शादी कब होगी?');
    expect(resolveAiLanguage(undefined,'123', 'hi')).toBe('hi');
    expect(() => resolveAiLanguage('auto','123','fr')).toThrow('not enabled');
  });
  it.each(AI_LANGUAGES.filter(row=>!row.enabled).map(row=>[row.code]))('rejects unverified language %s', code=>{
    expect(()=>resolveAiLanguage(code,'synthetic')).toThrow('not enabled');
  });
  it.each(['مرحبا','آپ کیسے ہیں','मराठी भाषा आहे','你好','bonjour comment allez vous'])('does not silently answer a recognized unsupported script/language in English', text=>{
    expect(detectAiLanguage(text)).not.toBeNull();expect(()=>resolveAiLanguage('auto',text)).toThrow();
  });
  it('keeps Sanskrit explanation and calculation immutability in the language contract',()=>{
    const instruction=aiLanguageInstruction('hi-Latn');expect(instruction).toContain('Latin script');expect(instruction).toContain('never change astronomical');expect(instruction).toContain('Lagna');
  });
  it('keeps Arabic and Urdu direction metadata without enabling either language',()=>{
    for(const code of ['ar','ur'])expect(AI_LANGUAGES.find(row=>row.code===code)).toMatchObject({direction:'rtl',enabled:false});
  });
  it('requires every review gate before enabling an additional language', () => {
    const row={enabled:true,baseline:false,humanReviewed:false,translationValidated:false,responseValidated:false};
    expect(aiLanguageAvailable(row)).toBe(false);
    expect(aiLanguageAvailable({...row,humanReviewed:true,translationValidated:true})).toBe(false);
    expect(aiLanguageAvailable({...row,humanReviewed:true,translationValidated:true,responseValidated:true})).toBe(true);
  });
  it('uses identical language policy for streaming and normal requests without extra provider calls',async()=>{
    const provider=new OpenAiAstroProvider();
    const create=jest.fn(async(options:any)=>options.stream?(async function*(){yield {type:'response.output_text.delta',delta:'नमस्ते'};yield {type:'response.completed',response:{status:'completed',usage:{}}};})():{output_text:'नमस्ते',usage:{}});
    (provider as any).client={responses:{create}};
    const input={question:'Synthetic English question',category:AiAstroCategory.GENERAL,responseLanguage:'hi',astrologyContext:{planet:{degree:123.4}}};
    const before=JSON.stringify(input.astrologyContext);
    await provider.generate(input);await provider.generateStream(input,()=>undefined);
    expect(create).toHaveBeenCalledTimes(2);
    for(const [options] of create.mock.calls as any) {expect(options.instructions).toContain('RESPONSE_LANGUAGE_POLICY');expect(options.instructions).toContain('हिन्दी');expect(options.max_output_tokens).toBe(800);}
    expect(JSON.stringify(input.astrologyContext)).toBe(before);
  });
});
