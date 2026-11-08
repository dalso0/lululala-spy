"use client";

import Link from "next/link";
import { lockState, MISSIONS, ZONES, type Mission } from "@/lib/missions";

type Props = { cleared: readonly string[]; today: string };

export function MissionList({ cleared, today }: Props) {
  const zones = [...new Set(MISSIONS.map((m) => m.zone))];

  return (
    <div className="flex flex-col gap-6">
      {zones.map((zone) => (
        <section key={zone} aria-labelledby={`zone-${zone}`}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 id={`zone-${zone}`} className="font-mono text-[11px] tracking-widest text-fog">
              {ZONES[zone].name}
            </h2>
            <span className="shrink-0 font-mono text-[11px] text-fog">
              {Math.min(MISSIONS.filter((m) => m.zone === zone && cleared.includes(m.id)).length, ZONES[zone].goal)}/
              {ZONES[zone].goal}
            </span>
          </div>
          <p className="-mt-1 mb-2 text-xs text-zinc-400">{ZONES[zone].rule}</p>
          <ul className="flex flex-col gap-2">
            {MISSIONS.filter((m) => m.zone === zone).map((m) => (
              <li key={m.id}>
                <MissionCard mission={m} cleared={cleared} today={today} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MissionCard({ mission, cleared, today }: { mission: Mission; cleared: readonly string[]; today: string }) {
  const done = cleared.includes(mission.id);
  const lock = lockState(mission, cleared, today);

  const body = (
    <div className="flex items-center gap-3">
      <StatusIcon state={done ? "done" : lock.locked ? "locked" : "open"} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] tracking-widest text-fog">{mission.codename}</p>
        <p className="truncate text-[15px] font-bold">{mission.title}</p>
        <p className="mt-0.5 text-xs text-fog">
          {done
            ? mission.id === "m0_daily"
              ? "해결 완료 · 더 보고하면 늘곰의 SOS가 풀려요"
              : "해결 완료 · 다시 연습할 수 있어요"
            : lock.locked
              ? lock.reason
              : mission.brief}
        </p>
      </div>
      {!lock.locked && <span aria-hidden className="text-fog">›</span>}
    </div>
  );

  if (lock.locked && !done) {
    return (
      <div aria-disabled className="rounded-lg border border-dashed border-line px-3 py-3 opacity-45">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/mission/${mission.id}`}
      className="block rounded-lg border px-3 py-3 transition-colors active:bg-white/5"
      style={{ borderColor: done ? "var(--color-line)" : "var(--accent)" }}
    >
      {body}
    </Link>
  );
}

function StatusIcon({ state }: { state: "done" | "open" | "locked" }) {
  const common = "h-9 w-9 shrink-0 rounded-md border grid place-items-center";
  if (state === "done") {
    return (
      <span className={common} style={{ borderColor: "var(--accent)", background: "var(--accent)" }} aria-label="해결 완료">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="#0e0e10" strokeWidth="3">
          <path d="M4 10.5l4 4 8-9" />
        </svg>
      </span>
    );
  }
  if (state === "locked") {
    return (
      <span className={`${common} border-line`} aria-label="잠김">
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-fog" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="9" width="12" height="8" rx="1.5" />
          <path d="M7 9V6.5a3 3 0 016 0V9" />
        </svg>
      </span>
    );
  }
  return (
    <span className={common} style={{ borderColor: "var(--accent)" }} aria-label="진행 가능">
      <span className="h-2.5 w-2.5 animate-pulse rounded-[2px]" style={{ background: "var(--accent)" }} />
    </span>
  );
}
