// 화면 코드는 여기만 import 한다. 본부 서버(Firebase)인지 연습 모드(localStorage)인지는 몰라도 된다.

import type { FirebaseApp } from "firebase/app";
import { getFirebaseApp } from "../firebase";
import { createLocalStore } from "./local";
import type { SpyStore } from "./types";

export * from "./types";
export { RESTORE_MESSAGES, RestoreError } from "./errors";
export { EMPTY_SPY } from "./normalize";

let store: SpyStore | null = null;

/** 브라우저에서만 호출할 것 */
export function getSpyStore(): SpyStore {
  if (!store) {
    const app = getFirebaseApp();
    store = app ? lazyServerStore(app) : createLocalStore();
  }
  return store;
}

/**
 * Firebase 로그인·DB 코드(압축해도 100KB가 넘는다)는 첫 화면 묶음에서 빼고, 처음 쓰는 순간 따로 불러온다.
 * 연습 모드에서는 아예 내려받지 않는다. 겉모양(SpyStore)은 그대로라 화면 코드는 바뀌지 않는다.
 */
function lazyServerStore(app: FirebaseApp): SpyStore {
  let loading: Promise<SpyStore> | null = null;
  const load = () => (loading ??= import("./server").then((m) => m.createServerStore(app)));

  /** 불러온 뒤 구독을 건다 (그 사이 구독이 취소되면 걸지 않는다) */
  const subscribe = (attach: (s: SpyStore) => () => void, onError: (e: unknown) => void) => {
    let unsub = () => {};
    let cancelled = false;
    load()
      .then((s) => {
        if (!cancelled) unsub = attach(s);
      })
      .catch(onError);
    return () => {
      cancelled = true;
      unsub();
    };
  };

  return {
    mode: "server",
    hasSession: () => load().then((s) => s.hasSession()),
    start: () => load().then((s) => s.start()),
    subscribeSpy: (on, err) => subscribe((s) => s.subscribeSpy(on, err), err),
    clearMission: (id) => load().then((s) => s.clearMission(id)),
    recordDaily: (ids) => load().then((s) => s.recordDaily(ids)),
    setFinalRoutine: (sense) => load().then((s) => s.setFinalRoutine(sense)),
    restore: (code) => load().then((s) => s.restore(code)),
    submitPost: (kind, text, flagged) => load().then((s) => s.submitPost(kind, text, flagged)),
    subscribeMyPosts: (on, err) => subscribe((s) => s.subscribeMyPosts(on, err), err),
    subscribeApproved: (kind, on, err) => subscribe((s) => s.subscribeApproved(kind, on, err), err),
    subscribeGame: (on, err) => subscribe((s) => s.subscribeGame(on, err), err),
    teacher: {
      session: () => load().then((s) => s.teacher.session()),
      signIn: () => load().then((s) => s.teacher.signIn()),
      signOut: () => load().then((s) => s.teacher.signOut()),
      subscribeAll: (on, err) => subscribe((s) => s.teacher.subscribeAll(on, err), err),
      review: (id, status) => load().then((s) => s.teacher.review(id, status)),
      setEndingOpen: (open) => load().then((s) => s.teacher.setEndingOpen(open)),
    },
  };
}
