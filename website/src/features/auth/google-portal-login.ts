/** Firebase proof becomes a website session only after backend authorization. */
import { publicAuthRequest, type Portal } from './public-auth';
import type { Auth, User } from 'firebase/auth';
const pendingKey = 'asp_google_redirect', maxAge = 10 * 60 * 1000;
let inFlight = false;
export function googleLoginError(error: unknown): Error {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const messages: Record<string, string> = {
        'auth/popup-closed-by-user': 'Google sign-in was cancelled. You can try again when ready.',
        'auth/cancelled-popup-request': 'Google sign-in was cancelled. Use only one sign-in window.',
        'auth/popup-blocked': 'Your browser blocked the Google window. Allow popups or use the redirect option below.',
        'auth/operation-not-supported-in-this-environment': 'This browser cannot open Google sign-in. Try the redirect option or another browser.',
        'auth/unauthorized-domain': 'Google sign-in is not authorized for this website domain. Ask the operator to verify Firebase authorized domains.',
        'auth/network-request-failed': 'Google could not be reached. Check your connection and retry.',
        'auth/operation-not-allowed': 'Google sign-in is not enabled for this Firebase app. Contact support.',
        'auth/account-exists-with-different-credential': 'Use your existing sign-in method. Linking Google requires verified ownership; no accounts have been merged.',
        'auth/web-storage-unsupported': 'Google sign-in requires browser storage. Allow site storage or use another browser.'
    };
    const result = new Error(messages[code] || (error instanceof Error && !code ? error.message : 'Google sign-in could not be completed. Please retry or use your existing sign-in method.'));
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(code))
        result.name = 'GoogleRedirectRecommended';
    return result;
}
export function hasGoogleRedirect(portal: Portal) { try {
    const p = JSON.parse(sessionStorage.getItem(pendingKey) || 'null');
    return p?.portal === portal && Number.isFinite(p.at) && Date.now() >= p.at && Date.now() - p.at < maxAge;
}
catch {
    return false;
} }
async function proof(auth: Auth, user: User) { const idToken = await user.getIdToken(true); if (auth.currentUser?.uid !== user.uid)
    throw Error('The selected account changed. Please start sign-in again.'); return idToken; }
export async function googlePortalLogin(portal: Portal, mode: 'popup' | 'redirect' | 'complete' = 'popup', isCurrent: () => boolean = () => true) {
    if (inFlight)
        throw Error('Google sign-in is already in progress.');
    inFlight = true;
    try {
        const [{ firebaseAuth }, sdk] = await Promise.all([import('@/lib/firebaseClient'), import('firebase/auth')]);
        const provider = new sdk.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        if (mode === 'redirect') {
            sessionStorage.setItem(pendingKey, JSON.stringify({ portal, at: Date.now() }));
            try {
                await sdk.signInWithRedirect(firebaseAuth, provider);
            }
            catch (error) {
                sessionStorage.removeItem(pendingKey);
                throw error;
            }
            return null;
        }
        let credential;
        if (mode === 'complete') {
            if (!hasGoogleRedirect(portal))
                throw Error('Google redirect sign-in expired. Start sign-in again.');
            sessionStorage.removeItem(pendingKey);
            credential = await sdk.getRedirectResult(firebaseAuth);
            if (!credential)
                throw Error('Google redirect did not return a sign-in result. Allow site storage and try the popup option.');
        }
        else {
            sessionStorage.removeItem(pendingKey);
            credential = await sdk.signInWithPopup(firebaseAuth, provider);
        }
        if (!isCurrent())
            throw Error('Sign-in changed. Please start again.');
        const idToken = await proof(firebaseAuth, credential.user);
        if (!isCurrent())
            throw Error('Sign-in changed. Please start again.');
        const response = await publicAuthRequest('/auth/firebase/google', { idToken, portal });
        if (firebaseAuth.currentUser?.uid !== credential.user.uid)
            throw Error('The selected account changed. Please start sign-in again.');
        return response;
    }
    catch (error) {
        throw googleLoginError(error);
    }
    finally {
        inFlight = false;
    }
}
