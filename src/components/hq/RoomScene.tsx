"use client";

import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  type AnimationPlaybackControls,
} from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";
import { feel, haptic, play } from "@/lib/fx";
import { getMission, lockState, MISSIONS, SENSE_NAMES } from "@/lib/missions";
import {
  CUT_AFTER,
  hiSrc,
  loSrc,
  px,
  ROOM,
  SCOPE_SCREEN,
  SEQUENCE,
  STATIONS,
  stationOfMission,
  stationPos,
  type Spot,
  type Station,
} from "@/lib/room";

type Props = {
  cleared: readonly string[];
  /** 픽셀 장착을 기다리는 미션: 아직 불을 켜지 않는다 */
  pending: readonly string[];
  /** 막 장착을 마친 미션: 그 벽으로 돌아가 깜빡이며 켜진다 */
  igniting: readonly string[];
  /** 지금 막 전원이 들어왔다 */
  justPowered: boolean;
  powered: boolean;
  onPowerOn: () => void;
  endingOpen: boolean;
  /** 색채 복구율 0~1 */
  ratio: number;
  today: string;
};

const N = SEQUENCE.length;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const STATION_KEY = "spy-room-station";

function readStation() {
  try {
    const v = Number(sessionStorage.getItem(STATION_KEY));
    return Number.isInteger(v) && v >= 0 && v < STATIONS.length ? v : 0;
  } catch {
    return 0;
  }
}

/** 고리 위 현재 위치에서 dir 방향(+1 다음 / −1 이전)으로 가장 가까운 벽 */
function nextStationFrom(pos: number, dir: 1 | -1) {
  let best = { idx: 0, at: 0, d: Infinity };
  STATIONS.forEach((s, idx) => {
    const base = stationPos(s);
    for (let k = -2; k <= 2; k++) {
      const at = base + Math.round(pos / N) * N + k * N;
      const d = (at - pos) * dir;
      if (d > 0.35 && d < best.d) best = { idx, at, d };
    }
  });
  return best;
}

function nearestStation(pos: number) {
  let best = { idx: 0, at: 0, d: Infinity };
  STATIONS.forEach((s, idx) => {
    const base = stationPos(s);
    for (let k = -2; k <= 2; k++) {
      const at = base + Math.round(pos / N) * N + k * N;
      const d = Math.abs(at - pos);
      if (d < best.d) best = { idx, at, d };
    }
  });
  return best;
}

/** 프레임 i 가 아직 안 왔으면 가장 가까운, 이미 받은 프레임 */
function pick(imgs: (HTMLImageElement | null)[], i: number) {
  if (imgs[i]) return imgs[i];
  for (let d = 1; d < N; d++) {
    const a = imgs[mod(i - d, N)] ?? imgs[mod(i + d, N)];
    if (a) return a;
  }
  return null;
}

/**
 * 360° 늘곰 본부 (2.5D):
 *  - 손가락으로 옆으로 밀면 영상 프레임을 넘기며 방이 돈다 → 놓으면 가장 가까운 벽 앞에 철컥 멈춘다
 *  - 멈춘 벽에서는 선명한 그림 + 미션마다 불이 들어오는 물건 + 눌러서 들여다보기
 */
export function RoomScene(props: Props) {
  const { cleared, pending, igniting, justPowered, powered, onPowerOn, endingOpen, ratio, today } = props;
  const [stationIdx, setStationIdx] = useState(readStation);
  const [atRest, setAtRest] = useState(true);
  const [inspect, setInspect] = useState<Spot | null>(null);
  const [origin, setOrigin] = useState("50% 50%");
  const [denied, setDenied] = useState<string | null>(null);
  const station = STATIONS[stationIdx];

  const p = useMotionValue(stationPos(STATIONS[stationIdx]));
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgs = useRef<(HTMLImageElement | null)[]>(Array(N).fill(null));
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{ x: number; y: number; p0: number; moved: boolean; samples: { t: number; p: number }[] } | null>(null);
  const lastFloor = useRef(Math.floor(p.get()));
  const lastTick = useRef(0);

  const draw = (pos: number) => {
    const c = canvasRef.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const base = Math.floor(pos);
    const t = pos - base;
    const i0 = mod(base, N);
    const a = pick(imgs.current, i0);
    const b = pick(imgs.current, mod(base + 1, N));
    g.globalAlpha = 1;
    if (a) g.drawImage(a, 0, 0, c.width, c.height);
    if (b && t > 0.002) {
      g.globalAlpha = t;
      g.drawImage(b, 0, 0, c.width, c.height);
      g.globalAlpha = 1;
    }
    // 장면이 끊기는 곳: 고개를 홱 돌리듯 어둡게
    if (CUT_AFTER.has(i0) && t > 0) {
      g.fillStyle = `rgba(0,0,0,${0.8 * Math.sin(Math.PI * t)})`;
      g.fillRect(0, 0, c.width, c.height);
    }
  };

  // 회전 중: 프레임 그리기 + 톱니 딸깍 소리
  useMotionValueEvent(p, "change", (v) => {
    draw(v);
    const f = Math.floor(v);
    if (f === lastFloor.current) return;
    const crossed = Math.min(f, lastFloor.current);
    lastFloor.current = f;
    if (CUT_AFTER.has(mod(crossed, N))) play("focus");
    const now = performance.now();
    if (now - lastTick.current > 45) {
      play("tick", { volume: 0.35 });
      lastTick.current = now;
    }
  });

  // 회전용 작은 프레임을 현재 벽에서 가까운 것부터 미리 받아 둔다 (+ 벽 앞 선명한 그림들)
  useEffect(() => {
    let cancelled = false;
    const start = Math.round(p.get());
    const order = Array.from({ length: N }, (_, k) => mod(start + (k % 2 ? (k + 1) / 2 : -k / 2), N));
    const load = (i: number) =>
      new Promise<void>((res) => {
        const im = new Image();
        im.decoding = "async";
        im.onload = () => {
          if (!cancelled) {
            imgs.current[i] = im;
            draw(p.get());
          }
          res();
        };
        im.onerror = () => res();
        im.src = asset(loSrc(SEQUENCE[i]));
      });
    (async () => {
      for (let k = 0; k < order.length; k += 6) {
        if (cancelled) return;
        await Promise.all(order.slice(k, k + 6).map(load));
      }
      STATIONS.forEach((s) => {
        const im = new Image();
        im.src = asset(hiSrc(s.frame));
      });
    })();
    return () => {
      cancelled = true;
    };
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 벽(idx) 앞으로 돌아간다. at 은 고리 위 목표 위치 */
  const goTo = (idx: number, at: number) => {
    anim.current?.stop();
    setInspect(null);
    setAtRest(false);
    setStationIdx(idx);
    const dist = Math.abs(at - p.get());
    anim.current = animate(p, at, {
      duration: Math.min(1.2, 0.2 + dist * 0.075),
      ease: [0.45, 0, 0.25, 1],
      onComplete: () => {
        setAtRest(true);
        feel("switch", "select");
        try {
          sessionStorage.setItem(STATION_KEY, String(idx));
        } catch {}
      },
    });
  };
  const turn = (dir: 1 | -1) => {
    if (!powered) return onPowerOn();
    const n = nextStationFrom(p.get(), dir);
    goTo(n.idx, n.at);
  };

  // 픽셀 장착을 마친 미션이 있으면 그 벽으로 돌아가 불을 켠다
  const goToRef = useRef(goTo);
  useEffect(() => {
    goToRef.current = goTo;
  });
  useEffect(() => {
    if (!igniting.length) return;
    const idx = stationOfMission(igniting[0]);
    if (idx < 0) return;
    const base = stationPos(STATIONS[idx]);
    const cur = p.get();
    const at = base + Math.round((cur - base) / N) * N;
    if (Math.abs(at - cur) > 0.01) goToRef.current(idx, at);
  }, [igniting, p]);

  /* ───── 손가락으로 돌리기 ───── */
  const pxPerFrame = () => (boxRef.current?.clientWidth ?? 360) / 9;
  const onPointerDown = (e: React.PointerEvent) => {
    if (inspect || !powered) return;
    anim.current?.stop();
    drag.current = { x: e.clientX, y: e.clientY, p0: p.get(), moved: false, samples: [{ t: performance.now(), p: p.get() }] };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.current = null; // 세로 스크롤
        return;
      }
      d.moved = true;
      setAtRest(false);
      setInspect(null);
      haptic("tick");
    }
    const v = d.p0 - dx / pxPerFrame();
    p.set(v);
    d.samples.push({ t: performance.now(), p: v });
    if (d.samples.length > 6) d.samples.shift();
  };
  const onPointerEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      // 움직이지 않았는데 벽 사이에 서 있으면 가까운 벽으로
      if (!atRest) {
        const n = nearestStation(p.get());
        goTo(n.idx, n.at);
      }
      return;
    }
    const a = d.samples[0];
    const b = d.samples[d.samples.length - 1];
    const vel = (b.p - a.p) / Math.max(0.016, (b.t - a.t) / 1000); // 프레임/초
    const cur = p.get();
    let target = nearestStation(cur + vel * 0.18);
    if (Math.abs(vel) > 5 && (target.at - cur) * Math.sign(vel) <= 0.35) {
      target = nextStationFrom(cur, vel > 0 ? 1 : -1); // 휙 밀면 적어도 다음 벽까지
    }
    goTo(target.idx, target.at);
  };

  /* ───── 물건 들여다보기 ───── */
  const open = (spot: Spot) => {
    if (!powered) return onPowerOn();
    const m = spot.mission ? getMission(spot.mission) : undefined;
    const locked = spot.kind === "exit" ? !endingOpen : m ? lockState(m, cleared, today).locked && !cleared.includes(m.id) : false;
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

  const isLit = (spot: Spot) =>
    endingOpen ||
    (spot.kind === "map" ? false : !!spot.mission && cleared.includes(spot.mission) && !pending.includes(spot.mission));

  const baseFilter = !powered
    ? "grayscale(1) brightness(0.3) contrast(1.05)"
    : endingOpen
      ? "grayscale(0) brightness(1) contrast(1)"
      : `grayscale(${0.9 - 0.55 * ratio}) brightness(${0.5 + 0.22 * ratio}) contrast(1.06)`;

  // 벽 표시점: 아직 할 미션이 있는 벽은 마젠타
  const hasOpenMission = (s: Station) =>
    s.spots.some((sp) => {
      const m = sp.mission ? getMission(sp.mission) : undefined;
      return !!m && !cleared.includes(m.id) && !lockState(m, cleared, today).locked;
    });

  return (
    <section
      aria-label="늘곰 본부 360° 둘러보기"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") turn(1);
        if (e.key === "ArrowLeft") turn(-1);
      }}
      className="relative -mx-4 select-none outline-none"
    >
      <div
        ref={boxRef}
        className="relative overflow-hidden bg-black"
        style={{ aspectRatio: `${ROOM.w} / ${ROOM.h}`, touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* 카메라: 들여다볼 때 그쪽으로 다가간다 */}
        <motion.div
          className="absolute inset-0"
          style={{ transformOrigin: origin }}
          animate={{ scale: inspect ? 1.8 : 1 }}
          transition={{ type: "spring", stiffness: 110, damping: 20 }}
        >
          {/* 회전 중 프레임 */}
          <canvas
            ref={canvasRef}
            width={ROOM.w / 2}
            height={ROOM.h / 2}
            className="absolute inset-0 h-full w-full"
            style={{ filter: baseFilter, transition: "filter 1.2s ease" }}
          />

          {/* 벽 앞에 멈췄을 때: 선명한 그림 + 불빛 + 누를 수 있는 물건 */}
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: atRest ? 1 : 0 }}
            transition={{ duration: atRest ? 0.25 : 0.06 }}
            style={{ pointerEvents: atRest ? "auto" : "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={station.frame}
              src={asset(hiSrc(station.frame))}
              alt={`늘곰 본부 · ${station.name}`}
              className="absolute inset-0 h-full w-full"
              style={{ filter: baseFilter, transition: "filter 1.2s ease" }}
              draggable={false}
            />
            {atRest && powered && (
              <>
                {station.lamps?.map((l, i) => (
                  <LightPool
                    key={`lamp-${station.id}-${i}`}
                    src={asset(hiSrc(station.frame))}
                    spot={{ id: `lamp${i}`, label: "", x: l.x, y: l.y, r: l.r, glow: [255, 196, 120] }}
                    strength={0.8}
                    ignite={justPowered}
                    delay={0.1}
                  />
                ))}
                {station.spots.filter(isLit).map((spot, i) => (
                  <LightPool
                    key={`${station.id}-${spot.id}`}
                    src={asset(hiSrc(station.frame))}
                    spot={spot}
                    ignite={justPowered || (!!spot.mission && igniting.includes(spot.mission))}
                    delay={0.3 + i * 0.2}
                  />
                ))}
              </>
            )}

            {/* 누를 수 있는 물건 */}
            {station.spots.map((spot, i) => {
              const m = spot.mission ? getMission(spot.mission) : undefined;
              const available = !!m && !cleared.includes(m.id) && !lockState(m, cleared, today).locked;
              return (
                <motion.button
                  key={spot.id}
                  type="button"
                  data-fx="custom"
                  aria-label={`${spot.label}${m ? ` — ${m.title}` : ""}`}
                  onClick={() => open(spot)}
                  animate={denied === spot.id ? { x: [0, -5, 5, -4, 4, 0] } : { x: 0 }}
                  transition={{ duration: 0.35 }}
                  className="absolute rounded-full outline-none focus-visible:ring-2 focus-visible:ring-magenta"
                  style={{
                    left: `${px.x(spot.x - spot.r * 0.72)}%`,
                    top: `${px.y(spot.y - spot.r * 0.72)}%`,
                    width: `${px.x(spot.r * 1.44)}%`,
                    height: `${px.y(spot.r * 1.44)}%`,
                  }}
                >
                  {powered && available && !inspect && <Glint delay={i * 0.8} />}
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>

        {/* 노이즈 · 가장자리 그늘 · 먼지 */}
        <div className="noise pointer-events-none absolute inset-0" style={{ opacity: endingOpen ? 0.04 : 0.3 * (1 - ratio) + 0.08 }} />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 78% 72% at 50% 45%, transparent 55%, rgb(0 0 0 / 0.7) 100%)" }}
        />
        {powered && <Dust />}

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

        {/* 머리글 */}
        <p className="pointer-events-none absolute inset-x-0 top-2 text-center font-mono text-[10px] tracking-[0.3em] text-zinc-300/80">
          AGENT &lsquo;늘곰&rsquo; HQ · 360°
        </p>

        {/* 첫 터치: 본부 전원 켜기 */}
        {!powered && (
          <button type="button" data-fx="custom" onClick={onPowerOn} aria-label="본부 전원 켜기" className="absolute inset-0 z-20 cursor-pointer">
            <span className="pointer-events-none absolute inset-x-0 bottom-[12%] flex flex-col items-center gap-2">
              <span
                className="hq-anim block h-14 w-14 rounded-full border-2 border-cyan-200/70 shadow-[0_0_30px_rgb(127_247_255_/_0.5)]"
                style={{ animation: "hq-touch-static 1.8s ease-in-out infinite" }}
              />
              <span className="font-mono text-xs tracking-[0.25em] text-cyan-100">TOUCH TO INTERACT</span>
            </span>
          </button>
        )}
      </div>

      {/* 아래 조작줄: 돌리기 · 지금 벽 · 벽 표시점 */}
      <div className="flex items-center justify-between gap-2 px-4 pt-2">
        <TurnButton dir={-1} onClick={() => turn(-1)} />
        <div className="flex min-w-0 flex-col items-center gap-1" aria-live="polite">
          <span className="truncate text-sm font-bold">{station.name}</span>
          <span className="flex gap-1.5" aria-hidden>
            {STATIONS.map((s, i) => (
              <span
                key={s.id}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: i === stationIdx ? "#ffffff" : hasOpenMission(s) ? "#ff00ff" : "#4a4a52",
                  boxShadow: hasOpenMission(s) && i !== stationIdx ? "0 0 6px #ff00ff" : undefined,
                }}
              />
            ))}
          </span>
        </div>
        <TurnButton dir={1} onClick={() => turn(1)} />
      </div>

      <AnimatePresence>
        {inspect && (
          <InspectCard spot={inspect} cleared={cleared} pending={pending} today={today} endingOpen={endingOpen} onClose={close} />
        )}
      </AnimatePresence>
    </section>
  );
}

function TurnButton({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      data-fx="custom"
      onClick={onClick}
      aria-label={dir > 0 ? "오른쪽 벽으로 돌기" : "왼쪽 벽으로 돌기"}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-lg text-zinc-200 active:bg-white/10"
    >
      {dir > 0 ? "›" : "‹"}
    </button>
  );
}

/* ───────── 불빛 레이어 ───────── */

function LightPool({ src, spot, ignite, delay = 0, strength = 1 }: { src: string; spot: Spot; ignite: boolean; delay?: number; strength?: number }) {
  const [r, g, b] = spot.glow;
  const at = `${px.x(spot.x)}% ${px.y(spot.y)}%`;
  const mask = `radial-gradient(ellipse ${px.x(spot.r)}% ${px.y(spot.r)}% at ${at}, #000 0%, #000 38%, transparent 100%)`;

  // 켜지는 순간 지직
  useEffect(() => {
    if (!ignite) return;
    const t = setTimeout(() => play("hum"), delay * 1000);
    return () => clearTimeout(t);
    // 켜질 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      initial={ignite ? { opacity: 0 } : false}
      animate={{ opacity: ignite ? [0, strength, 0.12, strength * 0.85, 0.3, strength] : strength }}
      transition={ignite ? { duration: 0.95, times: [0, 0.08, 0.18, 0.32, 0.46, 1], delay } : { duration: 0.3 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full"
        style={{ maskImage: mask, WebkitMaskImage: mask, filter: "saturate(1.25) brightness(1.18)" }}
        draggable={false}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse ${px.x(spot.r * 1.35)}% ${px.y(spot.r * 1.35)}% at ${at}, rgb(${r} ${g} ${b} / 0.36), rgb(${r} ${g} ${b} / 0) 70%)`,
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
          style={{ left: `${px.x(SCOPE_SCREEN.x)}%`, top: `${px.y(SCOPE_SCREEN.y)}%`, width: `${px.x(SCOPE_SCREEN.w)}%`, height: `${px.y(SCOPE_SCREEN.h)}%` }}
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
              strokeWidth="1.8"
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
            clipPath: `polygon(${px.x(248)}% ${px.y(336)}%, ${px.x(306)}% ${px.y(336)}%, ${px.x(430)}% ${px.y(565)}%, ${px.x(160)}% ${px.y(565)}%)`,
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
    case "rays":
      return (
        <>
          {[-34, -22].map((rot, k) => (
            <div
              key={rot}
              className="hq-anim absolute"
              style={{
                left: `${px.x(spot.x - 60 + k * 70)}%`,
                top: `${px.y(spot.y + 60)}%`,
                width: `${px.x(110)}%`,
                height: `${px.y(460)}%`,
                transformOrigin: "50% 0",
                transform: `rotate(${rot}deg)`,
                background: `linear-gradient(to bottom, rgb(${r} ${g} ${b} / 0.4), rgb(${r} ${g} ${b} / 0) 90%)`,
                filter: "blur(6px)",
                mixBlendMode: "screen",
                animation: `hq-rays ${6 + k}s ease-in-out infinite`,
              }}
            />
          ))}
        </>
      );
    case "screen":
      return (
        <div
          className="hq-anim absolute"
          style={{
            left: `${px.x(spot.x - spot.r * 0.85)}%`,
            top: `${px.y(spot.y - spot.r * 0.7)}%`,
            width: `${px.x(spot.r * 1.7)}%`,
            height: `${px.y(spot.r * 1.4)}%`,
            background: `repeating-linear-gradient(to bottom, rgb(${r} ${g} ${b} / 0.18) 0 2px, transparent 2px 5px)`,
            mixBlendMode: "screen",
            animation: "hq-pulse 1.6s ease-in-out infinite",
          }}
        />
      );
    case "bubbles":
      return (
        <>
          {[
            [230, 230],
            [295, 230],
            [262, 455],
            [318, 458],
            [246, 225],
            [305, 452],
          ].map(([x, y], k) => (
            <span
              key={k}
              className="hq-anim absolute rounded-full"
              style={{
                left: `${px.x(x)}%`,
                top: `${px.y(y)}%`,
                width: `${px.x(7 + (k % 3) * 2)}%`,
                aspectRatio: "1",
                background: `rgb(${r} ${g} ${b} / 0.75)`,
                boxShadow: `0 0 8px ${color}`,
                animation: `hq-bubble ${1.8 + (k % 3) * 0.5}s ease-in ${k * 0.35}s infinite`,
              }}
            />
          ))}
        </>
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
const MOTES = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: 30 + ((i * 53) % 60),
  size: 1.5 + (i % 3),
  dur: 9 + (i % 5) * 1.6,
  delay: -((i * 1.9) % 12),
  dx: ((i % 4) - 1.5) * 18,
}));

function Dust() {
  return (
    <div className="pointer-events-none absolute inset-0">
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
    </div>
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
  const { spot, cleared, pending, today, endingOpen, onClose } = props;
  const atTop = spot.y > ROOM.h * 0.55;
  const box = `absolute inset-x-3 z-30 rounded-xl border bg-ink/90 p-4 backdrop-blur ${atTop ? "top-3" : "bottom-14"}`;
  const motionProps = {
    initial: { opacity: 0, y: atTop ? -14 : 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: atTop ? -14 : 14 },
    transition: { type: "spring" as const, stiffness: 260, damping: 24 },
  };
  const closeBtn = (
    <button type="button" data-fx="custom" onClick={onClose} className="flex-1 rounded-lg border border-line py-2.5 text-sm">
      닫기
    </button>
  );

  // 탈출 문 = 엔딩
  if (spot.kind === "exit") {
    return (
      <motion.div role="dialog" aria-label="탈출 문" className={`${box} ${endingOpen ? "border-magenta" : "border-line"}`} {...motionProps}>
        <p className="font-mono text-[10px] tracking-widest text-fog">EXIT · 탈출 문</p>
        <h3 className="mt-0.5 text-lg font-bold">{endingOpen ? "탈출 문이 열렸다!" : "굳게 잠긴 탈출 문"}</h3>
        <p className="mt-1 text-sm leading-relaxed text-zinc-300">
          {endingOpen ? "문 너머에서 늘곰의 목소리가 들린다. 늘곰 연구소로 가자." : "모든 작전이 끝나는 날, 본부가 이 문을 연다."}
        </p>
        <div className="mt-3 flex gap-2">
          {closeBtn}
          {endingOpen && (
            <Link href="/ending" data-fx="custom" onClick={() => feel("thunk", "thunk")} className="flex-1 rounded-lg bg-magenta py-2.5 text-center text-sm font-bold text-ink">
              연구소로 ›
            </Link>
          )}
        </div>
      </motion.div>
    );
  }

  // 작전 지도 = 제3구역 벙커 안내
  if (spot.kind === "map") {
    const booths = MISSIONS.filter((m) => m.zone === 3);
    return (
      <motion.div role="dialog" aria-label="작전 지도" className={`${box} border-magenta/60`} {...motionProps}>
        <p className="font-mono text-[10px] tracking-widest text-fog">MAP · 제3구역 벙커</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {booths.map((m) => {
            const done = cleared.includes(m.id);
            const lock = lockState(m, cleared, today);
            return (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {m.codename} · {m.title}
                  {m.senses && <span className="ml-1 text-xs text-fog">({m.senses.map((s) => SENSE_NAMES[s]).join("·")})</span>}
                </span>
                <span className={`shrink-0 font-mono text-[11px] ${done ? "text-magenta" : "text-fog"}`}>
                  {done ? "탈환" : lock.locked ? lock.reason : "열림"}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex">{closeBtn}</div>
      </motion.div>
    );
  }

  const m = getMission(spot.mission!)!;
  const done = cleared.includes(m.id) && !pending.includes(m.id);
  const lock = lockState(m, cleared, today);
  const locked = lock.locked && !done;
  return (
    <motion.div role="dialog" aria-label={`${spot.label} — ${m.title}`} className={`${box} ${locked ? "border-line" : "border-magenta/70"}`} {...motionProps}>
      <p className="font-mono text-[10px] tracking-widest text-fog">
        {m.codename} · {spot.label}
      </p>
      <h3 className="mt-0.5 text-lg font-bold">{m.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-300">
        {done ? "불이 들어왔다 · 해결 완료" : lock.locked ? `잠긴 장치 · ${lock.reason}` : m.brief}
      </p>
      <div className="mt-3 flex gap-2">
        {closeBtn}
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
