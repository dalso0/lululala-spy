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

/** 키링: 홀로그램 원판 + 고리 (video7 의 빛나는 원판 키링과 같은 모양). 실제 키링 사진을 받으면 바꿔 끼운다 */
export const Keyring: React.FC<{ size: number }> = ({ size }) => {
  const d = size * 0.92;
  return (
    <div style={{ position: "relative", width: size, height: size * 1.22, filter: "drop-shadow(0 18px 28px rgba(0,0,0,.55))" }}>
      <div
        style={{
          position: "absolute",
          left: size * 0.02,
          top: 0,
          width: size * 0.32,
          height: size * 0.32,
          borderRadius: "50%",
          border: `${size * 0.045}px solid #dcdfe6`,
          boxShadow: "inset 0 0 6px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.4)",
          boxSizing: "border-box",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: size * 0.06,
          top: size * 0.26,
          width: d,
          height: d,
          borderRadius: "50%",
          background: "conic-gradient(from 30deg, #a6f4ff, #ff86f4, #ffeaa6, #8dffcb, #86b9ff, #f28dff, #a6f4ff)",
          boxShadow: "0 0 46px rgba(127,247,255,.6), 0 0 90px rgba(255,0,255,.35), inset 0 0 0 4px rgba(255,255,255,.65)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,.85), rgba(255,255,255,0) 42%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.12) 0 2px, transparent 2px 7px)" }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: d * 0.34, height: d * 0.34, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "rgba(255,255,255,.35)", boxShadow: "inset 0 0 0 3px rgba(255,255,255,.7)" }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: d * 0.13, height: d * 0.13, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "#0b0b10" }} />
        <div style={{ position: "absolute", left: d * 0.14, top: d * 0.12, width: d * 0.07, height: d * 0.07, borderRadius: "50%", background: "#0b0b10", boxShadow: "0 0 0 3px rgba(255,255,255,.6)" }} />
      </div>
    </div>
  );
};
