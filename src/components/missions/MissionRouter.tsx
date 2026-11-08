"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";
import { useSpy } from "@/hooks/useSpy";
import { getMission, lockState, todayKST, type MissionId } from "@/lib/missions";
import { BreathingBomb } from "./BreathingBomb";
import { DailyOrders } from "./DailyOrders";
import { MirrorRoom } from "./MirrorRoom";

/** 미션 ID → 화면. 새 미션을 만들면 여기에 한 줄 추가한다. */
const SCREENS: Partial<Record<MissionId, ComponentType>> = {
  m0_daily: DailyOrders,
  m1_breathing: BreathingBomb,
  m2_mirror: MirrorRoom,
};

export function MissionRouter({ id }: { id: MissionId }) {
  const { status, spy } = useSpy();
  const [today] = useState(todayKST);
  const mission = getMission(id)!;

  if (status === "loading") {
    return <p className="m-auto font-mono text-sm text-fog">구역 좌표 확인 중…</p>;
  }

  const lock = lockState(mission, spy.clearedMissions, today);
  if (lock.locked && !spy.clearedMissions.includes(id)) {
    return (
      <Notice code="ACCESS DENIED" title={`${mission.title} · 잠긴 구역`}>
        아직 들어갈 수 없어요. ({lock.reason})
      </Notice>
    );
  }

  const Screen = SCREENS[id];
  if (!Screen || !mission.ready) {
    return (
      <Notice code={mission.codename} title={mission.title}>
        {mission.brief}
        <br />
        <span className="text-fog">본부가 이 구역을 준비하고 있어요. 곧 열려요.</span>
      </Notice>
    );
  }
  return <Screen />;
}

function Notice({ code, title, children }: { code: string; title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="font-mono text-xs tracking-widest text-fog">{code}</p>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm leading-relaxed text-zinc-300">{children}</p>
      <Link href="/dashboard" className="mt-4 rounded-lg border border-line px-5 py-3 text-sm">
        상황판으로 돌아가기
      </Link>
    </main>
  );
}
