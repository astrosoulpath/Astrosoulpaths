import { beginPublicAuthAttempt, commitPortalSession, publicAuthRequest } from '@/features/auth/public-auth';

/** Explicit applicant intent; the backend alone authorizes the new context. */
export async function beginApplicationForCurrentCustomer() {
  const descriptor = JSON.parse(localStorage.getItem('asp_user') || '{}');
  if (descriptor.portal !== 'customer' || typeof descriptor.id !== 'string' || !descriptor.id)
    throw Error('Sign in with your existing Customer account before starting an application.');
  const isCurrent = beginPublicAuthAttempt();
  const { firebaseAuth } = await import('@/lib/firebaseClient');
  await firebaseAuth.authStateReady();
  const firebaseUser = firebaseAuth.currentUser;
  if (!firebaseUser) throw Error('Verify your existing Firebase account before applying.');
  const proof = await firebaseUser.getIdTokenResult(true);
  if (!isCurrent() || firebaseAuth.currentUser?.uid !== firebaseUser.uid)
    throw Error('Account changed. Reopen your application.');
  const provider = proof.signInProvider;
  if (provider !== 'password' && provider !== 'google.com')
    throw Error('Use your verified Google or Email Customer identity.');
  const result = await publicAuthRequest(provider === 'password' ? '/auth/firebase/email' : '/auth/firebase/google', {
    idToken: proof.token, portal: 'joinAstrologer',
  });
  if (!isCurrent() || firebaseAuth.currentUser?.uid !== firebaseUser.uid || result.user?.id !== descriptor.id)
    throw Error('The application account could not be verified.');
  if (result.authContext !== 'astrologer') throw Error('Applicant context was not authorized.');
  commitPortalSession(result, 'astrologer');
}
