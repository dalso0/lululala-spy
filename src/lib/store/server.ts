// 본부 서버(Firebase) 저장소
// - 학생: 익명 로그인 → 요원명 부여 → 복구 코드(가짜 이메일 + 비밀번호)를 같은 계정에 연결
// - 선생님: 구글 로그인 → firestore.rules 의 선생님 목록에 있으면 관제실 사용

import type { FirebaseApp } from "firebase/app";
import {
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentReference,
} from "firebase/firestore";
import { isValidRecoveryCode, makeCodename, makeRecoveryCode, normalizeRecoveryCode } from "../codename";
import { EMPTY_SPY, normalizePost, normalizeSpy, recordDailyInto, sortPosts } from "./normalize";
import { RestoreError } from "./errors";
import { DEFAULT_GAME, type Post, type SpyDoc, type SpyStore, type StartResult, type TeacherSession } from "./types";

// 복구 코드 → 로그인용 가짜 이메일. .invalid 는 실제로 존재할 수 없는 주소라 메일이 갈 일이 없다.
const recoveryEmail = (code: string) => `${code.toLowerCase()}@agent.invalid`;

const errCode = (e: unknown) => (e as { code?: string } | null)?.code ?? "";

export function createServerStore(app: FirebaseApp): SpyStore {
  const auth = getAuth(app);
  const db = getFirestore(app);
  const spyRef = (uid: string) => doc(db, "spies", uid) as DocumentReference;

  /** 누군가 로그인할 때까지 기다린다 (스스로 로그인시키지는 않음) */
  const waitForUser = () =>
    new Promise<User>((resolve) => {
      let unsub: (() => void) | null = null;
      let done = false;
      unsub = onAuthStateChanged(auth, (u) => {
        if (!u || done) return;
        done = true;
        queueMicrotask(() => unsub?.());
        resolve(u);
      });
    });

  /** 로그인 준비가 끝난 뒤 onSnapshot 을 거는 공통 틀 */
  const listenAfter = <T>(ready: Promise<T>, attach: (v: T) => () => void, onError: (e: unknown) => void) => {
    let unsub = () => {};
    let cancelled = false;
    ready
      .then((v) => {
        if (!cancelled) unsub = attach(v);
      })
      .catch(onError);
    return () => {
      cancelled = true;
      unsub();
    };
  };

  /* ───────── 요원 신분 ───────── */

  let startPromise: Promise<StartResult> | null = null;
  const start = () =>
    (startPromise ??= startImpl().catch((e) => {
      startPromise = null; // 다음에 다시 시도
      throw e;
    }));

  async function startImpl(): Promise<StartResult> {
    await auth.authStateReady();
    const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
    const ref = spyRef(user.uid);

    const { isNew, recoveryCode } = await runTransaction(db, async (t) => {
      const snap = await t.get(ref);
      if (snap.exists()) return { isNew: false, recoveryCode: normalizeSpy(snap.data()).recoveryCode };
      t.set(ref, { ...EMPTY_SPY, codename: makeCodename(user.uid) });
      return { isNew: true, recoveryCode: null };
    });

    // 아직 익명이면 복구 코드를 계정에 연결 (실패해도 게임은 계속)
    if (user.isAnonymous) await issueRecoveryCode(user, ref, recoveryCode);
    return { spyId: user.uid, isNew };
  }

  async function issueRecoveryCode(user: User, ref: DocumentReference, existing: string | null) {
    let code = existing ?? makeRecoveryCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      // 코드를 먼저 적어 두고 연결한다: 연결 직후 앱이 꺼져도 코드를 잃지 않도록
      await updateDoc(ref, { recoveryCode: code });
      try {
        await linkWithCredential(user, EmailAuthProvider.credential(recoveryEmail(code), code));
        return;
      } catch (e) {
        if (errCode(e) === "auth/email-already-in-use" || errCode(e) === "auth/credential-already-in-use") {
          code = makeRecoveryCode(); // 드물게 겹치면 새 코드로
          continue;
        }
        // 예: Firebase 콘솔에서 '이메일/비밀번호' 로그인을 아직 켜지 않음
        console.warn("[spy] 복구 코드 발급 실패", e);
        await updateDoc(ref, { recoveryCode: null }).catch(() => {});
        return;
      }
    }
  }

  async function updateSpy(uid: string, fn: (cur: SpyDoc) => SpyDoc | null) {
    const ref = spyRef(uid);
    await runTransaction(db, async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists()) throw new Error("요원 문서가 없습니다");
      const next = fn(normalizeSpy(snap.data()));
      if (next) t.set(ref, next);
    });
  }

  /* ───────── 선생님 ───────── */

  async function classify(user: User | null): Promise<TeacherSession> {
    if (!user || !user.providerData.some((p) => p.providerId === "google.com")) return { state: "signedOut" };
    try {
      // 선생님만 읽을 수 있는 문서. 읽히면 선생님(문서가 없어도 됨)
      await getDoc(doc(db, "config", "teacher"));
      return { state: "teacher", email: user.email };
    } catch {
      return { state: "notTeacher", email: user.email };
    }
  }

  return {
    mode: "server",

    async hasSession() {
      await auth.authStateReady();
      return auth.currentUser !== null;
    },

    start,

    subscribeSpy(onData, onError) {
      return listenAfter(
        start(),
        ({ spyId }) =>
          onSnapshot(
            spyRef(spyId),
            (snap) => {
              if (snap.exists()) onData(normalizeSpy(snap.data()));
            },
            onError,
          ),
        onError,
      );
    },

    async clearMission(missionId) {
      const { spyId } = await start();
      let gained = false;
      await updateSpy(spyId, (cur) => {
        if (cur.clearedMissions.includes(missionId)) return null;
        gained = true;
        const cleared = [...cur.clearedMissions, missionId];
        return { ...cur, clearedMissions: cleared, pixels: cleared.length };
      });
      return gained;
    },

    async recordDaily(orderIds) {
      const { spyId } = await start();
      let gained = false;
      await updateSpy(spyId, (cur) => {
        const next = recordDailyInto(cur, orderIds);
        gained = next.gained;
        return next.spy;
      });
      return gained;
    },

    async setFinalRoutine(sense) {
      const { spyId } = await start();
      await updateSpy(spyId, (cur) => ({ ...cur, finalRoutine: sense }));
    },

    async restore(input) {
      const code = normalizeRecoveryCode(input);
      if (!isValidRecoveryCode(code)) throw new RestoreError("format");

      await auth.authStateReady();
      const prev = auth.currentUser;
      // 이 폰에서 이미 깬 미션은 불러온 요원에게 합쳐 준다
      let carry: string[] = [];
      if (prev) {
        try {
          const snap = await getDoc(spyRef(prev.uid));
          if (snap.exists()) carry = normalizeSpy(snap.data()).clearedMissions;
        } catch {
          /* 없으면 말고 */
        }
      }

      let user: User;
      try {
        user = (await signInWithEmailAndPassword(auth, recoveryEmail(code), code)).user;
      } catch (e) {
        const c = errCode(e);
        if (c === "auth/network-request-failed") throw new RestoreError("network");
        if (c === "auth/too-many-requests") throw new RestoreError("tooMany");
        throw new RestoreError("notFound");
      }
      startPromise = null;

      if (carry.length && prev?.uid !== user.uid) {
        await updateSpy(user.uid, (cur) => {
          const merged = [...new Set([...cur.clearedMissions, ...carry])];
          if (merged.length === cur.clearedMissions.length) return null;
          return { ...cur, clearedMissions: merged, pixels: merged.length };
        }).catch((e) => console.warn("[spy] 진행도 합치기 실패", e));
      }
    },

    /* ───────── 글 ───────── */

    async submitPost(kind, text, flagged) {
      const { spyId } = await start();
      const spy = normalizeSpy((await getDoc(spyRef(spyId))).data());
      await setDoc(doc(db, "posts", `${spyId}_${kind}`), {
        authorId: spyId,
        codename: spy.codename,
        kind,
        text,
        status: "pending",
        flagged,
        createdAt: serverTimestamp(),
      });
    },

    subscribeMyPosts(onData, onError) {
      return listenAfter(
        start(),
        ({ spyId }) =>
          onSnapshot(
            query(collection(db, "posts"), where("authorId", "==", spyId)),
            (snap) => onData(toPosts(snap.docs)),
            onError,
          ),
        onError,
      );
    },

    subscribeApproved(kind, onData, onError) {
      return listenAfter(
        waitForUser(),
        () =>
          onSnapshot(
            query(collection(db, "posts"), where("status", "==", "approved"), where("kind", "==", kind)),
            (snap) => onData(toPosts(snap.docs)),
            onError,
          ),
        onError,
      );
    },

    /* ───────── 게임 설정 ───────── */

    subscribeGame(onData, onError) {
      return listenAfter(
        waitForUser(),
        () =>
          onSnapshot(
            doc(db, "config", "game"),
            (snap) => onData({ ...DEFAULT_GAME, endingOpen: snap.data()?.endingOpen === true }),
            onError,
          ),
        onError,
      );
    },

    /* ───────── 선생님 ───────── */

    teacher: {
      async session() {
        await auth.authStateReady();
        return classify(auth.currentUser);
      },
      async signIn() {
        const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
        startPromise = null;
        return classify(user);
      },
      async signOut() {
        await signOut(auth);
        startPromise = null;
      },
      subscribeAll(onData, onError) {
        return onSnapshot(collection(db, "posts"), (snap) => onData(toPosts(snap.docs)), onError);
      },
      async review(postId, status) {
        await updateDoc(doc(db, "posts", postId), { status, reviewedAt: serverTimestamp() });
      },
      async setEndingOpen(open) {
        await setDoc(doc(db, "config", "game"), { endingOpen: open });
      },
    },
  };
}

function toPosts(docs: { id: string; data: () => unknown }[]): Post[] {
  return sortPosts(docs.map((d) => normalizePost(d.id, d.data())).filter((p): p is Post => p !== null));
}
