"use client";

import { AnimatePresence, motion, useAnimationFrame, useMotionValue } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageCutout } from "@/components/fx/ImageCutout";
import { useBreathingCycle, type BreathStep } from "@/hooks/useBreathingCycle";
import { useSpy } from "@/hooks/useSpy";
import { asset } from "@/lib/asset";
import { burstAt, feel, haptic, play } from "@/lib/fx";

const MISSION_ID = "m1_breathing";
const CYCLES = 3;

// 폭탄 장치 그림(bomb.webp, 896×865) 안의 좌표
const BOMB = { src: "/art/bomb.webp", w: 896, h: 865 } as const;
/** 게이지 유리판: 그림 속 바늘·글씨를 덮고 그 위에 살아 있는 호흡 계기를 그린다 */
const GAUGE = { x: 450, y: 415, r: 133 } as const;
/** 오른쪽 연결 막대 3개 = 호흡 3번. 한 번 숨 쉴 때마다 하나씩 끊어진다 */
const RODS = [
  { x: 714, y: 285 },
  { x: 714, y: 420 },
  { x: 714, y: 555 },
] as const;
const BIG_GEAR = { x: 450, y: 790, r: 104 } as const;
const SMALL_GEAR = { x: 430, y: 655, r: 38 } as const;

const pctX = (v: number) => (v / BOMB.w) * 100;
const pctY = (v: number) => (v / BOMB.h) * 100;

// 사인 곡선으로 부드럽게: 숨이 들어오고 나가는 속도에 가깝다
const easeInOut = (p: number) => -(Math.cos(Math.PI * p) - 1) / 2;

/** 숨의 양 0(다 내쉼) ~ 1(다 들이쉼) */
function breathAmount(step: BreathStep, progress: number, started: boolean) {
  if (!started) return 0;
  if (step.phase === "inhale") return easeInOut(progress);
  if (step.phase === "hold") return 1;
  return 1 - easeInOut(progress);
}

type SaveState = { state: "idle" } | { state: "saving" } | { state: "saved"; gained: boolean } | { state: "error" };

/** 미션 1: 스트레스 시한폭탄 — 들숨 4 · 멈춤 4 · 날숨 6 을 3번 하면 해체 */
export function BreathingBomb() {
  const router = useRouter();
  const { clearMission } = useSpy();
  const [save, setSave] = useState<SaveState>({ state: "idle" });
  const gaugeRef = useRef<HTMLDivElement>(null);
  const rodRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const report = useCallback(async () => {
    feel("chime", "success");
    play("sparkle");
    burstAt(gaugeRef.current, "pixels", { count: 70, power: 1.15 });
    setSave({ state: "saving" });
    try {
      const gained = await clearMission(MISSION_ID);
      setSave({ state: "saved", gained });
    } catch (e) {
      console.error("[m1] 기록 실패", e);
      setSave({ state: "error" });
    }
  }, [clearMission]);

  const breath = useBreathingCycle({
    cycles: CYCLES,
    onComplete: report,
    onStepChange: (step) => {
      play(step.phase);
      haptic(step.phase === "inhale" ? "select" : "tick");
    },
  });

  // 호흡 한 번을 끝낼 때마다 연결 막대가 철컥 끊어진다
  const cutRef = useRef(0);
  useEffect(() => {
    const cut = breath.cyclesDone;
    if (cut > cutRef.current && cut <= CYCLES) {
      feel("latch", "unlock");
      burstAt(rodRefs.current[cut - 1], "sparks");
    }
    cutRef.current = cut;
  }, [breath.cyclesDone]);

  // 기록이 끝나면 잠시 뒤 상황판으로
  useEffect(() => {
    if (save.state !== "saved") return;
    const t = setTimeout(() => router.push("/dashboard"), 4500);
    return () => clearTimeout(t);
  }, [save.state, router]);

  // 실행 중에는 아래 톱니바퀴가 돈다 (멈추면 그 자리에 선다)
  const bigSpin = useMotionValue(0);
  const smallSpin = useMotionValue(0);
  const running = breath.status === "running";
  useAnimationFrame((_, delta) => {
    if (!running) return;
    bigSpin.set(bigSpin.get() + delta * 0.03);
    smallSpin.set(smallSpin.get() - delta * 0.08);
  });

  const started = breath.status !== "idle";
  const amount = breathAmount(breath.step, breath.stepProgress, started);
  const remaining = Math.ceil(breath.totalRemaining);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const charge = breath.totalProgress;

  const start = () => {
    feel("power", "thunk");
    breath.start();
  };

  return (
    <main className="charge-scope flex flex-1 flex-col gap-4" style={{ "--charge": charge } as React.CSSProperties}>
      <nav className="flex items-center justify-between font-mono text-[11px] tracking-widest text-fog">
        <Link href="/dashboard" className="-ml-2 px-2 py-2">
          ‹ 상황판
        </Link>
        <span>MISSION 01 · STRESS BOMB</span>
      </nav>

      {/* 해체 타이머 */}
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-fog">해체까지</p>
          <p className="font-mono text-4xl font-bold tabular-nums" style={{ color: "var(--accent)" }} aria-label={`남은 해체 시간 ${remaining}초`}>
            {mm}:{ss}
          </p>
        </div>
        <p className="pb-1 text-right font-mono text-xs text-fog">
          연결 {CYCLES - Math.min(breath.cyclesDone, CYCLES)} / {CYCLES}
          <br />
          {started ? `호흡 ${Math.min(breath.cycle, CYCLES)} / ${CYCLES}` : "들숨 4 · 멈춤 4 · 날숨 6"}
        </p>
      </div>

      {/* 폭탄 장치 (2.5D: 그림 위에 살아 있는 계기 · 톱니 · 표시등) */}
      <div className="relative -mx-2" style={{ aspectRatio: `${BOMB.w} / ${BOMB.h}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(BOMB.src)}
          alt="황동 톱니와 게이지가 달린 스트레스 시한폭탄"
          className="absolute inset-0 h-full w-full"
          style={{
            filter: started ? (breath.status === "done" ? "brightness(1.08) saturate(1.1)" : "none") : "brightness(0.72) saturate(0.75)",
            transition: "filter 0.8s ease",
          }}
          draggable={false}
        />
        <ImageCutout src={asset(BOMB.src)} imgW={BOMB.w} imgH={BOMB.h} {...BIG_GEAR} rotate={bigSpin} />
        <ImageCutout src={asset(BOMB.src)} imgW={BOMB.w} imgH={BOMB.h} {...SMALL_GEAR} rotate={smallSpin} />

        {/* 연결 막대 표시등: 주황(연결됨) → 하늘색(끊김, 안전) */}
        {RODS.map((rod, i) => {
          const cut = breath.cyclesDone > i;
          return (
            <span
              key={i}
              ref={(el) => {
                rodRefs.current[i] = el;
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${pctX(rod.x)}%`,
                top: `${pctY(rod.y)}%`,
                width: "4.2%",
                aspectRatio: "1",
                background: cut ? "#7ff7ff" : "#ffb347",
                boxShadow: cut ? "0 0 12px 3px rgb(127 247 255 / 0.7)" : "0 0 12px 3px rgb(255 179 71 / 0.75)",
                animation: !cut && started ? "hq-pulse 1.2s ease-in-out infinite" : undefined,
              }}
              aria-label={cut ? `연결 ${i + 1} 끊김` : `연결 ${i + 1} 살아 있음`}
            />
          );
        })}

        {/* 게이지 유리판 */}
        <div
          ref={gaugeRef}
          className="absolute"
          style={{
            left: `${pctX(GAUGE.x - GAUGE.r)}%`,
            top: `${pctY(GAUGE.y - GAUGE.r)}%`,
            width: `${pctX(GAUGE.r * 2)}%`,
            height: `${pctY(GAUGE.r * 2)}%`,
          }}
        >
          <GaugeFace
            amount={amount}
            started={started}
            status={breath.status}
            label={breath.status === "paused" ? "일시정지" : breath.step.label}
            seconds={Math.ceil(breath.stepRemaining)}
            charge={charge}
          />
        </div>
      </div>

      {!started && (
        <p className="rounded-md border border-line px-3 py-2 text-sm leading-relaxed text-zinc-300">
          가방 속에서 <b>스트레스 시한폭탄</b>이 발견됐다! 당황하면 폭탄이 더 빨라진다. 바늘이 올라가면 코로 들이쉬고, 멈추면
          숨을 참고, 내려가면 입으로 천천히 내쉬어라. 숨을 한 번 쉴 때마다 연결선이 하나씩 끊어진다.
        </p>
      )}

      <div className="flex gap-2">
        {breath.status === "idle" && (
          <BigButton onClick={start} primary>
            해체 시작
          </BigButton>
        )}
        {breath.status === "running" && (
          <BigButton
            onClick={() => {
              play("tick");
              breath.pause();
            }}
          >
            잠시 멈춤
          </BigButton>
        )}
        {breath.status === "paused" && (
          <>
            <BigButton onClick={breath.reset}>처음부터</BigButton>
            <BigButton
              onClick={() => {
                play("tick");
                breath.resume();
              }}
              primary
            >
              이어서 하기
            </BigButton>
          </>
        )}
      </div>

      {/* 해체 성공 */}
      <AnimatePresence>
        {breath.status === "done" && (
          <motion.div className="fixed inset-0 z-30 grid place-items-center bg-black/75 px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div
              role="dialog"
              aria-modal
              aria-labelledby="defused-title"
              className="w-full max-w-sm rounded-xl border-2 border-magenta bg-ink p-6 text-center"
              initial={{ scale: 0.85, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <p className="font-mono text-xs tracking-widest text-magenta">BOMB DEFUSED</p>
              <h2 id="defused-title" className="mt-1 text-2xl font-bold">
                폭탄 해체 성공!
              </h2>
              <SaveResult save={save} onRetry={report} />
              <div className="mt-5 flex gap-2">
                <BigButton
                  onClick={() => {
                    setSave({ state: "idle" });
                    cutRef.current = 0;
                    breath.reset();
                  }}
                >
                  한 번 더
                </BigButton>
                <BigButton onClick={() => router.push("/dashboard")} primary disabled={save.state === "saving"}>
                  상황판으로
                </BigButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/** 게이지 유리판 위의 살아 있는 호흡 계기: 바늘(숨의 양) + 마젠타 고리 + 단계 글씨 */
function GaugeFace(props: { amount: number; started: boolean; status: string; label: string; seconds: number; charge: number }) {
  const { amount, started, status, label, seconds, charge } = props;
  const angle = -118 + 236 * amount; // 바늘: 다 내쉼(왼쪽 아래) ~ 다 들이쉼(오른쪽 아래)
  const ringR = 34 + 46 * amount;
  const glow = 0.35 + 0.65 * Math.max(amount, charge * 0.6);
  return (
    <svg viewBox="0 0 266 266" className="h-full w-full" aria-live="polite">
      <defs>
        <radialGradient id="glass" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#24122a" />
          <stop offset="70%" stopColor="#0c0610" />
          <stop offset="100%" stopColor="#050307" />
        </radialGradient>
        <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="133" cy="133" r="131" fill="url(#glass)" stroke="#3a2416" strokeWidth="4" />
      {/* 눈금 */}
      {Array.from({ length: 25 }, (_, i) => {
        const a = ((-118 + (236 / 24) * i) * Math.PI) / 180;
        const r1 = i % 6 === 0 ? 100 : 106;
        return (
          <line
            key={i}
            x1={133 + Math.sin(a) * r1}
            y1={133 - Math.cos(a) * r1}
            x2={133 + Math.sin(a) * 114}
            y2={133 - Math.cos(a) * 114}
            stroke={i <= amount * 24 && started ? "#ff7ad9" : "#5a4a52"}
            strokeWidth={i % 6 === 0 ? 3 : 1.6}
          />
        );
      })}
      {/* 호흡 고리 */}
      <circle cx="133" cy="133" r={ringR} fill="none" stroke="#ff00ff" strokeWidth="5" opacity={started ? glow : 0.25} filter="url(#neon)" />
      {/* 바늘 */}
      <g transform={`rotate(${angle} 133 133)`} style={{ transition: status === "running" ? undefined : "transform 0.6s ease" }}>
        <path d="M133 30 L138 133 L128 133 Z" fill="#e8c27a" stroke="#6b4a1e" strokeWidth="1.5" />
      </g>
      <circle cx="133" cy="133" r="11" fill="#b8893c" stroke="#5a3d14" strokeWidth="2" />
      {/* 글씨 */}
      {started ? (
        <>
          <text x="133" y="188" textAnchor="middle" fill="#ffd6ff" fontSize="32" fontWeight="700">
            {label}
          </text>
          <text x="133" y="232" textAnchor="middle" fill="#ffffff" fontSize="40" fontWeight="700" fontFamily="var(--font-coding), monospace">
            {status === "done" ? "OK" : seconds}
          </text>
        </>
      ) : (
        <text x="133" y="200" textAnchor="middle" fill="#ffd6ff" fontSize="30" fontWeight="700">
          준비되면
        </text>
      )}
      {!started && (
        <text x="133" y="236" textAnchor="middle" fill="#ffd6ff" fontSize="30" fontWeight="700">
          시작!
        </text>
      )}
      {/* 유리 반사 */}
      <ellipse cx="96" cy="78" rx="70" ry="34" fill="white" opacity="0.07" transform="rotate(-28 96 78)" />
    </svg>
  );
}

function SaveResult({ save, onRetry }: { save: SaveState; onRetry: () => void }) {
  switch (save.state) {
    case "saving":
      return <p className="mt-3 font-mono text-sm text-fog">본부에 보고 중…</p>;
    case "saved":
      return save.gained ? (
        <div className="mt-3">
          <motion.div
            className="mx-auto h-10 w-10 rounded-[3px] bg-magenta shadow-[0_0_24px_#ff00ff]"
            initial={{ rotate: -45, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          />
          <p className="mt-3 font-bold text-magenta">픽셀 조각 +1</p>
          <p className="mt-1 text-xs text-fog">상황판에서 장치 가방에 장착해요</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-300">이미 해체한 폭탄이에요. 연습 완료!</p>
      );
    case "error":
      return (
        <div className="mt-3 text-sm">
          <p className="text-zinc-300">본부에 보고하지 못했어요. 인터넷 연결을 확인해 주세요.</p>
          <button type="button" onClick={onRetry} className="mt-2 rounded-md border border-magenta px-3 py-1.5 text-magenta">
            다시 보고하기
          </button>
        </div>
      );
    default:
      return null;
  }
}

function BigButton({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg py-4 text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-50 ${
        primary ? "text-ink" : "border border-line"
      }`}
      style={primary ? { background: "var(--accent)" } : undefined}
    >
      {children}
    </button>
  );
}
