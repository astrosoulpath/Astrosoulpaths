import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { localAuthEmulator } from "./local-firebase-emulator";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);

const emulator = typeof window === "undefined" ? null : localAuthEmulator({
  enabled: process.env.NEXT_PUBLIC_ASP_ISOLATED_E2E,
  project: firebaseConfig.projectId,
  host: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
  api: process.env.NEXT_PUBLIC_API_BASE_URL,
  hostname: typeof window === "undefined" ? "" : window.location.hostname,
  mode: process.env.NODE_ENV,
});
if (emulator && !firebaseAuth.emulatorConfig) connectAuthEmulator(firebaseAuth, emulator);

export default firebaseApp;
