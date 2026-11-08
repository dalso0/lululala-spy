import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

// Firebase 웹 설정값은 비밀번호가 아니라 공개용 식별자다(보안은 firestore.rules 가 맡는다).
// .env.local 에 값을 넣으면 본부 서버(Firestore)에 저장되고, 비어 있으면 이 폰에만 저장된다.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.projectId && config.appId,
);

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  return getApps()[0] ?? initializeApp(config);
}
