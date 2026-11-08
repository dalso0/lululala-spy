"use client";

import { AnimatePresence, motion, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";
import { feel, play } from "@/lib/fx";
import { AMBIENT_LAMP, CRT_SCREEN, ENDING_SPOTS, HQ, px, SPOTS, type Spot } from "@/lib/hq";
import { getMission, lockState } from "@/lib/missions";

type Props = {
  cleared: readonly string[];
  /** 픽셀 장착을 기다리는 미션: 아직 불을 켜지 않는다 */
  pending: readonly string[];
  /** 막 장착을 마친 미션: 깜빡이며 켜진다 */
  igniting: readonly string[];
  /** 지금 막 전원이 들어왔다 (켜진 불들이 차례로 깜빡이며 켜진다) */
  justPowered: boolean;
  powered: boolean;
  onPowerOn: () => void;
  endingOpen: boolean;
  /** 색채 복구율 0~1 */
  ratio: number;
  today: string;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * 2.5D 본부: 렌더 그림 한 장 위에
 *  - 미션을 깰 때마다 그 물건 자리만 원래 색·밝기로 드러내는 '불빛 레이어'
 *  - 손가락·기울기를 따라 살짝 기우는 무대 + 앞쪽 먼지(시차) + 유리 반사광
 *  - 물건을 누르면 그쪽으로 다가가 들여다보기
 */
export function HQScene(props: Props) {
  const { cleared, pending, igniting, justPowered, powered, onPowerOn, endingOpen, ratio, today } = props;
  const [inspect, setInspect] = useState<Spot | null>(null);
  const [origin, setOrigin] = useState("50% 50%");
  const [denied, setDenied] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number } | null>(null);

  // 기울기 (스프링으로 부드럽게)
  const rx = useSpring(0, { stiffness: 90, damping: 18 });
  const ry = useSpring(0, { stiffness: 90, damping: 18 });
  const sheenX = useTransform(ry, [-10, 10], ["-35%", "35%"]);

  // 안드로이드 등 권한 없이 되는 기기만 자이로로 기울인다 (아이폰은 권한 창이 떠서 쓰지 않음)
  useEffect(() => {
    const DOE = typeof window !== "undefined" ? window.DeviceOrientationEvent : undefined;
    if (!DOE || typeof (DOE as unknown as { requestPermission?: unknown }).requestPermission === "function") return;
    let base: number | null = null;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (dragRef.current || e.gamma == null || e.beta == null) return;
      base ??= e.beta;
      ry.set(clamp(e.gamma / 4, -7, 7));
      rx.set(clamp(-(e.beta - base) / 5, -5, 5));
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, [rx, ry]);

  useEffect(() => {
    if (inspect) {
      rx.set(0);
      ry.set(0);
    }
  }, [inspect, rx, ry]);

  const lit = endingOpen
    ? [...SPOTS, ...ENDING_SPOTS]
    : SPOTS.filter((s) => s.mission && cleared.includes(s.mission) && !pending.includes(s.mission));

  const baseFilter = !powered
    ? "grayscale(1) brightness(0.3) contrast(1.05)"
    : endingOpen
      ? "grayscale(0) brightness(1) contrast(1)"
      : `grayscale(${0.92 - 0.55 * ratio}) brightness(${0.46 + 0.22 * ratio}) contrast(1.06)`;

  const onPointerMove = (e: React.PointerEvent) => {
    if (inspect) return;
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    if (e.pointerType === "mouse") {
      ry.set(((e.clientX - r.left) / r.width - 0.5) * 10);
      rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
    } else if (dragRef.current) {
      ry.set(clamp(((e.clientX - dragRef.current.x) / r.width) * 24, -9, 9));
    }
  };
  const release = () => {
    dragRef.current = null;
    rx.set(0);
    ry.set(0);
  };

  const open = (spot: Spot) => {
    if (!powered) return onPowerOn();
    const m = spot.mission ? getMission(spot.mission) : undefined;
    const locked = m ? lockState(m, cleared, today).locked && !cleared.includes(m.id) : !endingOpen;
    if (locked) {
      feel("deny", "error");
      setDenied(spot.id);
      setTimeout(() => setDenied(null), 450);
    } else {
      feel("focus", "select");
    }
    setOrigin(`${px.x(spot.x)}% ${px.y(spot.y)}%`);
    setInspect(spot);
  };
  const close = () => {
    feel("tick", "tick");
    setInspect(null);
  };

  return (
    <section aria-label="늘곰 본부" className="relative -mx-4 select-none" style={{ perspective: 1100 }}>
      <motion.div
        ref={boxRef}
        className="relative"
        style={{ aspectRatio: `${HQ.w} / ${HQ.h}`, rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") dragRef.current = { x: e.clientX };
        }}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        {/* 그림 판 */}
        <div className="absolute inset-0 overflow-hidden bg-black">
          <motion.div
            className="absolute inset-0"
            style={{ transformOrigin: origin }}
            animate={{ scale: inspect ? 1.85 : 1 }}
            transition={{ type: "spring", stiffness: 110, damping: 20 }}
          >
            <div className="hq-anim absolute inset-0" style={{ animation: "hq-drift 18s ease-in-out infinite" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(HQ.src)}
                alt="늘곰 요원의 지하 본부"
                className="absolute inset-0 h-full w-full"
                style={{ filter: baseFilter, transition: "filter 1.2s ease" }}
                draggable={false}
              />
              {powered && <LightPool spot={AMBIENT_LAMP} strength={0.75} ignite={justPowered} delay={0.1} />}
              {powered && <WindowRays strength={0.25 + 0.5 * ratio} />}
              {powered &&
                lit.map((spot, i) => (
                  <LightPool
                    key={spot.id}
                    spot={spot}
                    ignite={justPowered || (!!spot.mission && igniting.includes(spot.mission))}
                    delay={justPowered ? 0.35 + i * 0.18 : 0.15}
                  />
                ))}

              {/* 누를 수 있는 물건들 */}
              {SPOTS.map((spot, i) => {
                const m = getMission(spot.mission!)!;
                const done = cleared.includes(m.id) && !pending.includes(m.id);
                const available = !lockState(m, cleared, today).locked && !done;
                return (
                  <motion.button
                    key={spot.id}
                    type="button"
                    data-fx="custom"
                    aria-label={`${spot.label} — ${m.title}`}
                    onClick={() => open(spot)}
                    animate={denied === spot.id ? { x: [0, -5, 5, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.35 }}
                    className="absolute rounded-full outline-none focus-visible:ring-2 focus-visible:ring-magenta"
                    style={{
                      left: `${px.x(spot.x - spot.r * 0.7)}%`,
                      top: `${px.y(spot.y - spot.r * 0.7)}%`,
                      width: `${px.x(spot.r * 1.4)}%`,
                      height: `${px.y(spot.r * 1.4)}%`,
                    }}
                  >
                    {powered && available && !inspect && <Glint delay={i * 0.7} />}
                  </motion.button>
                );
              })}
              {endingOpen && (
                <Link
                  href="/ending"
                  aria-label="늘곰 연구소로"
                  className="absolute rounded-full"
                  style={{ left: `${px.x(650)}%`, top: `${px.y(960)}%`, width: `${px.x(240)}%`, height: `${px.y(190)}%` }}
                />
              )}
            </div>
          </motion.div>

          {/* 노이즈 · 가장자리 그늘 */}
          <div className="noise pointer-events-none absolute inset-0" style={{ opacity: endingOpen ? 0.04 : 0.35 * (1 - ratio) + 0.08 }} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 75% 70% at 50% 45%, transparent 55%, rgb(0 0 0 / 0.7) 100%)" }}
          />

          {/* 들여다볼 때: 그 물건만 밝게 */}
          <AnimatePresence>
            {inspect && (
              <motion.button
                type="button"
                data-fx="custom"
                aria-label="닫기"
                onClick={close}
                className="absolute inset-0 z-10"
                style={{
                  background: `radial-gradient(circle at ${px.x(inspect.x)}% ${px.y(inspect.y)}%, transparent 0, transparent 18%, rgb(0 0 0 / 0.72) 46%)`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
          </AnimatePresence>

          {/* 첫 터치: 본부 전원 켜기 */}
          {!powered && (
            <button
              type="button"
              data-fx="custom"
              onClick={onPowerOn}
              aria-label="본부 전원 켜기"
              className="absolute inset-0 z-20 cursor-pointer"
            >
              <span
                className="hq-anim pointer-events-none absolute h-[9%] w-[48%] rounded-full border-2 border-cyan-200/70 shadow-[0_0_30px_rgb(127_247_255_/_0.5)]"
                style={{ left: "50%", top: "96%", animation: "hq-touch 1.8s ease-in-out infinite" }}
              />
            </button>
          )}
        </div>

        {/* 앞쪽 먼지 층: 무대보다 앞에 있어 기울이면 다르게 움직인다 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ transform: "translateZ(60px) scale(0.95)" }}>
          {powered && <Dust />}
          <motion.div
            className="absolute inset-y-0 w-[60%]"
            style={{
              left: "20%",
              x: sheenX,
              background: "linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 0.06) 50%, transparent 65%)",
            }}
          />
        </div>
      </motion.div>

      <AnimatePresence>
        {inspect && <InspectCard spot={inspect} cleared={cleared} pending={pending} today={today} endingOpen={endingOpen} onClose={close} />}
      </AnimatePresence>
    </section>
  );
}

/* ───────── 불빛 레이어 ───────── */

function LightPool({ spot, ignite, delay = 0, strength = 1 }: { spot: Spot; ignite: boolean; delay?: number; strength?: number }) {
  const [r, g, b] = spot.glow;
  const at = `${px.x(spot.x)}% ${px.y(spot.y)}%`;
  const mask = `radial-gradient(ellipse ${px.x(spot.r)}% ${px.y(spot.r)}% at ${at}, #000 0%, #000 38%, transparent 100%)`;
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      initial={ignite ? { opacity: 0 } : false}
      animate={{ opacity: ignite ? [0, strength, 0.12, strength * 0.85, 0.3, strength] : strength }}
      transition={ignite ? { duration: 0.95, times: [0, 0.08, 0.18, 0.32, 0.46, 1], delay } : { duration: 0.3 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset(HQ.src)}
        alt=""
        className="absolute inset-0 h-full w-full"
        style={{ maskImage: mask, WebkitMaskImage: mask, filter: "saturate(1.25) brightness(1.18)" }}
        draggable={false}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse ${px.x(spot.r * 1.35)}% ${px.y(spot.r * 1.35)}% at ${at}, rgb(${r} ${g} ${b} / 0.38), rgb(${r} ${g} ${b} / 0) 70%)`,
          mixBlendMode: "screen",
        }}
      />
      {spot.fx && <SpotEffect spot={spot} />}
    </motion.div>
  );
}

function SpotEffect({ spot }: { spot: Spot }) {
  const [r, g, b] = spot.glow;
  const color = `rgb(${r} ${g} ${b})`;
  switch (spot.fx) {
    case "heartbeat":
      return (
        <div
          className="absolute overflow-hidden"
          style={{ left: `${px.x(CRT_SCREEN.x)}%`, top: `${px.y(CRT_SCREEN.y)}%`, width: `${px.x(CRT_SCREEN.w)}%`, height: `${px.y(CRT_SCREEN.h)}%` }}
        >
          <svg
            viewBox="0 0 200 40"
            preserveAspectRatio="none"
            className="hq-anim absolute inset-y-0 left-0 h-full"
            style={{ width: "200%", animation: "hq-heartbeat 2.4s linear infinite", filter: `drop-shadow(0 0 2px ${color})` }}
          >
            <path
              d="M0 22 H30 L36 22 L40 8 L45 34 L50 22 H100 L106 22 L110 8 L115 34 L120 22 H200"
              fill="none"
              stroke={color}
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      );
    case "cone":
      return (
        <div
          className="absolute inset-0"
          style={{
            clipPath: `polygon(${px.x(548)}% ${px.y(585)}%, ${px.x(580)}% ${px.y(585)}%, ${px.x(720)}% ${px.y(800)}%, ${px.x(430)}% ${px.y(800)}%)`,
            background: `linear-gradient(to bottom, rgb(${r} ${g} ${b} / 0.42), rgb(${r} ${g} ${b} / 0) 95%)`,
            mixBlendMode: "screen",
          }}
        />
      );
    case "rings":
      return (
        <>
          {[0, 0.8, 1.6].map((d) => (
            <span
              key={d}
              className="hq-anim absolute rounded-full border-2"
              style={{
                left: `${px.x(spot.x)}%`,
                top: `${px.y(spot.y)}%`,
                width: `${px.x(spot.r * 1.8)}%`,
                height: `${px.y(spot.r * 1.8)}%`,
                borderColor: `rgb(${r} ${g} ${b} / 0.7)`,
                animation: `hq-ring 2.4s ease-out ${d}s infinite`,
              }}
            />
          ))}
        </>
      );
    case "steam":
      return (
        <>
          {[-12, 4, 18].map((dx, k) => (
            <span
              key={dx}
              className="hq-anim absolute rounded-full"
              style={{
                left: `${px.x(spot.x + dx - 9)}%`,
                top: `${px.y(spot.y - 70)}%`,
                width: `${px.x(18)}%`,
                height: `${px.y(56)}%`,
                background: "radial-gradient(ellipse at center, rgb(255 255 255 / 0.55), transparent 70%)",
                filter: "blur(3px)",
                animation: `hq-steam ${2.6 + k * 0.4}s ease-out ${k * 0.7}s infinite`,
              }}
            />
          ))}
        </>
      );
    case "rays":
      return (
        <div
          className="hq-anim absolute"
          style={{
            left: `${px.x(spot.x - 70)}%`,
            top: `${px.y(spot.y + 40)}%`,
            width: `${px.x(140)}%`,
            height: `${px.y(560)}%`,
            transformOrigin: "50% 0",
            transform: `rotate(${spot.x < HQ.w / 2 ? -24 : 24}deg)`,
            background: `linear-gradient(to bottom, rgb(${r} ${g} ${b} / 0.4), rgb(${r} ${g} ${b} / 0) 90%)`,
            filter: "blur(6px)",
            mixBlendMode: "screen",
            animation: "hq-rays 6s ease-in-out infinite",
          }}
        />
      );
    case "pulse":
    case "neon":
      return (
        <div
          className="hq-anim absolute inset-0"
          style={{
            background: `radial-gradient(ellipse ${px.x(spot.r)}% ${px.y(spot.r)}% at ${px.x(spot.x)}% ${px.y(spot.y)}%, rgb(${r} ${g} ${b} / ${spot.fx === "neon" ? 0.5 : 0.3}), transparent 70%)`,
            mixBlendMode: "screen",
            animation: spot.fx === "neon" ? "hq-neon 4s linear infinite" : "hq-pulse 2.6s ease-in-out infinite",
          }}
        />
      );
    default:
      return null;
  }
}

/** 창문에서 쏟아지는 빛줄기 (진행도만큼 진해진다) */
function WindowRays({ strength }: { strength: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ opacity: strength }}>
      {[
        { x: 195, rot: -24 },
        { x: 660, rot: 24 },
      ].map((w) => (
        <div
          key={w.x}
          className="hq-anim absolute"
          style={{
            left: `${px.x(w.x - 60)}%`,
            top: `${px.y(170)}%`,
            width: `${px.x(120)}%`,
            height: `${px.y(520)}%`,
            transformOrigin: "50% 0",
            transform: `rotate(${w.rot}deg)`,
            background: "linear-gradient(to bottom, rgb(130 235 255 / 0.28), transparent 85%)",
            filter: "blur(8px)",
            mixBlendMode: "screen",
            animation: `hq-rays ${7 + (w.x % 3)}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

/** 아직 안 깬 미션 물건에 가끔 반짝이는 표시 */
function Glint({ delay }: { delay: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="hq-anim absolute h-5 w-5"
      style={{ left: "62%", top: "38%", animation: `hq-glint 3.6s ease-in-out ${delay}s infinite`, filter: "drop-shadow(0 0 4px #ff00ff)" }}
    >
      <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="white" />
    </svg>
  );
}

/** 빛 속에 떠다니는 먼지 */
const MOTES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: 30 + ((i * 53) % 60),
  size: 1.5 + (i % 3),
  dur: 9 + (i % 5) * 1.6,
  delay: -((i * 1.9) % 12),
  dx: ((i % 4) - 1.5) * 18,
}));

function Dust() {
  return (
    <>
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="hq-anim absolute rounded-full"
          style={
            {
              left: `${m.left}%`,
              top: `${m.top}%`,
              width: m.size,
              height: m.size,
              background: "rgb(255 236 210 / 0.75)",
              boxShadow: "0 0 6px rgb(255 236 210 / 0.6)",
              animation: `hq-dust ${m.dur}s linear ${m.delay}s infinite`,
              "--dx": `${m.dx}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

/* ───────── 들여다보기 카드 ───────── */

function InspectCard(props: {
  spot: Spot;
  cleared: readonly string[];
  pending: readonly string[];
  today: string;
  endingOpen: boolean;
  onClose: () => void;
}) {
  const { spot, cleared, pending, today, onClose } = props;
  const m = getMission(spot.mission!)!;
  const done = cleared.includes(m.id) && !pending.includes(m.id);
  const lock = lockState(m, cleared, today);
  const locked = lock.locked && !done;
  const atTop = spot.y > HQ.h * 0.55;

  return (
    <motion.div
      role="dialog"
      aria-label={`${spot.label} — ${m.title}`}
      className={`absolute inset-x-3 z-30 rounded-xl border bg-ink/90 p-4 backdrop-blur ${atTop ? "top-3" : "bottom-3"} ${
        locked ? "border-line" : "border-magenta/70"
      }`}
      initial={{ opacity: 0, y: atTop ? -14 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: atTop ? -14 : 14 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      <p className="font-mono text-[10px] tracking-widest text-fog">
        {m.codename} · {spot.label}
      </p>
      <h3 className="mt-0.5 text-lg font-bold">{m.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-300">
        {done ? "불이 들어왔다 · 해결 완료" : locked && lock.locked ? `잠긴 장치 · ${lock.reason}` : m.brief}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" data-fx="custom" onClick={onClose} className="flex-1 rounded-lg border border-line py-2.5 text-sm">
          닫기
        </button>
        {!locked && (
          <Link
            href={`/mission/${m.id}`}
            data-fx="custom"
            onClick={() => feel("thunk", "thunk")}
            className="flex-1 rounded-lg bg-magenta py-2.5 text-center text-sm font-bold text-ink"
          >
            {done ? "다시 들어가기" : "작전 개시"} ›
          </Link>
        )}
      </div>
    </motion.div>
  );
}

/** 대시보드가 쓰는: 켜질 불 개수만큼 지직 소리를 차례로 */
export function playIgnitionHums(count: number, start = 0.25, gap = 0.18) {
  for (let i = 0; i < count; i++) setTimeout(() => play("hum"), (start + i * gap) * 1000);
}
