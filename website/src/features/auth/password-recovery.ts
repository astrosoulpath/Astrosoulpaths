import type { SupabaseClient } from '@supabase/supabase-js';
let recoveryClient: SupabaseClient | undefined;
const marker = 'asp-password-recovery-request-v1';
async function legacyRecovery() {
  if (!recoveryClient) {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw Error('Recovery is not configured. Contact support.');
    recoveryClient = createClient(url, key, {auth:{storageKey:'asp-password-recovery-provider-v1',
      storage:sessionStorage, persistSession:true, autoRefreshToken:false, detectSessionInUrl:false, flowType:'pkce'}});
  }
  return recoveryClient;
}
export async function requestPasswordRecovery(email: string, provider: 'firebase' | 'legacy') {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw Error('Enter a valid email address.');
  if(provider === 'firebase') {
    const [{firebaseAuth},{sendPasswordResetEmail}] = await Promise.all([import('@/lib/firebaseClient'),import('firebase/auth')]);
    try { await sendPasswordResetEmail(firebaseAuth,email.trim(),{url:window.location.origin+'/login?method=email'}); }
    catch(error) {if((error as {code?:string})?.code !== 'auth/user-not-found') throw Error('Recovery could not be requested. Try your original sign-in method or contact support.');}
  } else {
    const client=await legacyRecovery();
    sessionStorage.setItem(marker,String(Date.now()));
    const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/reset-password?provider=legacy'});
    if(error){sessionStorage.removeItem(marker);throw Error('Recovery could not be requested. Try later or contact support.');}
  }
}
export async function finishPasswordRecovery(provider:'firebase'|'legacy',code:string,password:string) {
  if(!code || code.length>4096 || password.length<8 || password.length>72) throw Error('A valid recovery link and password of 8–72 characters are required.');
  if(provider==='firebase') {
    const [{firebaseAuth},{verifyPasswordResetCode,confirmPasswordReset}]=await Promise.all([import('@/lib/firebaseClient'),import('firebase/auth')]);
    await verifyPasswordResetCode(firebaseAuth,code); await confirmPasswordReset(firebaseAuth,code,password);
  } else {
    const started=Number(sessionStorage.getItem(marker));
    if(!started || Date.now()-started>20*60*1000 || started>Date.now()) throw Error('Request a fresh reset link in this browser tab.');
    const client=await legacyRecovery();const exchanged=await client.auth.exchangeCodeForSession(code);
    if(exchanged.error || !exchanged.data.session) throw Error('Recovery link is invalid or expired.');
    const verified=await client.auth.getUser();if(verified.error || !verified.data.user) throw Error('Recovery could not be verified.');
    const updated=await client.auth.updateUser({password});if(updated.error) throw Error('Password could not be updated. Request a fresh link.');
    await client.auth.signOut({scope:'local'});sessionStorage.removeItem(marker);
  }
}
