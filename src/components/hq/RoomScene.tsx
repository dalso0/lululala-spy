"use client";

import {
  animate,
  AnimatePresence,
  motion,
  motionValue,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";
import { feel, haptic, play } from "@/lib/fx";
import { D_DAY_KO, getMission, lockState, MISSIONS, SENSE_NAMES } from "@/lib/missions";
import {
  LAMP_CONE,
  LAMPS,
  PANO,
  PREVIEW_SCALE,
  PREVIEW_SRC,
  regionAt,
  SCOPE_SCREEN,
  SPOTS,
  STOPS,
  spotOfMission,
  tileSrc,
  wrap,
  wrapDelta,
  type Rgb,
  type Spot,
} from "@/lib/room";

type Props = {
  cleared: readonly string[];
  /** 픽셀 장착을 기다리는 미션: 아직 불을 켜지 않는다 */
  pending: readonly string[];
  /** 막 장착을 마친 미션: 그쪽으로 돌아가 깜빡이며 켜진다 */
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

const PAN_KEY = "spy-room-pan";
const LAMP_GLOW: Rgb = [255, 196, 120];
/** 물건을 들여다볼 때 다가가는 정도 */
const ZOOM_IN = 1.45;
const EASE = [0.3, 0, 0.2, 1] as const;

function readPan() {
  try {
    const raw = sessionStorage.getItem(PAN_KEY);
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) ? v : STOPS[0].x;
  } catch {
    return STOPS[0].x;
  }
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** 돌아가는 시간(초): 멀수록 조금 길게 */
const glideSec = (dist: number) => (reducedMotion() ? 0 : Math.min(1.1, 0.35 + Math.abs(dist) / (PANO.h * 3.4)));

// 불이 깜빡이며 켜지는 밝기 곡선 (0.95초)
const FLICKER_MS = 950;
const FLICKER_T = [0, 0.08, 0.18, 0.32, 0.46, 1];
const FLICKER_V = [0, 1, 0.12, 0.85, 0.3, 1];
function flicker(ms: number) {
  if (ms <= 0) return 0;
  const t = ms / FLICKER_MS;
  if (t >= 1) return 1;
  for (let i = 1; i < FLICKER_T.length; i++) {
    if (t <= FLICKER_T[i]) {
      const k = (t - FLICKER_T[i - 1]) / (FLICKER_T[i] - FLICKER_T[i - 1]);
      return FLICKER_V[i - 1] + (FLICKER_V[i] - FLICKER_V[i - 1]) * k;
    }
  }
  return 1;
}

/** 파노라마 x 구간 [left, left+width) 를 덮는 타일 번호들 (고리 따라) */
function tilesFor(left: number, width: number) {
  const out = new Set<number>();
  for (let x = left; x < left + width; x += PANO.tile / 2) out.add(Math.min(PANO.tiles - 1, Math.floor(wrap(x) / PANO.tile)));
  out.add(Math.min(PANO.tiles - 1, Math.floor(wrap(left + width - 1) / PANO.tile)));
  return [...out];
}

/** t 근처(radius 안)에 멈춤 자리가 있으면 그리로 붙인다 */
function snapNear(t: number, radius: number) {
  let best = t;
  let bestD = radius;
  for (const st of STOPS) {
    const d = wrapDelta(st.x - t);
    if (Math.abs(d) < bestD) {
      bestD = Math.abs(d);
      best = t + d;
    }
  }
  return best;
}

/**
 * 360° 늘곰 본부 (2.5D 파노라마):
 *  - 본부를 한 바퀴 이어 붙인 파노라마를 손가락과 1:1로 민다 → 놓으면 관성으로 미끄러지다 물건 앞에서 살짝 붙는다
 *  - 캔버스 두 장: 바닥(회색 안개 필터) + 불빛(깬 미션 물건만 원래 색으로, 깜빡이며 켜짐)
 *  - 들여다보기(확대)도 캔버스가 원본에서 바로 다시 그려서 흐려지지 않는다
 *  - 물건 위의 단추·효과(심박선·불빛 원뿔·음파…)는 같은 계산으로 함께 움직인다
 */
export function RoomScene(props: Props) {
  const { cleared, pending, igniting, justPowered, powered, onPowerOn, endingOpen, ratio, today } = props;

  const boxRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const lightRef = useRef<HTMLCanvasElement>(null);
  /** 화면 가운데의 파노라마 x (고리라서 끝없이 커지거나 작아져도 된다) */
  const pan = useMotionValue(0);
  /** 들여다볼 때 1 → ZOOM_IN */
  const zoom = useMotionValue(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [region, setRegion] = useState<string>(STOPS[0].name);
  const [inspect, setInspect] = useState<Spot | null>(null);
  /** 들여다보는 높이 (파노라마 px) */
  const [focusY, setFocusY] = useState(PANO.h / 2);
  const [denied, setDenied] = useState<string | null>(null);
  /** 물건 효과(심박선·원뿔…)의 밝기: 캔버스 불빛과 함께 깜빡인다 */
  const [fxAlpha] = useState(() => new Map(SPOTS.map((sp) => [sp.id, motionValue(1)])));

  const tiles = useRef<(HTMLImageElement | null)[]>(Array(PANO.tiles).fill(null));
  const preview = useRef<HTMLImageElement | null>(null);
  const cache = useRef(new Map<string, HTMLCanvasElement>());
  const igniteAt = useRef(new Map<string, number>());
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const zoomAnim = useRef<AnimationPlaybackControls | null>(null);
  const glideTarget = useRef<number | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; pan0: number; moved: boolean; samples: { t: number; v: number }[] } | null>(null);
  const justDragged = useRef(0);
  const raf = useRef(0);
  const prevPan = useRef(0);
  const focusRef = useRef(PANO.h / 2);

  const s = size.h ? size.h / PANO.h : 0; // 화면 px / 파노라마 px
  const viewW = s ? size.w / s : 0; // 화면에 보이는 파노라마 폭

  const isLit = (sp: Spot) =>
    endingOpen || (sp.kind === undefined && !!sp.mission && cleared.includes(sp.mission) && !pending.includes(sp.mission));
  const lit = SPOTS.filter(isLit);
  const live = useRef({ lit, powered });
  useLayoutEffect(() => {
    live.current = { lit, powered };
  });

  /* ───────── 그리기 ───────── */

  const renderRef = useRef<() => void>(() => {});
  /** 다음 프레임에 한 번 다시 그리기 */
  const loop = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      renderRef.current();
    });
  };

  /** 파노라마 [left, left+width) × [top, top+height) 를 g 의 (0,0)부터 scale 배로 그린다 (고리 따라) */
  const blit = (g: CanvasRenderingContext2D, left: number, width: number, top: number, height: number, scale: number) => {
    const sy = Math.max(0, top);
    const ey = Math.min(PANO.h, top + height);
    if (ey <= sy) return;
    const dy = (sy - top) * scale;
    const dh = (ey - sy) * scale;
    let x = left;
    const end = left + width;
    for (let guard = 0; x < end - 0.01 && guard < 24; guard++) {
      const local = wrap(x);
      const ti = Math.min(PANO.tiles - 1, Math.floor(local / PANO.tile));
      const t0 = ti * PANO.tile;
      const t1 = Math.min(t0 + PANO.tile, PANO.w);
      const w = Math.min(t1 - local, end - x);
      const dx = (x - left) * scale;
      const img = tiles.current[ti];
      if (img) g.drawImage(img, local - t0, sy, w, ey - sy, dx, dy, w * scale + 0.6, dh);
      else if (preview.current) {
        const k = PREVIEW_SCALE;
        g.drawImage(preview.current, local / k, sy / k, w / k, (ey - sy) / k, dx, dy, w * scale + 0.6, dh);
      }
      x += w;
    }
  };

  /** 불빛용: 물건 자리를 원래 색으로 오려 가장자리를 부드럽게 (한 번 만들어 두고 재사용) */
  const ensureCache = (key: string, x: number, y: number, r: number) => {
    if (cache.current.has(key)) return;
    if (!tilesFor(x - r, 2 * r).every((i) => tiles.current[i])) return;
    const d = Math.ceil(r * 2);
    const c = document.createElement("canvas");
    c.width = d;
    c.height = d;
    const g = c.getContext("2d");
    if (!g) return;
    blit(g, x - r, 2 * r, y - r, 2 * r, 1);
    g.globalCompositeOperation = "destination-in";
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, "#000");
    grad.addColorStop(0.38, "#000");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, d, d);
    cache.current.set(key, c);
  };

  const render = () => {
    const base = baseRef.current;
    const light = lightRef.current;
    if (!base || !light || !base.width || !base.height) return;
    const vw = base.width;
    const vh = base.height;
    const z = zoom.get();
    const k = (vh / PANO.h) * z; // 기기 px / 파노라마 px
    const center = pan.get();
    const left = center - vw / k / 2;
    const top = focusRef.current * (1 - 1 / z);

    const g = base.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.clearRect(0, 0, vw, vh);
    blit(g, left, vw / k, top, PANO.h / z, k);

    const lg = light.getContext("2d");
    if (!lg) return;
    lg.clearRect(0, 0, vw, vh);
    const { lit: litNow, powered: on } = live.current;
    if (!on) return;
    lg.imageSmoothingEnabled = true;
    lg.imageSmoothingQuality = "high";
    const now = performance.now();
    let animating = false;
    const drawLight = (key: string, x: number, y: number, r: number, glow: Rgb, strength = 1) => {
      let a = strength;
      const t0 = igniteAt.current.get(key);
      if (t0 !== undefined) {
        const e = now - t0;
        a = strength * flicker(e);
        if (e < FLICKER_MS) animating = true;
        else igniteAt.current.delete(key);
      }
      fxAlpha.get(key)?.set(a / strength);
      const cx = vw / 2 + wrapDelta(x - center) * k;
      const cy = (y - top) * k;
      const rr = r * k;
      if (a <= 0.001 || cx + rr * 1.4 < 0 || cx - rr * 1.4 > vw) return;
      const c = cache.current.get(key);
      lg.globalAlpha = a;
      if (c) lg.drawImage(c, cx - rr, cy - rr, rr * 2, rr * 2);
      lg.globalCompositeOperation = "screen";
      const grad = lg.createRadialGradient(cx, cy, 0, cx, cy, rr * 1.35);
      grad.addColorStop(0, `rgba(${glow[0]},${glow[1]},${glow[2]},0.34)`);
      grad.addColorStop(0.7, `rgba(${glow[0]},${glow[1]},${glow[2]},0)`);
      lg.fillStyle = grad;
      lg.fillRect(cx - rr * 1.4, cy - rr * 1.4, rr * 2.8, rr * 2.8);
      lg.globalCompositeOperation = "source-over";
      lg.globalAlpha = 1;
    };
    LAMPS.forEach((l, i) => drawLight(`lamp${i}`, l.x, l.y, l.r, LAMP_GLOW, 0.8));
    litNow.forEach((sp) => drawLight(sp.id, sp.x, sp.y, sp.r, sp.glow));
    if (animating) loop();
  };
  useLayoutEffect(() => {
    renderRef.current = render;
  });

  /* ───────── 준비: 크기 · 처음 위치 · 타일 받기 ───────── */

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const p0 = readPan();
    prevPan.current = p0;
    pan.set(p0);
    setRegion(regionAt(p0));
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pan]);

  useLayoutEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    for (const c of [baseRef.current, lightRef.current]) {
      if (!c) continue;
      c.width = Math.round(size.w * dpr);
      c.height = Math.round(size.h * dpr);
    }
    renderRef.current();
  }, [size]);

  useEffect(() => {
    let cancelled = false;
    const load = (src: string, done: (im: HTMLImageElement) => void) => {
      const im = new Image();
      im.decoding = "async";
      im.src = asset(src);
      im.decode()
        .then(() => !cancelled && done(im))
        .catch(() => {});
    };
    load(PREVIEW_SRC, (im) => {
      preview.current = im;
      renderRef.current();
    });
    // 지금 보는 곳에서 가까운 타일부터
    const here = Math.floor(wrap(pan.get()) / PANO.tile);
    const ring = (i: number) => Math.min(Math.abs(i - here), PANO.tiles - Math.abs(i - here));
    Array.from({ length: PANO.tiles }, (_, i) => i)
      .sort((a, b) => ring(a) - ring(b))
      .forEach((i) =>
        load(tileSrc(i), (im) => {
          tiles.current[i] = im;
          LAMPS.forEach((l, j) => ensureCache(`lamp${j}`, l.x, l.y, l.r));
          SPOTS.forEach((sp) => ensureCache(sp.id, sp.x, sp.y, sp.r));
          renderRef.current();
        }),
      );
    return () => {
      cancelled = true;
    };
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const frame = raf;
    const a = anim;
    const z = zoomAnim;
    return () => {
      cancelAnimationFrame(frame.current);
      a.current?.stop();
      z.current?.stop();
    };
  }, []);

  /* ───────── 전원 · 불 켜기 (그리기 전에 정해 두려고 layout effect) ───────── */

  // 전원이 들어오면: 작은 등과 켜져 있던 물건이 차례로 깜빡이며 켜진다
  useLayoutEffect(() => {
    if (!justPowered) return;
    const now = performance.now();
    LAMPS.forEach((_, i) => igniteAt.current.set(`lamp${i}`, now + 120 + i * 90));
    const half = (viewW || 600) / 2;
    live.current.lit.forEach((sp, i) => {
      const at = 380 + i * 160;
      igniteAt.current.set(sp.id, now + at);
      if (Math.abs(wrapDelta(sp.x - pan.get())) < half + sp.r) setTimeout(() => play("hum"), at);
    });
    renderRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justPowered]);

  // 픽셀 장착을 마친 미션: 그 물건 쪽으로 돌아간 뒤 깜빡이며 켠다
  useLayoutEffect(() => {
    const spots = igniting.map((id) => spotOfMission(id)).filter((sp): sp is Spot => !!sp);
    if (!spots.length) return;
    const from = pan.get();
    const to = from + wrapDelta(spots[0].x - from);
    const sec = glideSec(to - from);
    anim.current?.stop();
    glideTarget.current = to;
    anim.current = animate(pan, to, { duration: sec, ease: EASE, onComplete: settle });
    const now = performance.now();
    spots.forEach((sp, i) => {
      const at = sec * 1000 + 150 + i * 200;
      igniteAt.current.set(sp.id, now + at);
      setTimeout(() => play("hum"), at);
    });
    renderRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igniting]);

  // 전원 · 불 켜진 물건이 바뀌면 다시 그린다
  useLayoutEffect(() => {
    renderRef.current();
  }, [powered, endingOpen, cleared, pending]);

  // 움직일 때: 다시 그리기 · 지금 있는 곳 이름 · 물건 앞을 지나면 '딸깍'
  useMotionValueEvent(pan, "change", (v) => {
    render();
    const name = regionAt(v);
    if (name !== region) setRegion(name);
    const p = prevPan.current;
    prevPan.current = v;
    for (const st of STOPS) {
      const a = wrapDelta(st.x - p);
      const b = wrapDelta(st.x - v);
      if (Math.abs(a - b) > PANO.w / 2) continue;
      if ((a > 0.5 && b <= 0.5) || (a < -0.5 && b >= -0.5)) {
        play("tick", { volume: 0.3 });
        haptic("tick");
        break;
      }
    }
  });
  useMotionValueEvent(zoom, "change", () => render());

  /* ───────── 둘러보기 ───────── */

  function settle() {
    glideTarget.current = null;
    try {
      sessionStorage.setItem(PAN_KEY, String(wrap(pan.get())));
    } catch {}
  }

  const glide = (to: number) => {
    anim.current?.stop();
    glideTarget.current = to;
    anim.current = animate(pan, to, { duration: glideSec(to - pan.get()), ease: EASE, onComplete: settle });
  };

  const zoomTo = (to: number) => {
    zoomAnim.current?.stop();
    zoomAnim.current = animate(zoom, to, reducedMotion() ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (inspect || !powered || !s) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    anim.current?.stop(); // 미끄러지던 화면을 손가락으로 붙잡는다
    glideTarget.current = null;
    const t = performance.now();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, pan0: pan.get(), moved: false, samples: [{ t, v: pan.get() }] };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.current = null; // 세로로 미는 건 화면 스크롤
        return;
      }
      d.moved = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    const v = d.pan0 - dx / s; // 손가락 밑의 그림이 손가락을 그대로 따라온다
    pan.set(v);
    const t = performance.now();
    d.samples.push({ t, v });
    while (d.samples.length > 2 && t - d.samples[0].t > 100) d.samples.shift();
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) return;
    const now = performance.now();
    justDragged.current = now;
    // 떼기 직전 80ms 동안 움직인 빠르기 (50ms 넘게 멈췄다가 떼면 0)
    const b = d.samples[d.samples.length - 1];
    const a = d.samples.find((p) => b.t - p.t <= 80) ?? b;
    const maxV = viewW * 6;
    const vel = now - b.t < 50 && b.t - a.t > 8 ? Math.max(-maxV, Math.min(maxV, ((b.v - a.v) / (b.t - a.t)) * 1000)) : 0;
    if (Math.abs(vel) < viewW * 0.15) return settle(); // 거의 멈춰서 뗐으면 놓은 자리 그대로
    // 관성: 멈출 곳은 '지금 값 + 빠르기'로 정해지고 목표값은 쓰이지 않는다.
    // 다만 지금 값과 같은 목표를 주면 framer 가 움직일 게 없다며 건너뛰므로 +1 을 준다.
    anim.current = animate(pan, pan.get() + 1, {
      type: "inertia",
      velocity: vel,
      power: 0.45,
      timeConstant: 320,
      restDelta: 0.3,
      modifyTarget: (t) => snapNear(t, viewW * 0.3),
      onComplete: settle,
    });
  };

  const closeInspect = () => {
    zoomTo(1);
    setInspect(null);
  };

  const turn = (dir: 1 | -1) => {
    if (!powered) return onPowerOn();
    if (inspect) closeInspect();
    const from = glideTarget.current ?? pan.get();
    let best = Infinity;
    for (const st of STOPS) {
      const d = dir > 0 ? wrap(st.x - from) : wrap(from - st.x);
      if (d > PANO.h / 50 && d < best) best = d;
    }
    if (Number.isFinite(best)) glide(from + best * dir);
  };

  const glideTo = (x: number) => {
    if (!powered) return onPowerOn();
    if (inspect) closeInspect();
    const cur = pan.get();
    glide(snapNear(cur + wrapDelta(x - cur), viewW * 0.3));
  };

  /* ───────── 물건 들여다보기 ───────── */

  const open = (spot: Spot) => {
    if (performance.now() - justDragged.current < 250) return; // 밀다가 놓은 손가락
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
    // 그쪽으로 고개를 돌리며 다가간다
    focusRef.current = spot.y;
    setFocusY(spot.y);
    const cur = pan.get();
    glide(cur + wrapDelta(spot.x - cur));
    zoomTo(ZOOM_IN);
    setInspect(spot);
  };
  const close = () => {
    feel("tick", "tick");
    closeInspect();
  };

  const baseFilter = !powered
    ? "grayscale(1) brightness(0.34) contrast(1.05)"
    : endingOpen
      ? "none"
      : `grayscale(${0.8 - 0.55 * ratio}) brightness(${0.74 + 0.2 * ratio}) contrast(1.06)`;

  const glintOn = (sp: Spot) => {
    if (sp.kind === "exit") return endingOpen;
    const m = sp.mission ? getMission(sp.mission) : undefined;
    return !!m && !cleared.includes(m.id) && !lockState(m, cleared, today).locked;
  };

  return (
    <section
      aria-label="늘곰 본부 360° 둘러보기"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") turn(1);
        if (e.key === "ArrowLeft") turn(-1);
        if (e.key === "Escape" && inspect) close();
      }}
      className="relative -mx-4 select-none outline-none"
    >
      <div
        ref={boxRef}
        className="relative overflow-hidden bg-black"
        style={{ aspectRatio: "8 / 9", touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <canvas
          ref={baseRef}
          role="img"
          aria-label={`늘곰 본부 · ${region}`}
          className="absolute inset-0 h-full w-full"
          style={{ filter: baseFilter, transition: "filter 1.2s ease" }}
        />
        <canvas
          ref={lightRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ filter: "saturate(1.25) brightness(1.15)" }}
        />

        {/* 물건 단추 · 효과: 캔버스와 같은 비율로 다가가고, 빛처럼 더해진다(screen) */}
        <motion.div
          className="absolute inset-0"
          style={{ scale: zoom, transformOrigin: `${size.w / 2}px ${focusY * s}px`, mixBlendMode: "screen" }}
        >
          {s > 0 &&
            SPOTS.map((sp) => (
              <SpotLayer
                key={sp.id}
                spot={sp}
                pan={pan}
                cw={size.w}
                s={s}
                alpha={fxAlpha.get(sp.id)!}
                lit={powered && isLit(sp)}
                glint={powered && !inspect && glintOn(sp)}
                denied={denied === sp.id}
                onOpen={open}
                onKeyFocus={(spot) => glideTo(spot.x)}
              />
            ))}
        </motion.div>

        {/* 안개 결 · 가장자리 그늘 · 먼지 */}
        <div className="noise pointer-events-none absolute inset-0" style={{ opacity: endingOpen ? 0.02 : 0.07 * (1 - ratio) + 0.02 }} />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 75% at 50% 45%, transparent 60%, rgb(0 0 0 / 0.55) 100%)" }}
        />
        {powered && <Dust />}

        <AnimatePresence>
          {inspect && (
            <motion.button
              type="button"
              data-fx="custom"
              aria-label="닫기"
              onClick={close}
              className="absolute inset-0 z-10"
              style={{
                background: `radial-gradient(circle at 50% ${(focusY / PANO.h) * 100}%, transparent 0, transparent 24%, rgb(0 0 0 / 0.55) 58%)`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        <p className="pointer-events-none absolute inset-x-0 top-2 text-center font-mono text-[10px] tracking-[0.3em] text-zinc-200/80 [text-shadow:0_1px_3px_#000]">
          AGENT &lsquo;늘곰&rsquo; HQ · 360°
        </p>

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

      {/* 조작줄: 돌기 · 지금 있는 곳 · 나침반 */}
      <div className="flex items-center gap-2 px-4 pt-2">
        <TurnButton dir={-1} onClick={() => turn(-1)} />
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="truncate text-sm font-bold" aria-live="polite">
            {region}
          </span>
          <Compass pan={pan} viewW={viewW} cleared={cleared} pending={pending} today={today} endingOpen={endingOpen} onPick={glideTo} />
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

/* ───────── 물건 한 개: 누르는 단추 + 불이 켜졌을 때의 효과 ───────── */

function SpotLayer(props: {
  spot: Spot;
  pan: MotionValue<number>;
  /** 화면 폭 (CSS px) */
  cw: number;
  s: number;
  alpha: MotionValue<number>;
  lit: boolean;
  glint: boolean;
  denied: boolean;
  onOpen: (spot: Spot) => void;
  onKeyFocus: (spot: Spot) => void;
}) {
  const { spot, cw, s, lit, glint, denied, onOpen, onKeyFocus } = props;
  const d = spot.r * 2 * s;
  const x = useTransform(props.pan, (v) => cw / 2 + (wrapDelta(spot.x - v) - spot.r) * s);
  return (
    <motion.div className="absolute left-0" style={{ x, top: (spot.y - spot.r) * s, width: d, height: d }}>
      {lit && spot.fx && (
        <motion.div className="pointer-events-none absolute inset-0" style={{ opacity: props.alpha }}>
          <SpotEffect spot={spot} />
        </motion.div>
      )}
      <motion.button
        type="button"
        data-fx="custom"
        aria-label={`${spot.label}${spot.mission ? ` — ${getMission(spot.mission)?.title ?? ""}` : ""}`}
        onClick={() => onOpen(spot)}
        onFocus={(e) => {
          // 키보드로 고르면 그쪽으로 돌아본다
          if (e.currentTarget.matches(":focus-visible")) onKeyFocus(spot);
        }}
        animate={denied ? { x: [0, -5, 5, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className="absolute inset-[16%] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-magenta"
      >
        {glint && <Glint delay={(spot.x % 7) * 0.5} />}
      </motion.button>
    </motion.div>
  );
}

/** 물건 상자(지름 2r) 기준 % 좌표 */
const rel = (spot: Spot, v: number, axis: "x" | "y") => ((v - ((axis === "x" ? spot.x : spot.y) - spot.r)) / (spot.r * 2)) * 100;

function SpotEffect({ spot }: { spot: Spot }) {
  const [r, g, b] = spot.glow;
  const color = `rgb(${r} ${g} ${b})`;
  switch (spot.fx) {
    case "heartbeat":
      return (
        <div
          className="absolute overflow-hidden"
          style={{
            left: `${rel(spot, SCOPE_SCREEN.x, "x")}%`,
            top: `${rel(spot, SCOPE_SCREEN.y, "y")}%`,
            width: `${(SCOPE_SCREEN.w / (spot.r * 2)) * 100}%`,
            height: `${(SCOPE_SCREEN.h / (spot.r * 2)) * 100}%`,
          }}
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
    case "cone": {
      const [b0, b1] = LAMP_CONE.bottom;
      const [t0, t1] = LAMP_CONE.top;
      const w = b1 - b0;
      return (
        <div
          className="absolute"
          style={{
            left: `${rel(spot, b0, "x")}%`,
            top: `${rel(spot, LAMP_CONE.topY, "y")}%`,
            width: `${(w / (spot.r * 2)) * 100}%`,
            height: `${((LAMP_CONE.bottomY - LAMP_CONE.topY) / (spot.r * 2)) * 100}%`,
            clipPath: `polygon(${((t0 - b0) / w) * 100}% 0, ${((t1 - b0) / w) * 100}% 0, 100% 100%, 0 100%)`,
            background: `linear-gradient(to bottom, rgb(${r} ${g} ${b} / 0.42), rgb(${r} ${g} ${b} / 0) 95%)`,
          }}
        />
      );
    }
    case "rings":
      return (
        <>
          {[0, 0.8, 1.6].map((dl) => (
            <span
              key={dl}
              className="hq-anim absolute rounded-full border-2"
              style={{
                left: "50%",
                top: "50%",
                width: "90%",
                height: "90%",
                borderColor: `rgb(${r} ${g} ${b} / 0.7)`,
                animation: `hq-ring 2.4s ease-out ${dl}s infinite`,
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
                left: `${28 + k * 22}%`,
                top: "72%",
                width: "34%",
                height: "170%",
                transformOrigin: "50% 0",
                transform: `rotate(${rot}deg)`,
                background: `linear-gradient(to bottom, rgb(${r} ${g} ${b} / 0.38), rgb(${r} ${g} ${b} / 0) 90%)`,
                filter: "blur(6px)",
                animation: `hq-rays ${6 + k}s ease-in-out infinite`,
              }}
            />
          ))}
        </>
      );
    case "screen":
      return (
        <div
          className="hq-anim absolute inset-[18%]"
          style={{
            background: `repeating-linear-gradient(to bottom, rgb(${r} ${g} ${b} / 0.16) 0 2px, transparent 2px 5px)`,
            animation: "hq-pulse 1.6s ease-in-out infinite",
          }}
        />
      );
    case "bubbles":
      return (
        <>
          {/* 선반 위 플라스크 입구 (물건 상자 기준 %) */}
          {[
            [37, 8],
            [46, 3],
            [70, 10],
            [37, 83],
            [59, 77],
            [72, 79],
          ].map(([x, y], k) => (
            <span
              key={k}
              className="hq-anim absolute rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${3 + (k % 3)}%`,
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
          className="hq-anim absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, rgb(${r} ${g} ${b} / ${spot.fx === "neon" ? 0.5 : 0.3}), transparent 68%)`,
            animation: spot.fx === "neon" ? "hq-neon 4s linear infinite" : "hq-pulse 2.6s ease-in-out infinite",
          }}
        />
      );
    default:
      return null;
  }
}

/* ───────── 나침반: 고리 전체 + 지금 보는 창 + 물건 표시 ───────── */

function Compass(props: {
  pan: MotionValue<number>;
  viewW: number;
  cleared: readonly string[];
  pending: readonly string[];
  today: string;
  endingOpen: boolean;
  onPick: (x: number) => void;
}) {
  const { pan, viewW, cleared, pending, today, endingOpen, onPick } = props;
  const frac = viewW / PANO.w;
  const left = useTransform(pan, (v) => `${(wrap(v - viewW / 2) / PANO.w) * 100}%`);
  // 창이 오른쪽 끝을 넘으면 넘친 만큼 왼쪽에 한 조각 더
  const spill = useTransform(pan, (v) => `${Math.max(0, wrap(v - viewW / 2) / PANO.w + frac - 1) * 100}%`);
  return (
    <div
      aria-hidden
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onPick(((e.clientX - r.left) / r.width) * PANO.w);
      }}
      className="relative h-4 w-full max-w-[240px] cursor-pointer"
    >
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
      <div className="absolute inset-0 overflow-hidden">
        <motion.div className="absolute top-0 h-full rounded-sm border border-white/60 bg-white/10" style={{ left, width: `${frac * 100}%` }} />
        <motion.div className="absolute left-0 top-0 h-full rounded-sm border border-white/60 bg-white/10" style={{ width: spill }} />
      </div>
      {SPOTS.map((sp) => {
        const m = sp.mission ? getMission(sp.mission) : undefined;
        const done = !!m && cleared.includes(m.id) && !pending.includes(m.id);
        const open = !!m && !done && !lockState(m, cleared, today).locked;
        const hot = open || (sp.kind === "exit" && endingOpen);
        const color = hot ? "#ff00ff" : done ? "#7ff7ff" : "#5a5a62";
        return (
          <span
            key={sp.id}
            className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${(sp.x / PANO.w) * 100}%`, background: color, boxShadow: hot ? "0 0 6px #ff00ff" : undefined }}
          />
        );
      })}
    </div>
  );
}

function TurnButton({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      data-fx="custom"
      onClick={onClick}
      aria-label={dir > 0 ? "오른쪽으로 돌기" : "왼쪽으로 돌기"}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-lg text-zinc-200 active:bg-white/10"
    >
      {dir > 0 ? "›" : "‹"}
    </button>
  );
}

/** 아직 안 깬 미션 물건에 가끔 반짝이는 표시 */
function Glint({ delay }: { delay: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="hq-anim absolute h-5 w-5"
      style={{ left: "62%", top: "34%", animation: `hq-glint 3.6s ease-in-out ${delay}s infinite`, filter: "drop-shadow(0 0 4px #ff00ff)" }}
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
  const atTop = spot.y > PANO.h * 0.51; // 물건이 아래쪽이면 카드는 위에
  const box = `absolute inset-x-3 z-30 rounded-xl border bg-ink/90 p-4 backdrop-blur ${atTop ? "top-3" : "bottom-16"}`;
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

  if (spot.kind === "exit") {
    return (
      <motion.div role="dialog" aria-label="탈출 문" className={`${box} ${endingOpen ? "border-magenta" : "border-line"}`} {...motionProps}>
        <p className="font-mono text-[10px] tracking-widest text-fog">EXIT · 탈출 문</p>
        <h3 className="mt-0.5 text-lg font-bold">{endingOpen ? "탈출 문이 열렸다!" : "굳게 잠긴 탈출 문"}</h3>
        <p className="mt-1 text-sm leading-relaxed text-zinc-300">
          {endingOpen ? "문 너머에서 수장 늘곰이 기다린다. 늘곰 연구소로 가자." : `${D_DAY_KO}, 본부가 이 문을 연다. 그날 모든 요원이 이곳에 모인다.`}
        </p>
        <div className="mt-3 flex gap-2">
          {closeBtn}
          {endingOpen && (
            <Link
              href="/ending"
              data-fx="custom"
              onClick={() => feel("thunk", "thunk")}
              className="flex-1 rounded-lg bg-magenta py-2.5 text-center text-sm font-bold text-ink"
            >
              연구소로 ›
            </Link>
          )}
        </div>
      </motion.div>
    );
  }

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
                  {m.senses && <span className="ml-1 text-xs text-fog">({m.senses.map((x) => SENSE_NAMES[x]).join("·")})</span>}
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
    <motion.div
      role="dialog"
      aria-label={`${spot.label} — ${m.title}`}
      className={`${box} ${locked ? "border-line" : "border-magenta/70"}`}
      {...motionProps}
    >
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
