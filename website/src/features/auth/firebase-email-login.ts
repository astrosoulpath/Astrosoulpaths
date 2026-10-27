import { publicAuthRequest, type Portal } from "./public-auth";
/** Existing Firebase email identities only. No create, linking or legacy-provider fallback. */
export async function firebaseEmailPortalLogin(
  email: string,
  password: string,
  portal: Portal,
) {
  try {
    const [{ firebaseAuth }, { signInWithEmailAndPassword }] =
      await Promise.all([
        import("@/lib/firebaseClient"),
        import("firebase/auth"),
      ]);
    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      email.trim().toLowerCase(),
      password,
    );
    const idToken = await credential.user.getIdToken(true);
    const response = await publicAuthRequest("/auth/firebase/email", {
      idToken,
      portal,
    });
    if (firebaseAuth.currentUser?.uid !== credential.user.uid)
      throw Error("Account changed. Start sign-in again.");
    return response;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error)
      throw Error(
        "Firebase email sign-in was not authorized. Check your existing account and password, or choose its original sign-in method.",
      );
    throw error;
  }
}
