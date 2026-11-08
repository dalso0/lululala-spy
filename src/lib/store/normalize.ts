import { isDailyOrderId } from "../daily";
import type { Sense } from "../missions";
import type { Post, PostKind, PostStatus, SpyDoc } from "./types";

const DAILY_MISSION_ID = "m0_daily";

const SENSES: Sense[] = ["sight", "hearing", "smell", "taste", "touch"];
const KINDS: PostKind[] = ["mirror", "routine"];
const STATUSES: PostStatus[] = ["pending", "approved", "rejected"];

export const EMPTY_SPY: SpyDoc = {
  isLoggedIn: true,
  codename: "",
  recoveryCode: null,
  pixels: 0,
  clearedMissions: [],
  dailyDone: [],
  finalRoutine: null,
};

/** 저장된 값이 어떤 모양이든 SpyDoc 으로 맞춘다 */
export function normalizeSpy(raw: unknown): SpyDoc {
  const d = (raw ?? {}) as Record<string, unknown>;
  const strings = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : [];
  const cleared = strings(d.clearedMissions);
  return {
    isLoggedIn: true,
    codename: typeof d.codename === "string" ? d.codename : "",
    recoveryCode: typeof d.recoveryCode === "string" ? d.recoveryCode : null,
    clearedMissions: cleared,
    // 픽셀 수는 항상 깬 미션 수와 같게 (중복 지급 방지)
    pixels: cleared.length,
    dailyDone: strings(d.dailyDone).slice(0, 20),
    finalRoutine: SENSES.includes(d.finalRoutine as Sense) ? (d.finalRoutine as Sense) : null,
  };
}

/** Firestore Timestamp · 숫자 · 없음 → ms */
function toMillis(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (v && typeof (v as { toMillis?: unknown }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  return null;
}

export function normalizePost(id: string, raw: unknown): Post | null {
  const d = (raw ?? {}) as Record<string, unknown>;
  if (typeof d.text !== "string" || !KINDS.includes(d.kind as PostKind)) return null;
  return {
    id,
    authorId: typeof d.authorId === "string" ? d.authorId : "",
    codename: typeof d.codename === "string" ? d.codename : "익명 요원",
    kind: d.kind as PostKind,
    text: d.text,
    status: STATUSES.includes(d.status as PostStatus) ? (d.status as PostStatus) : "pending",
    flagged: d.flagged === true,
    // 서버 시간이 아직 안 찍힌 직후(로컬 반영)에는 지금 시각으로 본다
    createdAt: toMillis(d.createdAt) ?? Date.now(),
    reviewedAt: toMillis(d.reviewedAt),
  };
}

/** 최신 글이 위로 */
export const sortPosts = (posts: Post[]) => [...posts].sort((a, b) => b.createdAt - a.createdAt);

/**
 * 평범지령 보고를 요원 문서에 반영한 결과. 서버·연습 모드가 같은 규칙을 쓰도록 한곳에 둔다.
 * - 처음 보고하면 제1구역 미션(m0_daily) 완료 → 픽셀 +1
 * - 바뀐 게 없으면 spy 는 null
 */
export function recordDailyInto(cur: SpyDoc, orderIds: string[]): { spy: SpyDoc | null; gained: boolean } {
  const valid = orderIds.filter(isDailyOrderId);
  const dailyDone = [...new Set([...cur.dailyDone, ...valid])];
  const gained = dailyDone.length > 0 && !cur.clearedMissions.includes(DAILY_MISSION_ID);
  if (!gained && dailyDone.length === cur.dailyDone.length) return { spy: null, gained: false };
  const cleared = gained ? [...cur.clearedMissions, DAILY_MISSION_ID] : cur.clearedMissions;
  return { spy: { ...cur, dailyDone, clearedMissions: cleared, pixels: cleared.length }, gained };
}
