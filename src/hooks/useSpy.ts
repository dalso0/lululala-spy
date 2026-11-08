"use client";

import { useEffect, useState } from "react";
import type { Sense } from "@/lib/missions";
import { EMPTY_SPY, getSpyStore, type SpyDoc } from "@/lib/store";

type SpyState = {
  status: "loading" | "ready" | "error";
  spy: SpyDoc;
  spyId: string | null;
  /** 이번에 처음 요원 신분을 받았는지 */
  isNew: boolean;
};

/** 요원 진행도를 실시간으로 구독한다 (본부 서버면 onSnapshot, 연습 모드면 localStorage). */
export function useSpy() {
  const [state, setState] = useState<SpyState>({ status: "loading", spy: EMPTY_SPY, spyId: null, isNew: false });

  useEffect(() => {
    const store = getSpyStore();
    let alive = true;
    store
      .start()
      .then(({ spyId, isNew }) => alive && setState((s) => ({ ...s, spyId, isNew })))
      .catch((e) => {
        console.error("[spy] 요원 신분 확인 실패", e);
        if (alive) setState((s) => ({ ...s, status: "error" }));
      });
    const unsub = store.subscribeSpy(
      (spy) => alive && setState((s) => ({ ...s, status: "ready", spy })),
      (e) => {
        console.error("[spy] 본부 서버 연결 실패", e);
        if (alive) setState((s) => ({ ...s, status: "error" }));
      },
    );
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return {
    ...state,
    clearMission: (missionId: string) => getSpyStore().clearMission(missionId),
    setFinalRoutine: (sense: Sense) => getSpyStore().setFinalRoutine(sense),
  };
}
