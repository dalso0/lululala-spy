"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { CommsTicker } from "@/components/CommsFeed";
import { SoundToggle } from "@/components/fx/SoundToggle";
import { RoomScene } from "@/components/hq/RoomScene";
import { PixelCeremony } from "@/components/hq/PixelCeremony";
import { MissionList } from "@/components/MissionList";
import { useGame } from "@/hooks/useLive";
import { useSpy } from "@/hooks/useSpy";
import { asset } from "@/lib/asset";
import { isFirebaseConfigured } from "@/lib/firebase";
import { feel } from "@/lib/fx";
import { progressOf, todayKST, type Progress } from "@/lib/missions";
import type { SpyDoc } from "@/lib/store";

/** 상황판: 360° 본부(미션마다 불이 들어온다) → 픽셀 장착 의식 → 미션 목록 */
export default function Dashboard() {
  const { status, spy } = useSpy();

  if (status === "loading") return <Booting />;
  if (status === "error") return <Offline />;
  return <ReadyDashboard spy={spy} />;
}

/* ───── 지난번에 본 상태: 새로 깬 미션만 '픽셀 장착' 의식을 보여 주려고 ───── */
const SEEN_KEY = "spy-seen";
const ENDING_SEEN_KEY = "spy-ending-seen";
const POWER_KEY = "spy-hq-powered";

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** 지난번 상황판에서 이미 장착한(본) 미션들. 예전 형식이면 지금 것을 다 본 것으로 친다 */
function readSeenCleared(current: readonly string[]): string[] {
  const v = readLocal<{ cleared?: unknown } | null>(SEEN_KEY, null);
  if (v && Array.isArray(v.cleared)) return v.cleared.filter((x): x is string => typeof x === "string");
  return v ? [...current] : [];
}
/** 이번 접속(탭)에서 본부 전원을 이미 켰는지 */
const readPowered = () => {
  try {
    return sessionStorage.getItem(POWER_KEY) === "1";
  } catch {
    return false;
  }
};

function ReadyDashboard({ spy }: { spy: SpyDoc }) {
  const game = useGame();
  // 연구소 개방 여부를 알고 나서 그린다 (불이 반쯤 켜졌다가 갑자기 다 켜지는 깜빡임 방지)
  if (!game) return <Booting />;
  return <DashboardBody spy={spy} endingOpen={game.endingOpen} />;
}

function DashboardBody({ spy, endingOpen }: { spy: SpyDoc; endingOpen: boolean }) {
  // 이 컴포넌트는 브라우저에서 데이터가 준비된 뒤에만 그려지므로 초기값에서 저장소를 읽어도 된다
  const [today] = useState(todayKST);
  const [queue, setQueue] = useState(() => {
    const seen = readSeenCleared(spy.clearedMissions);
    return spy.clearedMissions.filter((id) => !seen.includes(id));
  });
  const [igniting, setIgniting] = useState<string[]>([]);
  const [powered, setPowered] = useState(readPowered);
  const [justPowered, setJustPowered] = useState(false);
  const [endingDismissed, setEndingDismissed] = useState(() => readLocal(ENDING_SEEN_KEY, false));

  const ceremony = queue.length > 0;
  // 장착을 마친 미션만 불·계기판에 반영
  const installed = spy.clearedMissions.filter((id) => !queue.includes(id));
  const progress = progressOf(installed);
  // 연구소가 열리면 늘곰이 남은 회색을 모두 걷어 낸다
  const ratio = endingOpen ? 1 : progress.ratio;

  // 장착까지 마친 상태를 기억 (다음엔 새로 깬 것만 의식)
  useEffect(() => {
    if (!ceremony) writeLocal(SEEN_KEY, { cleared: spy.clearedMissions });
  }, [ceremony, spy.clearedMissions]);

  // 불이 켜질 때 나는 지직 소리는 본부 장면이 불마다 낸다
  const powerOn = () => {
    setPowered(true);
    setJustPowered(true);
    try {
      sessionStorage.setItem(POWER_KEY, "1");
    } catch {}
    feel("power", "thunk");
    setTimeout(() => setJustPowered(false), 3200);
  };

  // 장착이 끝나면: 그 미션의 물건이 있는 벽으로 돌아가 불을 켠다
  const finishCeremony = () => {
    const done = queue;
    setQueue([]);
    setIgniting(done);
    if (!powered) powerOn();
    setTimeout(() => setIgniting([]), 4000);
  };

  const dismissEnding = () => {
    writeLocal(ENDING_SEEN_KEY, true);
    setEndingDismissed(true);
  };

  return (
    <main className="charge-scope flex flex-1 flex-col gap-5" style={{ "--charge": ratio } as CSSProperties}>
      {/* 상단: 요원 정보 + 픽셀 조각 */}
      <header className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between gap-2 font-mono text-[11px] tracking-widest text-fog">
          <span>OPERATION · GRAY FOG</span>
          <span className="flex min-w-0 items-center gap-2">
            <Link href="/id" className="truncate px-1 py-1 text-zinc-300 underline-offset-4 hover:underline">
              {spy.codename || "요원"} ›
            </Link>
            <SoundToggle />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">본부 상황판</h1>
          <PixelMeter progress={progress} />
        </div>
      </header>

      {/* 중앙: 360° 본부 — 옆으로 밀어 둘러보고, 미션을 깰 때마다 그 물건에 불이 들어온다 */}
      <RoomScene
        cleared={spy.clearedMissions}
        pending={queue}
        igniting={igniting}
        justPowered={justPowered}
        powered={powered}
        onPowerOn={powerOn}
        endingOpen={endingOpen}
        ratio={ratio}
        today={today}
      />

      <section aria-label="본부 복구 상태" className="-mt-1 flex flex-col gap-2">
        <div className="flex items-center justify-between font-mono text-[11px] text-fog">
          <span>{powered ? "옆으로 밀어 둘러보고, 물건을 눌러 들여다보세요" : "본부를 터치해 전원을 켜세요"}</span>
          <span style={{ color: "var(--accent)" }}>{Math.round(ratio * 100)}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-line">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--accent)" }}
            initial={false}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>
        <p className="rounded-md border border-line bg-panel px-3 py-2 font-mono text-xs leading-relaxed text-zinc-300">
          <span style={{ color: "var(--accent)" }}>본부 AI ▸ </span>
          {hqMessage(progress, endingOpen)}
        </p>
      </section>

      {/* 처음 온 요원: 첫 지령(평범지령)으로 바로 */}
      {!spy.clearedMissions.includes("m0_daily") && (
        <Link
          href="/mission/m0_daily"
          className="flex items-center justify-between gap-3 rounded-lg border-2 border-magenta bg-magenta/10 px-4 py-3"
        >
          <span>
            <span className="block font-mono text-[10px] tracking-widest text-magenta">FIRST ORDER</span>
            <span className="block font-bold">첫 지령 도착 · 평범지령으로 위장하라</span>
          </span>
          <span aria-hidden className="text-magenta">
            ›
          </span>
        </Link>
      )}

      {endingOpen && (
        <Link
          href="/ending"
          className="block rounded-lg border-2 border-magenta bg-magenta/10 px-4 py-3 text-center font-bold text-magenta"
        >
          늘곰 연구소 신호 감지! 지금 접속하기 ›
        </Link>
      )}

      <CommsTicker kind="mirror" />

      {/* 하단: 미션 목록 */}
      <MissionList cleared={spy.clearedMissions} today={today} />

      <footer className="mt-auto flex flex-col gap-1 pt-6 text-center text-[11px] text-fog">
        {!isFirebaseConfigured && <p className="font-mono">⚠ 연습 모드 · 진행 기록은 이 브라우저에만 저장돼요</p>}
        <p>마음이 너무 무거운 날엔 Wee클래스, 청소년상담 1388, 자살예방 상담전화 109에 이야기해요.</p>
      </footer>

      {/* 새로 깬 미션: 픽셀 장착 의식 */}
      {ceremony && <PixelCeremony queue={queue} cleared={spy.clearedMissions} onDone={finishCeremony} />}

      {/* 선생님이 연구소를 열면 (처음 한 번) */}
      <AnimatePresence>
        {endingOpen && !endingDismissed && !ceremony && (
          <motion.div
            className="fixed inset-0 z-30 grid place-items-center bg-black/70 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal
              aria-labelledby="ending-title"
              className="w-full max-w-sm rounded-xl border-2 border-magenta bg-ink p-5 text-center"
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/art/stand.webp")} alt="" className="mx-auto h-28" />
              <p className="mt-2 font-mono text-xs text-magenta">INCOMING SIGNAL</p>
              <h2 id="ending-title" className="mt-1 font-hand text-2xl font-bold">
                “요원들, 수고했다. 연구소로 오라!”
              </h2>
              <p className="mt-2 text-sm text-zinc-300">늘곰 연구소로 가는 좌표가 열렸어요.</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={dismissEnding} className="flex-1 rounded-lg border border-line py-3 text-sm">
                  나중에
                </button>
                <Link
                  href="/ending"
                  onClick={dismissEnding}
                  className="flex-1 rounded-lg bg-magenta py-3 text-sm font-bold text-ink"
                >
                  연구소로 이동
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function hqMessage(p: Progress, endingOpen: boolean) {
  if (endingOpen) return "수장 늘곰의 호출이다. 연구소로 접속하라!";
  if (p.counted === 0) return "적들의 눈을 속이려면 가장 완벽한 '평범함'으로 위장하라. 첫 지령은 제1구역 평범지령이다.";
  if (p.counted >= p.goal) return "모든 구역 목표 달성! 늘곰 연구소의 문이 열리기를 기다려라.";
  if (p.ratio < 0.5) return "본부에 색이 돌아오기 시작했다. 계속 진행하라.";
  return "회색 안개가 걷히고 있다. 수장 늘곰이 지켜보고 있다. 조금만 더!";
}

/** 목표 칸(구역 목표 합) + 보너스 조각 */
function PixelMeter({ progress }: { progress: Progress }) {
  const { counted, goal, bonus } = progress;
  return (
    <div className="flex items-center gap-2" aria-label={`픽셀 조각 ${counted}개 / 목표 ${goal}개${bonus ? `, 보너스 ${bonus}개` : ""}`}>
      <div className="flex gap-1">
        {Array.from({ length: goal }, (_, i) => (
          <span
            key={i}
            className="h-3.5 w-3.5 rounded-[2px] border"
            style={
              i < counted
                ? { background: "var(--accent)", borderColor: "var(--accent)" }
                : { borderColor: "var(--color-line)" }
            }
          />
        ))}
        {Array.from({ length: bonus }, (_, i) => (
          <span key={`b${i}`} className="h-3.5 w-3.5 rotate-45 scale-75 rounded-[2px] bg-magenta shadow-[0_0_8px_#ff00ff]" />
        ))}
      </div>
      <span className="font-mono text-sm tabular-nums">
        {counted}/{goal}
        {bonus > 0 && <span className="text-magenta"> +{bonus}</span>}
      </span>
    </div>
  );
}

function Booting() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 font-mono text-sm text-fog">
      <span className="h-2 w-24 overflow-hidden rounded-full bg-line">
        <span className="block h-full w-1/3 animate-pulse bg-fog" />
      </span>
      본부 서버와 연결 중…
    </main>
  );
}

function Offline() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="font-mono text-xs text-magenta">CONNECTION LOST</p>
      <p>
        본부 서버와 연결이 끊겼어요.
        <br />
        인터넷 연결을 확인하고 다시 시도해 주세요.
      </p>
      <button type="button" onClick={() => location.reload()} className="rounded-lg border border-line px-5 py-3">
        다시 연결
      </button>
    </main>
  );
}
