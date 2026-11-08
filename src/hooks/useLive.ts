"use client";

import { useEffect, useState } from "react";
import { DEFAULT_GAME, getSpyStore, type GameConfig, type Post, type PostKind } from "@/lib/store";

/** 구독형 데이터 공통: 처음엔 null(불러오는 중), 이후 최신 값 */
function useLive<T>(
  subscribe: (onData: (v: T) => void, onError: (e: unknown) => void) => () => void,
  deps: unknown[],
  /** 불러오기에 실패하면 대신 쓸 값 (없으면 계속 null) */
  fallback?: T,
) {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const unsub = subscribe(
      (v) => alive && setValue(v),
      (e) => {
        console.error("[spy] 구독 실패", e);
        if (alive && fallback !== undefined) setValue(fallback);
      },
    );
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** 선생님이 관제실에서 바꾸는 게임 설정 (늘곰 연구소 개방 등) */
export function useGame(): GameConfig | null {
  return useLive<GameConfig>((on, err) => getSpyStore().subscribeGame(on, err), [], DEFAULT_GAME);
}

/** 내가 쓴 글 (검토 상태 포함) */
export function useMyPosts(): Post[] | null {
  return useLive<Post[]>((on, err) => getSpyStore().subscribeMyPosts(on, err), []);
}

/** 선생님이 공개한 다른 요원들의 글 */
export function useApprovedPosts(kind: PostKind): Post[] | null {
  return useLive<Post[]>((on, err) => getSpyStore().subscribeApproved(kind, on, err), [kind]);
}
