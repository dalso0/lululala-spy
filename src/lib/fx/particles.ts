// 화면 전체를 덮는 캔버스 하나에 파티클을 그린다 (DOM 요소를 수백 개 만들지 않아 폰에서도 가볍다).
// 캔버스는 FxRoot 가 붙여 준다. 좌표는 화면(viewport) 기준 px.

export type BurstKind = "pixels" | "sparks" | "confetti";

type Particle = {
  kind: BurstKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
};

const COLORS: Record<BurstKind, string[]> = {
  pixels: ["#ff00ff", "#ff7ad9", "#ffffff", "#7ff7ff", "#ff00ff"],
  sparks: ["#fff3b0", "#ffd36b", "#ff9a3c", "#ffffff"],
  confetti: ["#ff00ff", "#7ff7ff", "#ffe066", "#ffffff", "#ff7ad9", "#a6ff8a"],
};
const COUNT: Record<BurstKind, number> = { pixels: 42, sparks: 26, confetti: 90 };

let canvas: HTMLCanvasElement | null = null;
let g: CanvasRenderingContext2D | null = null;
let parts: Particle[] = [];
let raf = 0;
let last = 0;
let dpr = 1;

export function attachParticleCanvas(c: HTMLCanvasElement | null) {
  canvas = c;
  g = c?.getContext("2d") ?? null;
  resizeParticleCanvas();
}

export function resizeParticleCanvas() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function make(kind: BurstKind, x: number, y: number, power: number): Particle {
  const a = Math.random() * Math.PI * 2;
  const colors = COLORS[kind];
  const color = colors[Math.floor(Math.random() * colors.length)];
  if (kind === "sparks") {
    const s = (220 + Math.random() * 480) * power;
    const max = 0.25 + Math.random() * 0.35;
    return { kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: max, max, size: 1.6 + Math.random() * 1.4, color, rot: 0, vr: 0 };
  }
  if (kind === "confetti") {
    const s = (180 + Math.random() * 420) * power;
    const up = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const max = 1.8 + Math.random() * 1.2;
    return { kind, x, y, vx: Math.cos(up) * s, vy: Math.sin(up) * s, life: max, max, size: 5 + Math.random() * 5, color, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 };
  }
  const s = (110 + Math.random() * 330) * power;
  const max = 0.7 + Math.random() * 0.6;
  return { kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: max, max, size: 3 + Math.floor(Math.random() * 4), color, rot: Math.random() * 3, vr: (Math.random() - 0.5) * 8 };
}

/** (x, y) 화면 좌표에서 한 번 터뜨린다 */
export function burst(x: number, y: number, kind: BurstKind = "pixels", opts: { count?: number; power?: number } = {}) {
  if (!canvas || !g || reducedMotion()) return;
  const n = opts.count ?? COUNT[kind];
  for (let i = 0; i < n; i++) parts.push(make(kind, x, y, opts.power ?? 1));
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
}

/** 요소 한가운데에서 터뜨린다 */
export function burstAt(el: Element | null | undefined, kind: BurstKind = "pixels", opts?: { count?: number; power?: number }) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, kind, opts);
}

function loop(now: number) {
  if (!g || !canvas) {
    raf = 0;
    return;
  }
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);

  parts = parts.filter((p) => (p.life -= dt) > 0);
  for (const p of parts) {
    const gravity = p.kind === "sparks" ? 900 : p.kind === "confetti" ? 380 : 520;
    const drag = p.kind === "confetti" ? 0.985 : 0.97;
    p.vx *= drag;
    p.vy = p.vy * drag + gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const k = p.life / p.max;

    if (p.kind === "sparks") {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = Math.min(1, k * 1.6);
      g.strokeStyle = p.color;
      g.lineWidth = p.size;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      g.stroke();
    } else {
      g.globalCompositeOperation = p.kind === "pixels" ? "lighter" : "source-over";
      g.globalAlpha = p.kind === "confetti" ? Math.min(1, k * 2) : k;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      if (p.kind === "confetti") g.fillRect(-p.size / 2, -p.size * 0.8, p.size, p.size * 1.6);
      else g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      g.restore();
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";

  if (parts.length) raf = requestAnimationFrame(loop);
  else {
    raf = 0;
    g.clearRect(0, 0, canvas.width, canvas.height);
  }
}
