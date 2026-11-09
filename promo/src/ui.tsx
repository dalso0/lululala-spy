// 여러 장면에서 같이 쓰는 조각: 녹화 화면 · 폰 · 자막 · 글리치 글자 · 잡음 · 안개 · 픽셀 계기 · 키링
import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 녹화한 앱 화면(프레임 묶음)을 지금 프레임에 맞춰 한 장 */
export const Clip: React.FC<{ name: string; start?: number; last: number; speed?: number }> = ({ name, start = 0, last, speed = 1 }) => {
  const f = useCurrentFrame();
  const i = Math.max(0, Math.min(last, Math.floor(start + f * speed)));
  return (
    <Img
      src={staticFile(`clips/${name}/${String(i).padStart(4, "0")}.jpg`)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
};

/** 폰 (앱 화면 비율 390×844). w = 화면 폭, 바깥 폭은 테두리만큼 더 크다 */
export const phoneSize = (w: number) => {
  const b = Math.round(w * 0.034);
  return { w, h: Math.round((w * 844) / 390), b, outerW: w + 2 * b, outerH: Math.round((w * 844) / 390) + 2 * b };
};
export const Phone: React.FC<{ w: number; children?: React.ReactNode; style?: React.CSSProperties; glow?: number }> = ({ w, children, style, glow = 0.2 }) => {
  const { h, b } = phoneSize(w);
  const r = w * 0.13;
  return (
    <div
      style={{
        position: "absolute",
        width: w,
        height: h,
        borderRadius: r + b,
        padding: b,
        background: "linear-gradient(150deg,#3b3b44 0%,#17171b 42%,#0b0b0d 100%)",
        boxShadow: `0 50px 120px rgba(0,0,0,.75), inset 0 0 0 2px rgba(255,255,255,.08), 0 0 90px rgba(255,0,255,${glow})`,
        boxSizing: "content-box",
        ...style,
      }}
    >
      <div style={{ position: "relative", width: w, height: h, borderRadius: r, overflow: "hidden", background: C.ink }}>
        {children}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(118deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,0) 32%)" }} />
      </div>
    </div>
  );
};

/** 폰 뒷면 (카메라 · NFC 자리) */
export const PhoneBack: React.FC<{ w: number }> = ({ w }) => {
  const { outerW, outerH } = phoneSize(w);
  const cam = (l: number, t: number) => (
    <div
      style={{
        position: "absolute",
        left: l,
        top: t,
        width: outerW * 0.13,
        height: outerW * 0.13,
        borderRadius: "50%",
        background: "radial-gradient(circle at 40% 35%, #454556, #050507 68%)",
        boxShadow: "0 0 0 4px #1d1d24",
      }}
    />
  );
  return (
    <div
      style={{
        position: "relative",
        width: outerW,
        height: outerH,
        borderRadius: outerW * 0.15,
        background: "linear-gradient(160deg,#30303a 0%,#15151a 55%,#0b0b0d 100%)",
        boxShadow: "inset 0 0 0 3px rgba(255,255,255,.09), 0 50px 120px rgba(0,0,0,.7)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: outerW * 0.07,
          top: outerW * 0.07,
          width: outerW * 0.38,
          height: outerW * 0.38,
          borderRadius: outerW * 0.1,
          background: "linear-gradient(145deg,#26262e,#0f0f12)",
          boxShadow: "inset 0 0 0 2px rgba(255,255,255,.07)",
        }}
      >
        {cam(outerW * 0.04, outerW * 0.04)}
        {cam(outerW * 0.04, outerW * 0.21)}
        {cam(outerW * 0.21, outerW * 0.125)}
      </div>
      <div
        style={{
          position: "absolute",
          top: outerH * 0.42,
          width: "100%",
          textAlign: "center",
          fontFamily: FONT.mono,
          fontWeight: 700,
          fontSize: outerW * 0.07,
          color: "rgba(255,255,255,.16)",
          letterSpacing: ".2em",
        }}
      >
        AGENT
      </div>
    </div>
  );
};

/** 줄마다 아래에서 떠오르는 자막 */
export type Line = { t: React.ReactNode; size: number; color?: string; weight?: number; font?: string };
export const Lines: React.FC<{ lines: Line[]; at?: number; stagger?: number; style?: React.CSSProperties }> = ({ lines, at = 0, stagger = 5, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 50, right: 50, textAlign: "center", ...style }}>
      {lines.map((l, i) => {
        const p = spring({ frame: f - at - i * stagger, fps, config: { damping: 18, stiffness: 150 } });
        return (
          <div
            key={i}
            style={{
              fontFamily: l.font ?? FONT.sans,
              fontWeight: l.weight ?? 900,
              fontSize: l.size,
              lineHeight: 1.16,
              color: l.color ?? C.white,
              letterSpacing: "-0.025em",
              wordBreak: "keep-all",
              opacity: Math.min(1, p * 1.4),
              transform: `translateY(${(1 - p) * 44}px)`,
              filter: `blur(${Math.max(0, 1 - p) * 8}px)`,
              textShadow: "0 6px 34px rgba(0,0,0,.65)",
            }}
          >
            {l.t}
          </div>
        );
      })}
    </div>
  );
};

export const M: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: C.magenta, textShadow: "0 0 40px rgba(255,0,255,.45), 0 6px 34px rgba(0,0,0,.6)" }}>{children}</span>
);

/** 한 글자씩 찍히는 글자 */
export const Typed: React.FC<{ text: string; at: number; cps?: number; cursor?: boolean }> = ({ text, at, cps = 18, cursor = true }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(0, Math.min(text.length, Math.floor(((f - at) * cps) / fps)));
  const blink = Math.floor(f / 8) % 2 === 0;
  return (
    <span>
      {text.slice(0, n)}
      {cursor && f >= at && <span style={{ opacity: blink ? 1 : 0 }}>▌</span>}
    </span>
  );
};

/** 깨지듯 들어오는 글자 (색 번짐 · 흔들림) */
export const GlitchText: React.FC<{ children: string; size: number; at: number; seed: string; color?: string }> = ({ children, size, at, seed, color }) => {
  const f = useCurrentFrame() - at;
  if (f < 0) return null;
  const intro = f < 9;
  const glitch = intro || random(`${seed}-g-${Math.floor(f / 3)}`) > 0.9;
  const dx = glitch ? (random(`${seed}-x-${f}`) - 0.5) * 22 : 0;
  const visible = intro ? random(`${seed}-o-${f}`) > 0.3 : true;
  const base: React.CSSProperties = { fontFamily: FONT.sans, fontWeight: 900, fontSize: size, letterSpacing: "-0.025em", whiteSpace: "nowrap", lineHeight: 1.15 };
  return (
    <div style={{ position: "relative", opacity: visible ? 1 : 0.15 }}>
      {glitch && (
        <>
          <div style={{ ...base, position: "absolute", inset: 0, color: C.magenta, transform: `translateX(${dx + 7}px)`, opacity: 0.85 }}>{children}</div>
          <div style={{ ...base, position: "absolute", inset: 0, color: C.cyan, transform: `translateX(${-dx - 7}px)`, opacity: 0.7 }}>{children}</div>
        </>
      )}
      <div style={{ ...base, position: "relative", color: color ?? C.white, transform: `translateX(${dx * 0.35}px)`, textShadow: "0 6px 34px rgba(0,0,0,.7)" }}>{children}</div>
    </div>
  );
};

/** 필름 결 (프레임마다 다른 잡음) */
export const Grain: React.FC<{ id: string; opacity?: number }> = ({ id, opacity = 0.12 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="1080" height="1920">
        <filter id={`grain-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={f % 89} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="1080" height="1920" filter={`url(#grain-${id})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** 지지직 화면 (장면 넘김) */
export const StaticFlash: React.FC<{ at: number; dur?: number; id: string }> = ({ at, dur = 8, id }) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f >= dur) return null;
  const o = interpolate(f, [0, 1, dur], [0.5, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: o, pointerEvents: "none" }}>
      <svg width="1080" height="1920">
        <filter id={`static-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.55 0.9" numOctaves={1} seed={(f * 7 + 3) % 101} />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="2.4" intercept="-0.6" />
            <feFuncG type="linear" slope="2.4" intercept="-0.6" />
            <feFuncB type="linear" slope="2.4" intercept="-0.6" />
          </feComponentTransfer>
        </filter>
        <rect width="1080" height="1920" filter={`url(#static-${id})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Scanlines: React.FC<{ opacity?: number }> = ({ opacity = 0.2 }) => (
  <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(to bottom, rgba(0,0,0,.6) 0 2px, transparent 2px 6px)", opacity, pointerEvents: "none" }} />
);

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.7 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 62% at 50% 46%, transparent 52%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: "none" }} />
);

/** 천천히 흘러가는 회색 안개 */
export const Fog: React.FC<{ opacity?: number }> = ({ opacity = 0.5 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none", overflow: "hidden" }}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const w = 760 + i * 90;
        const x = ((i * 310 + f * (0.9 + i * 0.25)) % 1900) - 500;
        const y = 120 + i * 300 + Math.sin((f + i * 40) / 40) * 30;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: w * 0.55,
              borderRadius: "50%",
              background: "radial-gradient(closest-side, rgba(170,170,180,.42), rgba(170,170,180,0))",
              filter: "blur(24px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** 픽셀 5칸 (앱 상황판 위쪽과 같은 모양). events[i] 프레임에 i번째 칸이 채워진다 */
export const PixelMeter: React.FC<{ events: number[]; hideAt?: number }> = ({ events, hideAt }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = events.filter((e) => f >= e).length;
  const fade = hideAt ? interpolate(f, [hideAt - 4, hideAt], [1, 0], clamp) : 1;
  const enter = spring({ frame: f, fps, config: { damping: 20 } });
  return (
    <div style={{ position: "absolute", top: 108, width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 14, opacity: fade * enter }}>
      {events.map((e, i) => {
        const on = f >= e;
        const pop = on ? spring({ frame: f - e, fps, config: { damping: 9, stiffness: 220 } }) : 0;
        return (
          <div
            key={i}
            style={{
              width: 50,
              height: 50,
              borderRadius: 8,
              border: `3px solid ${on ? C.magenta : "#4a4a52"}`,
              background: on ? C.magenta : "transparent",
              boxShadow: on ? "0 0 26px rgba(255,0,255,.8)" : "none",
              transform: `scale(${on ? 0.6 + 0.4 * pop + (1 - pop) * 0.6 : 1})`,
            }}
          />
        );
      })}
      <div style={{ marginLeft: 14, fontFamily: FONT.mono, fontWeight: 700, fontSize: 40, color: n ? C.magenta : C.fog, minWidth: 100 }}>{n} / 5</div>
    </div>
  );
};

/** 키링 (실제 키링 사진을 받으면 바꿔 끼우면 된다) */
export const Keyring: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 1.45} viewBox="0 0 200 290" style={{ overflow: "visible", filter: "drop-shadow(0 18px 30px rgba(0,0,0,.55))" }}>
    <defs>
      <linearGradient id="kr-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f2f3f7" />
        <stop offset=".5" stopColor="#9a9eaa" />
        <stop offset="1" stopColor="#e3e5ea" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="40" r="30" fill="none" stroke="url(#kr-metal)" strokeWidth="9" />
    <rect x="91" y="64" width="18" height="30" rx="7" fill="none" stroke="#c4c7cf" strokeWidth="6" />
    <rect x="20" y="88" width="160" height="196" rx="36" fill="#FBF5E5" stroke="#5a3b28" strokeWidth="6" />
    <rect x="34" y="102" width="132" height="168" rx="26" fill="none" stroke="#e8dcc2" strokeWidth="3" />
    <g transform="translate(86,180)" stroke={C.magenta} strokeWidth="10" fill="none" strokeLinecap="round">
      <path d="M -6 -16 A 22 22 0 0 1 -6 16" />
      <path d="M 10 -32 A 42 42 0 0 1 10 32" />
      <path d="M 26 -48 A 62 62 0 0 1 26 48" />
    </g>
    <circle cx="70" cy="180" r="8" fill={C.magenta} />
  </svg>
);
