// 연습 모드 저장소: Firebase 설정이 없을 때 이 브라우저(localStorage)에만 저장한다.
// 서버 모드와 똑같은 흐름(요원명·복구 코드·글 검토·연구소 개방)을 한 브라우저 안에서 흉내 낸다.

import { isValidRecoveryCode, makeCodename, makeRecoveryCode, normalizeRecoveryCode } from "../codename";
import { RestoreError } from "./errors";
import { EMPTY_SPY, normalizePost, normalizeSpy, recordDailyInto, sortPosts } from "./normalize";
import { DEFAULT_GAME, type GameConfig, type Post, type SpyDoc, type SpyStore } from "./types";

const KEYS = {
  id: "spy-id",
  spy: "spy-v1",
  registry: "spy-registry", // 복구 코드 → 요원 (연습 모드에서 '이어하기'를 흉내 내려고)
  posts: "spy-posts",
  game: "spy-game",
} as const;

type Topic = "spy" | "posts" | "game";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 사생활 보호 모드 등 */
  }
}

export function createLocalStore(): SpyStore {
  const listeners: Record<Topic, Set<() => void>> = { spy: new Set(), posts: new Set(), game: new Set() };
  const emit = (topic: Topic) => listeners[topic].forEach((l) => l());
  const listen = (topic: Topic, fn: () => void) => {
    listeners[topic].add(fn);
    queueMicrotask(fn);
    return () => {
      listeners[topic].delete(fn);
    };
  };

  if (typeof window !== "undefined") {
    // 다른 탭(예: 관제실)에서 바꾼 것도 반영
    window.addEventListener("storage", (e) => {
      if (e.key === KEYS.spy) emit("spy");
      if (e.key === KEYS.posts) emit("posts");
      if (e.key === KEYS.game) emit("game");
    });
  }

  const spyId = () => {
    try {
      return localStorage.getItem(KEYS.id);
    } catch {
      return null;
    }
  };
  const readSpy = (): SpyDoc => normalizeSpy(readJSON(KEYS.spy, EMPTY_SPY));
  const writeSpy = (spy: SpyDoc) => {
    writeJSON(KEYS.spy, spy);
    const id = spyId();
    if (spy.recoveryCode && id) {
      const registry = readJSON<Record<string, { id: string; spy: SpyDoc }>>(KEYS.registry, {});
      registry[spy.recoveryCode] = { id, spy };
      writeJSON(KEYS.registry, registry);
    }
    emit("spy");
  };

  const readPosts = (): Post[] =>
    readJSON<unknown[]>(KEYS.posts, [])
      .map((p) => normalizePost((p as { id?: string }).id ?? "", p))
      .filter((p): p is Post => p !== null);
  const writePosts = (posts: Post[]) => {
    writeJSON(KEYS.posts, posts);
    emit("posts");
  };

  const readGame = (): GameConfig => ({ ...DEFAULT_GAME, ...readJSON<Partial<GameConfig>>(KEYS.game, {}) });

  const start = async () => {
    let id = spyId();
    const isNew = !id;
    if (!id) {
      id = crypto.randomUUID();
      try {
        localStorage.setItem(KEYS.id, id);
      } catch {}
    }
    const cur = readSpy();
    if (!cur.codename || !cur.recoveryCode) {
      writeSpy({
        ...cur,
        codename: cur.codename || makeCodename(id),
        recoveryCode: cur.recoveryCode ?? makeRecoveryCode(),
      });
    }
    return { spyId: id, isNew };
  };

  return {
    mode: "local",

    async hasSession() {
      return spyId() !== null;
    },

    start,

    subscribeSpy(onData) {
      return listen("spy", () => onData(readSpy()));
    },

    async clearMission(missionId) {
      await start();
      const cur = readSpy();
      if (cur.clearedMissions.includes(missionId)) return false;
      const cleared = [...cur.clearedMissions, missionId];
      writeSpy({ ...cur, clearedMissions: cleared, pixels: cleared.length });
      return true;
    },

    async recordDaily(orderIds) {
      await start();
      const { spy, gained } = recordDailyInto(readSpy(), orderIds);
      if (spy) writeSpy(spy);
      return gained;
    },

    async setFinalRoutine(sense) {
      await start();
      writeSpy({ ...readSpy(), finalRoutine: sense });
    },

    async restore(input) {
      const code = normalizeRecoveryCode(input);
      if (!isValidRecoveryCode(code)) throw new RestoreError("format");
      const found = readJSON<Record<string, { id: string; spy: SpyDoc }>>(KEYS.registry, {})[code];
      if (!found) throw new RestoreError("notFound");
      const carry = readSpy().clearedMissions;
      const merged = [...new Set([...normalizeSpy(found.spy).clearedMissions, ...carry])];
      try {
        localStorage.setItem(KEYS.id, found.id);
      } catch {}
      writeSpy({ ...normalizeSpy(found.spy), clearedMissions: merged, pixels: merged.length });
    },

    async submitPost(kind, text, flagged) {
      const { spyId: id } = await start();
      const postId = `${id}_${kind}`;
      const post: Post = {
        id: postId,
        authorId: id,
        codename: readSpy().codename,
        kind,
        text,
        status: "pending",
        flagged,
        createdAt: Date.now(),
        reviewedAt: null,
      };
      writePosts([...readPosts().filter((p) => p.id !== postId), post]);
    },

    subscribeMyPosts(onData) {
      return listen("posts", () => {
        const id = spyId();
        onData(sortPosts(readPosts().filter((p) => p.authorId === id)));
      });
    },

    subscribeApproved(kind, onData) {
      return listen("posts", () =>
        onData(sortPosts(readPosts().filter((p) => p.status === "approved" && p.kind === kind))),
      );
    },

    subscribeGame(onData) {
      return listen("game", () => onData(readGame()));
    },

    teacher: {
      // 연습 모드에서는 누구나 관제실을 써 볼 수 있다
      async session() {
        return { state: "teacher", email: null };
      },
      async signIn() {
        return { state: "teacher", email: null };
      },
      async signOut() {},
      subscribeAll(onData) {
        return listen("posts", () => onData(sortPosts(readPosts())));
      },
      async review(postId, status) {
        writePosts(readPosts().map((p) => (p.id === postId ? { ...p, status, reviewedAt: Date.now() } : p)));
      },
      async setEndingOpen(open) {
        writeJSON(KEYS.game, { ...readGame(), endingOpen: open });
        emit("game");
      },
    },
  };
}
