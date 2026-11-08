// 아날로그 효과음: 소리 파일 없이 Web Audio 로 그 자리에서 합성한다 (다운로드 0, 매번 미세하게 다른 소리).
// 브라우저 정책상 첫 터치 이후에만 소리가 난다 → unlockAudio() 를 첫 pointerdown 에서 부른다.
// 아이폰은 무음 스위치를 켜 두면 소리가 나지 않는다(수업 중엔 그게 맞다).

export type SoundName =
  | "tap"
  | "tick"
  | "switch"
  | "thunk"
  | "latch"
  | "whir"
  | "hum"
  | "power"
  | "chime"
  | "sparkle"
  | "glass"
  | "gulp"
  | "deny"
  | "focus"
  | "inhale"
  | "hold"
  | "exhale"
  | "stamp";

const STORAGE_KEY = "spy-sound";

let ctx: AudioContext | null = null;
let out: GainNode | null = null; // 마른 소리
let send: GainNode | null = null; // 방 울림(리버브)으로 보내는 양
let noise: AudioBuffer | null = null;

let enabled = true;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  try {
    enabled = localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {}
}

export const isSoundOn = () => enabled;
export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {}
  listeners.forEach((l) => l());
}
export function subscribeSound(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 첫 터치 때 호출: 오디오 장치를 깨운다 */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);

    out = ctx.createGain();
    out.gain.value = 0.75;
    out.connect(comp);

    // 지하 본부 느낌의 짧은 방 울림
    const room = ctx.createConvolver();
    room.buffer = makeImpulse(ctx, 0.8, 3.4);
    send = ctx.createGain();
    send.gain.value = 0.22;
    send.connect(room).connect(comp);

    noise = makeNoise(ctx, 1);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export const isAudioReady = () => ctx !== null && ctx.state === "running";

export function play(name: SoundName, opts?: { duration?: number; volume?: number }) {
  // 아직 깨어나는 중(suspended)이어도 예약해 두면 깨어나자마자 난다
  if (!enabled || !ctx || !out || ctx.state === "closed") return;
  try {
    SOUNDS[name](ctx.currentTime + 0.005, opts ?? {});
  } catch {
    /* 소리는 실패해도 게임은 계속 */
  }
}

/* ───────── 합성 재료 ───────── */

const rnd = (spread: number) => (Math.random() * 2 - 1) * spread;

function makeNoise(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function makeImpulse(c: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

/** 출력 연결: 마른 소리 + 방 울림 조금 */
function voice(gain: number, reverb = 1, pan = 0) {
  const c = ctx!;
  const g = c.createGain();
  g.gain.value = gain;
  let node: AudioNode = g;
  if (pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    node = p;
  }
  node.connect(out!);
  if (reverb > 0) {
    const r = c.createGain();
    r.gain.value = reverb;
    node.connect(r).connect(send!);
  }
  return g;
}

type Env = { t: number; dur: number; attack?: number; gain: number; reverb?: number; pan?: number };

/** 걸러 낸 잡음 한 번: 딸깍·쿵·쉭 소리의 재료 */
function noiseHit(o: Env & { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number }) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = c.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.freq, o.t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, o.t + o.dur);
  f.Q.value = o.q ?? 1;
  const env = c.createGain();
  const a = o.attack ?? 0.002;
  env.gain.setValueAtTime(0.0001, o.t);
  env.gain.exponentialRampToValueAtTime(1, o.t + a);
  env.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  src.connect(f).connect(env).connect(voice(o.gain, o.reverb ?? 0.6, o.pan ?? 0));
  src.start(o.t, Math.random() * 0.5);
  src.stop(o.t + o.dur + 0.05);
}

/** 음 하나: 쿵·종소리·신호음의 재료 */
function tone(o: Env & { freq: number; freqEnd?: number; type?: OscillatorType; release?: number }) {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, o.t);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, o.t + o.dur);
  const env = c.createGain();
  const a = o.attack ?? 0.004;
  env.gain.setValueAtTime(0.0001, o.t);
  env.gain.exponentialRampToValueAtTime(1, o.t + a);
  env.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  osc.connect(env).connect(voice(o.gain, o.reverb ?? 0.8, o.pan ?? 0));
  osc.start(o.t);
  osc.stop(o.t + o.dur + 0.05);
}

/** 쇠붙이 울림 (배음이 맞지 않는 사인파 묶음) */
function ring(t: number, freqs: number[], dur: number, gain: number) {
  freqs.forEach((f, i) => tone({ t, freq: f * (1 + rnd(0.01)), dur: dur * (1 - i * 0.15), gain: gain / (i + 1), attack: 0.002 }));
}

/** 종소리 한 번 */
function bell(t: number, freq: number, gain: number, dur = 1.6) {
  [1, 2.76, 5.4, 8.93].forEach((p, i) =>
    tone({ t, freq: freq * p, dur: dur / (1 + i * 0.7), gain: gain * [1, 0.32, 0.12, 0.05][i], attack: 0.003, reverb: 1.2 }),
  );
}

/* ───────── 소리 목록 ───────── */

const SOUNDS: Record<SoundName, (t: number, o: { duration?: number; volume?: number }) => void> = {
  // 버튼: 작은 금속 스위치 딸깍
  tap: (t) => {
    noiseHit({ t, dur: 0.02, type: "bandpass", freq: 3100 + rnd(500), q: 3, gain: 0.32, reverb: 0.3 });
    tone({ t, freq: 1700 + rnd(200), dur: 0.015, gain: 0.05, reverb: 0.2 });
  },
  // 톱니 한 칸 · 텔레타이프 한 글자
  tick: (t, o) => noiseHit({ t, dur: 0.009, type: "bandpass", freq: 4300 + rnd(900), q: 6, gain: 0.22 * (o.volume ?? 1), reverb: 0.25 }),
  // 토글 스위치: 딸-깍
  switch: (t) => {
    noiseHit({ t, dur: 0.022, type: "bandpass", freq: 2200 + rnd(200), q: 2, gain: 0.4 });
    tone({ t, freq: 210, freqEnd: 130, dur: 0.06, gain: 0.22 });
    noiseHit({ t: t + 0.05, dur: 0.012, type: "bandpass", freq: 3800, q: 3, gain: 0.18 });
  },
  // 무거운 걸쇠가 맞물리는 쿵
  thunk: (t) => {
    tone({ t, freq: 120 + rnd(10), freqEnd: 46, dur: 0.22, gain: 0.7, reverb: 1 });
    noiseHit({ t, dur: 0.07, type: "lowpass", freq: 800, q: 0.7, gain: 0.55 });
    ring(t, [1180, 1870], 0.35, 0.05);
  },
  // 자물쇠가 풀린다: 딸-딸-철컥 + 쇳소리
  latch: (t) => {
    [0, 0.08, 0.15].forEach((d) => noiseHit({ t: t + d, dur: 0.01, type: "bandpass", freq: 4000 + rnd(600), q: 6, gain: 0.3 }));
    tone({ t: t + 0.24, freq: 160, freqEnd: 60, dur: 0.16, gain: 0.55 });
    noiseHit({ t: t + 0.24, dur: 0.05, type: "highpass", freq: 1800, gain: 0.45 });
    ring(t + 0.24, [2400, 3560, 5100], 0.6, 0.06);
  },
  // 톱니바퀴 모터가 돈다
  whir: (t, o) => {
    const c = ctx!;
    const dur = o.duration ?? 1;
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + dur * 0.4);
    osc.frequency.exponentialRampToValueAtTime(90, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const trem = c.createGain();
    const lfo = c.createOscillator();
    lfo.frequency.value = 24;
    const depth = c.createGain();
    depth.gain.value = 0.35;
    lfo.connect(depth).connect(trem.gain);
    trem.gain.value = 0.65;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.12);
    env.gain.setValueAtTime(1, t + dur - 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp).connect(trem).connect(env).connect(voice(0.18, 0.5));
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
    for (let k = 0.1; k < dur - 0.1; k += 0.09) noiseHit({ t: t + k, dur: 0.008, type: "bandpass", freq: 3800 + rnd(700), q: 5, gain: 0.08 });
  },
  // 전구·브라운관이 지직거리며 켜진다
  hum: (t) => {
    noiseHit({ t, dur: 0.012, type: "bandpass", freq: 3000, q: 3, gain: 0.25 });
    const c = ctx!;
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = 100;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    [0, 0.05, 0.09, 0.16, 0.22].forEach((d, i) => env.gain.setValueAtTime(i % 2 ? 0.15 : 0.7, t + d));
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(lp).connect(env).connect(voice(0.12, 0.4));
    osc.start(t);
    osc.stop(t + 0.55);
  },
  // 본부 전원이 들어온다
  power: (t) => {
    SOUNDS.thunk(t, {});
    SOUNDS.whir(t + 0.05, { duration: 0.7 });
    tone({ t: t + 0.1, freq: 55, freqEnd: 110, dur: 0.7, gain: 0.25, reverb: 0.6 });
  },
  // 픽셀 획득: 맑은 종소리 화음
  chime: (t) => {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(t + i * 0.085, f, 0.11));
  },
  // 반짝이 가루
  sparkle: (t) => {
    for (let i = 0; i < 16; i++) {
      tone({ t: t + Math.random() * 0.55, freq: 2600 + Math.random() * 4200, dur: 0.07 + Math.random() * 0.08, gain: 0.035, pan: rnd(0.8), reverb: 1 });
    }
  },
  // 거울이 깨진다: 쩍 + 유리 조각들
  glass: (t) => {
    noiseHit({ t, dur: 0.035, type: "highpass", freq: 2200, gain: 0.7, reverb: 1 });
    noiseHit({ t, dur: 0.25, type: "lowpass", freq: 300, gain: 0.4 });
    for (let i = 0; i < 22; i++) {
      tone({ t: t + 0.03 + Math.random() * 0.8, freq: 3000 + Math.random() * 5500, dur: 0.06 + Math.random() * 0.2, gain: 0.05, pan: rnd(0.9), reverb: 1.2 });
    }
  },
  // 휴지통이 말을 삼킨다: 퉁 + 바스락
  gulp: (t) => {
    tone({ t, freq: 170, freqEnd: 62, dur: 0.14, gain: 0.5 });
    noiseHit({ t: t + 0.01, dur: 0.12, type: "bandpass", freq: 1300, q: 1.2, gain: 0.25 });
  },
  // 잠긴 장치를 건드림
  deny: (t) => {
    [0, 0.12].forEach((d) => tone({ t: t + d, freq: 130, dur: 0.08, type: "square", gain: 0.06, reverb: 0.3 }));
  },
  // 물건에 다가가 들여다본다 (쉭)
  focus: (t) => {
    noiseHit({ t, dur: 0.28, attack: 0.08, type: "bandpass", freq: 500, freqEnd: 2600, q: 1.4, gain: 0.16, reverb: 0.8 });
    noiseHit({ t: t + 0.26, dur: 0.01, type: "bandpass", freq: 4200, q: 5, gain: 0.18 });
  },
  // 호흡 신호: 들숨은 올라가고, 멈춤은 그대로, 날숨은 내려간다 (작고 부드럽게)
  inhale: (t) => tone({ t, freq: 330, freqEnd: 494, dur: 0.6, attack: 0.12, gain: 0.07, reverb: 1.2 }),
  hold: (t) => tone({ t, freq: 494, dur: 0.35, attack: 0.05, gain: 0.05, reverb: 1.2 }),
  exhale: (t) => tone({ t, freq: 494, freqEnd: 294, dur: 0.9, attack: 0.1, gain: 0.07, reverb: 1.2 }),
  // 도장 쾅
  stamp: (t) => {
    SOUNDS.thunk(t, {});
    noiseHit({ t: t + 0.02, dur: 0.1, type: "bandpass", freq: 900, q: 0.8, gain: 0.3 });
  },
};
