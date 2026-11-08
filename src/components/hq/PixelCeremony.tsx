"use client";

import { animate, motion, useMotionValue, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ImageCutout } from "@/components/fx/ImageCutout";
import { asset } from "@/lib/asset";
import { burstAt, feel, haptic, play } from "@/lib/fx";
import { getMission, MISSIONS, progressOf } from "@/lib/missions";

// 장치 가방 그림(case.webp, 896×680) 안의 좌표
const CASE = { src: "/art/case.webp", w: 896, h: 680 } as const;
/** 자물쇠 5개 = 픽셀 목표 5칸 (평범지령 · 시한폭탄 · 거울 방 · 부스 둘) */
const LOCKS = [
  { x: 453, y: 252 },
  { x: 320, y: 353 },
  { x: 585, y: 353 },
  { x: 370, y: 510 },
  { x: 543, y: 510 },
] as const;
const LOCK_R = 58;
const SENSOR = { x: 455, y: 390 } as const;
const GEARS = [
  { x: 335, y: 240, r: 38, dir: 1 },
  { x: 285, y: 450, r: 35, dir: -1 },
  { x: 627, y: 448, r: 38, dir: 1 },
  { x: 238, y: 240, r: 60, dir: -1 },
  { x: 680, y: 543, r: 52, dir: 1 },
] as const;

const pctX = (v: number) => (v / CASE.w) * 100;
const pctY = (v: number) => (v / CASE.h) * 100;

/** 미션 → 들어갈 자물쇠 자리 (부스는 깬 순서대로 아래 두 칸, 그 뒤는 보너스로 하트 센서에) */
function slotOf(id: string, cleared: readonly string[]): number | "bonus" {
  if (id === "m0_daily") return 0;
  if (id === "m1_breathing") return 1;
  if (id === "m2_mirror") return 2;
  const booths = cleared.filter((c) => getMission(c)?.zone === 3);
  const k = booths.indexOf(id);
  return k === 0 ? 3 : k === 1 ? 4 : "bonus";
}

type Phase = "enter" | "await" | "insert" | "lock" | "charge" | "done" | "exit";

/**
 * 픽셀 장착 의식 (더 룸 같은 손맛): 장치 가방이 올라오고 → 픽셀 코어를 눌러 자물쇠에 꽂으면
 * 톱니가 철컥철컥 돌고 → 자물쇠가 풀리며 → 하트 센서가 충전되고 파티클이 터진다.
 */
export function PixelCeremony({ queue, cleared, onDone }: { queue: string[]; cleared: readonly string[]; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("enter");
  const [index, setIndex] = useState(0);
  const [inserted, setInserted] = useState<string[]>([]);
  const lockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sensorRef = useRef<HTMLDivElement>(null);

  const ringSpin = useMotionValue(0);
  const gearSpin = useMotionValue(0);
  const charge = useMotionValue(0.35);

  const current = queue[index];
  const target = current ? slotOf(current, cleared) : null;
  const filled = [...cleared.filter((id) => !queue.includes(id)), ...inserted];
  const progress = progressOf(filled);

  // 등장
  useEffect(() => {
    const t1 = setTimeout(() => feel("thunk", "thunk"), 250);
    const t2 = setTimeout(() => setPhase("await"), 800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const finishOne = () => {
    play("chime");
    play("sparkle");
    haptic("success");
    burstAt(sensorRef.current, "pixels", { count: 64, power: 1.1 });
    setInserted((s) => [...s, current]);
    setTimeout(() => {
      if (index + 1 < queue.length) {
        setIndex((k) => k + 1);
        setPhase("await");
      } else {
        setPhase("done");
      }
    }, 700);
  };

  /** 코어가 자물쇠에 닿은 뒤: 톱니 철컥 ×3 → 걸쇠 → 센서 충전 → 펑 */
  const runMechanism = async () => {
    feel("thunk", "thunk");
    setPhase("lock");
    play("whir", { duration: 1.3 });
    void animate(gearSpin, gearSpin.get() + 120, { duration: 1.3, ease: "easeInOut" });
    if (target !== "bonus") {
      for (let k = 0; k < 3; k++) {
        await animate(ringSpin, ringSpin.get() + 40, { type: "spring", stiffness: 600, damping: 18 });
        play("tick");
        haptic("tick");
      }
      play("latch");
      haptic("unlock");
      burstAt(lockRefs.current[target as number], "sparks");
    }
    setPhase("charge");
    play("hum");
    await animate(charge, 1, { duration: 0.7, ease: "easeIn" });
    finishOne();
    void animate(charge, 0.55, { duration: 0.8 });
  };

  const skip = () => {
    setInserted(queue);
    setPhase("done");
  };

  const leave = () => {
    setPhase("exit");
    play("thunk");
    setTimeout(onDone, 420);
  };

  const slotPos = (slot: number | "bonus") => (slot === "bonus" ? SENSOR : LOCKS[slot]);

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/85 px-3 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === "exit" ? 0 : 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex w-full max-w-md items-center justify-between px-1 font-mono text-[11px] tracking-widest text-fog">
        <span>PIXEL CORE INSTALL</span>
        {phase !== "done" && phase !== "exit" && (
          <button type="button" onClick={skip} className="px-2 py-1 text-zinc-400 underline">
            건너뛰기
          </button>
        )}
      </div>

      {/* 장치 가방 */}
      <div className="w-full max-w-md" style={{ perspective: 900 }}>
        <motion.div
          className="relative"
          style={{ aspectRatio: `${CASE.w} / ${CASE.h}` }}
          initial={{ y: 90, rotateX: 28, scale: 0.92, opacity: 0 }}
          animate={phase === "exit" ? { y: 120, rotateX: 20, opacity: 0 } : { y: 0, rotateX: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(CASE.src)} alt="늘곰의 장치 가방: 자물쇠 다섯 개가 하트 센서를 둘러싸고 있다" className="absolute inset-0 h-full w-full rounded-lg" draggable={false} />

          {/* 장식 톱니: 장치가 돌 때 같이 돈다 */}
          {GEARS.map((g, i) => (
            <SpinningCutout key={i} gear={g} spin={gearSpin} />
          ))}

          {/* 자물쇠 자리 */}
          {LOCKS.map((l, i) => {
            const filledHere = filled.some((id) => slotOf(id, cleared) === i);
            const isTarget = target === i && (phase === "await" || phase === "insert" || phase === "lock");
            return (
              <div
                key={i}
                ref={(el) => {
                  lockRefs.current[i] = el;
                }}
                className="absolute"
                style={{
                  left: `${pctX(l.x - LOCK_R)}%`,
                  top: `${pctY(l.y - LOCK_R)}%`,
                  width: `${pctX(LOCK_R * 2)}%`,
                  height: `${pctY(LOCK_R * 2)}%`,
                }}
              >
                {target === i && phase === "lock" && (
                  <div className="absolute inset-0">
                    <ImageCutoutAbs x={l.x} y={l.y} spin={ringSpin} />
                  </div>
                )}
                {isTarget && (
                  <motion.span
                    className="absolute inset-[-6%] rounded-full border-2 border-magenta"
                    animate={{ scale: [0.92, 1.12, 0.92], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}
                {filledHere && <Core className="absolute inset-[22%]" />}
              </div>
            );
          })}

          {/* 하트 센서 충전 빛 */}
          <motion.div
            ref={sensorRef}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${pctX(SENSOR.x - 95)}%`,
              top: `${pctY(SENSOR.y - 95)}%`,
              width: `${pctX(190)}%`,
              height: `${pctY(190)}%`,
              background: "radial-gradient(circle, rgb(255 0 255 / 0.85), rgb(255 0 255 / 0.25) 45%, transparent 70%)",
              mixBlendMode: "screen",
              opacity: charge,
              scale: charge as MotionValue<number>,
            }}
          />

          {/* 장착할 픽셀 코어 */}
          {current && (phase === "await" || phase === "insert") && (
            <motion.button
              key={current}
              type="button"
              data-fx="custom"
              aria-label="픽셀 코어 장착하기"
              disabled={phase !== "await"}
              onClick={() => {
                setPhase("insert");
                play("focus");
                haptic("select");
              }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ width: `${pctX(84)}%`, aspectRatio: "1" }}
              initial={{ left: "50%", top: "4%", scale: 0.4, opacity: 0 }}
              animate={
                phase === "insert"
                  ? { left: `${pctX(slotPos(target!).x)}%`, top: `${pctY(slotPos(target!).y)}%`, scale: 0.62, opacity: 1 }
                  : { left: "50%", top: ["7%", "3%", "7%"], scale: 1, opacity: 1 }
              }
              transition={
                phase === "insert"
                  ? { duration: 0.55, ease: [0.3, 0.7, 0.4, 1] }
                  : { top: { duration: 1.6, repeat: Infinity, ease: "easeInOut" }, default: { duration: 0.5 } }
              }
              onAnimationComplete={() => {
                if (phase === "insert") void runMechanism();
              }}
            >
              <Core className="h-full w-full" />
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* 픽셀 계기판 */}
      <div className="text-center font-mono">
        <p className="text-lg tracking-wider text-cyan-200 [text-shadow:0_0_12px_rgb(127_247_255_/_0.6)]">
          PIXELS ACQUIRED:{" "}
          <motion.span
            key={progress.counted}
            className="inline-block text-magenta [text-shadow:0_0_12px_#ff00ff]"
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            {progress.counted}
          </motion.span>{" "}
          / <span className="text-amber-200">{progress.goal}</span>
          {progress.bonus > 0 && <span className="text-magenta"> +{progress.bonus}</span>}
        </p>
        <p className="mt-1 min-h-5 text-sm text-zinc-300">
          {phase === "await" && current
            ? `${getMission(current)?.title ?? "미션"} 완료 · 픽셀 코어를 눌러 장착하라${queue.length > 1 ? ` (${index + 1}/${queue.length})` : ""}`
            : phase === "lock"
              ? target === "bonus"
                ? "보너스 조각이 하트 센서로…"
                : "자물쇠를 푸는 중…"
              : phase === "charge"
                ? "하트 센서 충전 중…"
                : phase === "done"
                  ? "장착 완료! 본부에 불이 들어온다."
                  : ""}
        </p>
      </div>

      {phase === "done" && (
        <motion.button
          type="button"
          data-fx="custom"
          onClick={leave}
          className="rounded-lg bg-magenta px-8 py-3.5 font-bold text-ink"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          본부로 돌아가기
        </motion.button>
      )}
    </motion.div>
  );
}

/** 빛나는 픽셀 코어 */
function Core({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block rounded-[22%] ${className}`}
      style={{
        background: "radial-gradient(circle at 35% 30%, #ffd6ff, #ff00ff 45%, #8a008a 100%)",
        boxShadow: "0 0 18px 4px rgb(255 0 255 / 0.7), inset 0 0 6px rgb(255 255 255 / 0.6)",
      }}
    />
  );
}

/** 장식 톱니 하나 */
function SpinningCutout({ gear, spin }: { gear: (typeof GEARS)[number]; spin: MotionValue<number> }) {
  const rotate = useMotionValue(0);
  useEffect(() => spin.on("change", (v) => rotate.set(v * gear.dir * (60 / gear.r))), [spin, rotate, gear]);
  return <ImageCutout src={asset(CASE.src)} imgW={CASE.w} imgH={CASE.h} x={gear.x} y={gear.y} r={gear.r} rotate={rotate} />;
}

/** 자물쇠 톱니 고리만 돌린다 (가운데 자물쇠 그림은 그대로) — 부모 칸 안에 꽉 차게 */
function ImageCutoutAbs({ x, y, spin }: { x: number; y: number; spin: MotionValue<number> }) {
  const d = LOCK_R * 2;
  const mask = "radial-gradient(circle closest-side, transparent 64%, #000 66%)";
  return (
    <motion.div
      aria-hidden
      className="absolute inset-0"
      style={{
        backgroundImage: `url(${asset(CASE.src)})`,
        backgroundSize: `${(CASE.w / d) * 100}% ${(CASE.h / d) * 100}%`,
        backgroundPosition: `${((x - LOCK_R) / (CASE.w - d)) * 100}% ${((y - LOCK_R) / (CASE.h - d)) * 100}%`,
        clipPath: "circle(50%)",
        maskImage: mask,
        WebkitMaskImage: mask,
        rotate: spin,
      }}
    />
  );
}

// 미션 구성이 바뀌어 픽셀 목표 칸 수가 자물쇠 수(5)와 달라지면 개발 중에 알려 준다
if (process.env.NODE_ENV !== "production" && progressOf(MISSIONS.map((m) => m.id)).goal !== LOCKS.length) {
  console.warn("[PixelCeremony] 픽셀 목표 칸 수와 자물쇠 수가 다릅니다");
}
