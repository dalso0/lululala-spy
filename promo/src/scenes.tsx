// 장면들. 프레임 번호는 모두 그 장면 안에서의 번호(0부터)다.
import { AbsoluteFill, Easing, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BEAT, C, FONT, SC } from "./theme";
import { Clip, clamp, Fog, GlitchText, Grain, Keyring, Line, Lines, M, Phone, PhoneBack, phoneSize, Scanlines, StaticFlash, Typed, Vignette } from "./ui";

/* ───────── 1. 훅: 합천중학교에 회색 안개가 퍼졌다 ───────── */
export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const panX = interpolate(f, [0, SC.hook.dur], [-700, -1050]);
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      <Img
        src={staticFile("art/pano-desk.jpg")}
        style={{ position: "absolute", top: 0, left: 0, height: 1920, transform: `translateX(${panX}px)`, filter: "grayscale(1) brightness(.4) contrast(1.15) blur(1.5px)", opacity: interpolate(f, [0, 12], [0, 1], clamp) }}
      />
      <Fog opacity={0.6} />
      <Vignette strength={0.85} />
      <div style={{ position: "absolute", top: 520, width: "100%", textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 36, color: C.magenta, letterSpacing: ".12em" }}>
        <Typed text="● 긴급 수신 · CH-07" at={3} cps={24} />
      </div>
      <div style={{ position: "absolute", top: 640, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <GlitchText size={96} at={11} seed="a">합천중학교에</GlitchText>
        <GlitchText size={104} at={23} seed="b" color="#d9d9e0">회색 안개가 퍼졌다</GlitchText>
      </div>
      <div style={{ position: "absolute", top: 940, width: "100%", textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 30, color: C.fog, opacity: interpolate(f, [42, 52], [0, 1], clamp) }}>
        감염 증상: 하늘색 망각 · 미각 상실 · 잿빛 불안
      </div>
      <Scanlines opacity={0.22} />
      <Grain id="hook" opacity={0.2} />
      <StaticFlash id="hook-in" at={0} dur={6} />
      <StaticFlash id="hook-out" at={SC.hook.dur - 7} dur={7} />
    </AbsoluteFill>
  );
};

/* ───────── 2. 늘곰 SOS → 연결 끊김 ───────── */
export const Sos: React.FC = () => {
  const f = useCurrentFrame();
  const LOST = 66;
  const lostK = interpolate(f, [LOST, LOST + 14], [0, 1], clamp);
  const shake = f >= LOST ? (random(`sos-${Math.floor(f / 2)}`) - 0.5) * 40 * lostK : (random(`sos-s-${Math.floor(f / 4)}`) - 0.5) * 4;
  const blink = Math.floor(f / 6) % 2 === 0;
  const slices = 7;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #16201a 0%, ${C.ink} 60%)` }}>
      <Fog opacity={0.35} />
      <div style={{ position: "absolute", top: 250, width: "100%", textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 34, color: C.fog, letterSpacing: ".12em" }}>
        <span style={{ color: "#ff3b6b", opacity: blink ? 1 : 0.25 }}>●</span> SIGNAL · 늘곰 요원
      </div>
      {/* 낡은 모니터 */}
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 330,
          width: 800,
          height: 860,
          borderRadius: 54,
          background: "radial-gradient(ellipse at 50% 42%, #2a3a30 0%, #0d1510 72%)",
          boxShadow: "inset 0 0 140px rgba(0,0,0,.9), 0 0 0 16px #1b1b20, 0 0 0 19px #2f2f36, 0 40px 100px rgba(0,0,0,.7)",
          overflow: "hidden",
        }}
      >
        {Array.from({ length: slices }).map((_, i) => {
          const off = f >= LOST ? (random(`sl-${i}-${Math.floor(f / 2)}`) - 0.5) * 120 * lostK : 0;
          return (
            <div key={i} style={{ position: "absolute", inset: 0, clipPath: `inset(${(i * 100) / slices}% 0 ${100 - ((i + 1) * 100) / slices}% 0)`, transform: `translateX(${off + shake}px)` }}>
              <Img
                src={staticFile("neulgom/phone.png")}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 90,
                  height: 470,
                  transform: "translateX(-50%)",
                  filter: `grayscale(${lostK}) brightness(${1 - lostK * 0.4}) drop-shadow(0 0 22px rgba(127,247,255,.25)) blur(.6px)`,
                }}
              />
            </div>
          );
        })}
        <Scanlines opacity={0.5} />
        <div
          style={{
            position: "absolute",
            bottom: 70,
            width: "100%",
            textAlign: "center",
            fontFamily: FONT.hand,
            fontWeight: 700,
            fontSize: 66,
            color: "#fff4df",
            textShadow: "0 0 22px rgba(255,0,255,.55)",
            transform: `translateX(${shake * 0.6}px)`,
            opacity: 1 - lostK * 0.85,
          }}
        >
          <Typed text="…여기는 늘곰. 들리나…" at={8} cps={13} cursor={false} />
        </div>
        {f >= LOST && <StaticFlash id="sos-noise" at={LOST} dur={30} />}
        {f >= LOST + 6 && (
          <div style={{ position: "absolute", top: "44%", width: "100%", textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 64, color: C.magenta, opacity: blink ? 1 : 0.35, textShadow: "0 0 30px rgba(255,0,255,.7)" }}>
            연결 끊김
          </div>
        )}
      </div>
      <Lines
        at={44}
        style={{ top: 1290 }}
        lines={[
          { t: "늘곰 요원과", size: 76, color: "#d9d9e0" },
          { t: <>연락이 <M>끊겼다</M></>, size: 104 },
        ]}
      />
      <Grain id="sos" opacity={0.18} />
    </AbsoluteFill>
  );
};

/* ───────── 3. 본부가 새 요원을 찾는다 → 바로 너. ───────── */
export const Recruit: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const YOU = 60;
  const enter = spring({ frame: f, fps, config: { damping: 16, stiffness: 110 } });
  const youP = spring({ frame: f - YOU, fps, config: { damping: 10, stiffness: 190 } });
  const P = phoneSize(560);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 62%, #2a1030 0%, ${C.ink} 62%)` }}>
      <Fog opacity={0.22} />
      <div style={{ opacity: interpolate(f, [YOU - 8, YOU - 1], [1, 0], clamp) }}>
        <Lines
          at={2}
          style={{ top: 190 }}
          lines={[
            { t: "본부가", size: 64, color: C.fog, weight: 800 },
            { t: "새 요원을 찾는다", size: 100 },
          ]}
        />
      </div>
      {f >= YOU && (
        <div
          style={{
            position: "absolute",
            top: 205,
            width: "100%",
            textAlign: "center",
            fontFamily: FONT.sans,
            fontWeight: 900,
            fontSize: 180,
            letterSpacing: "-0.03em",
            color: C.magenta,
            transform: `scale(${interpolate(youP, [0, 1], [2.4, 1])}) rotate(${interpolate(youP, [0, 1], [-8, -3])}deg)`,
            opacity: Math.min(1, youP * 2),
            textShadow: "0 0 70px rgba(255,0,255,.6), 0 10px 40px rgba(0,0,0,.6)",
          }}
        >
          바로 너.
        </div>
      )}
      <Phone w={560} style={{ left: (1080 - P.outerW) / 2, top: 540 + (1 - enter) * 360, transform: `rotate(${(1 - enter) * 7}deg)` }}>
        <Clip name="start" last={107} />
      </Phone>
      <Grain id="rec" opacity={0.12} />
      <StaticFlash id="rec-in" at={0} dur={5} />
    </AbsoluteFill>
  );
};

/* ───────── 4. 작전 장면 (3초씩) ───────── */
export type BeatDef = {
  key: "daily" | "bomb" | "mirror" | "ceremony";
  tag: string;
  lines: Line[];
  clips: { name: string; start: number; last: number; dur: number }[];
};
export const BEATS: BeatDef[] = [
  {
    key: "daily",
    tag: "MISSION 00 · 평범지령",
    lines: [{ t: "평범한 하루가", size: 74 }, { t: <M>곧 위장술</M>, size: 104 }],
    clips: [{ name: "daily", start: 8, last: 131, dur: 90 }],
  },
  {
    key: "bomb",
    tag: "MISSION 01 · 스트레스 시한폭탄",
    lines: [{ t: "숨 세 번으로", size: 74 }, { t: <M>폭탄 해체</M>, size: 104 }],
    clips: [{ name: "bomb", start: 4, last: 119, dur: 90 }],
  },
  {
    key: "mirror",
    tag: "MISSION 02 · 진실의 거울 방",
    lines: [{ t: "의심은 던지고", size: 74 }, { t: <M>거울은 깨고</M>, size: 104 }],
    clips: [
      { name: "mirror", start: 2, last: 71, dur: 45 },
      { name: "mirror-break", start: 0, last: 83, dur: 45 },
    ],
  },
  {
    key: "ceremony",
    tag: "PIXEL CORE INSTALL",
    lines: [{ t: "모은 픽셀로", size: 74 }, { t: <M>본부에 불을 켜라</M>, size: 92 }],
    clips: [{ name: "ceremony", start: 2, last: 125, dur: 90 }],
  },
];

export const MissionBeat: React.FC<{ beat: BeatDef; dur: number }> = ({ beat, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame: f, fps, config: { damping: 15, stiffness: 160 } });
  const outP = interpolate(f, [dur - 5, dur], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const P = phoneSize(600);
  const x = (1 - inP) * 760 - outP * 1000;
  const rot = (1 - inP) * 9 - outP * 7;
  let acc = 0;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 72%, #22122a 0%, ${C.ink} 64%)` }}>
      <div style={{ position: "absolute", top: 196, width: "100%", textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 31, color: C.magenta, letterSpacing: ".12em", opacity: inP * (1 - outP) }}>
        {beat.tag}
      </div>
      <div style={{ opacity: 1 - outP }}>
        <Lines at={1} stagger={4} style={{ top: 246 }} lines={beat.lines} />
      </div>
      <Phone w={600} style={{ left: (1080 - P.outerW) / 2 + x, top: 545, transform: `rotate(${rot}deg)` }}>
        {beat.clips.map((c, i) => {
          const from = acc;
          acc += c.dur;
          return (
            <Sequence key={i} from={from} durationInFrames={c.dur} layout="none">
              <Clip name={c.name} start={c.start} last={c.last} />
            </Sequence>
          );
        })}
      </Phone>
      <Grain id={`beat-${beat.key}`} opacity={0.08} />
    </AbsoluteFill>
  );
};

/* ───────── 5. 색이 돌아온다 → 12.15 D-DAY (탈출 문) ───────── */
export const ColorScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const CUT = 56;
  const reveal = interpolate(f, [4, 34], [0, 100], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const band: React.CSSProperties = { position: "absolute", top: 480, left: 0, width: 1080, height: 1280, overflow: "hidden" };
  if (f < CUT) {
    const pan = interpolate(f, [0, CUT], [-120, -360]);
    const img = (filter: string) => <Img src={staticFile("art/pano-desk.jpg")} style={{ position: "absolute", top: 0, left: pan, height: 1280, filter }} />;
    return (
      <AbsoluteFill style={{ background: C.ink }}>
        <div style={band}>
          {img("grayscale(1) brightness(.5) contrast(1.05)")}
          <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - reveal}% 0 0)` }}>{img("saturate(1.2) brightness(1.06)")}</div>
          {reveal > 0 && reveal < 100 && (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${reveal}%`, width: 10, marginLeft: -5, background: "#fff", boxShadow: "0 0 50px 22px rgba(255,0,255,.75)" }} />
          )}
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 120px 30px rgba(14,14,16,.95)" }} />
        </div>
        <Lines
          at={0}
          style={{ top: 200 }}
          lines={[
            { t: "픽셀이 모이면", size: 64, color: C.fog, weight: 800 },
            { t: <>본부에 <M>색</M>이 돌아온다</>, size: 92 },
          ]}
        />
        <Grain id="color-a" opacity={0.08} />
        <StaticFlash id="color-cut" at={CUT - 4} dur={4} />
      </AbsoluteFill>
    );
  }
  const g = f - CUT;
  const pan = interpolate(g, [0, 64], [-270, -340]);
  const neon = 0.65 + 0.35 * Math.sin(g / 3.2);
  const dday = spring({ frame: g - 2, fps, config: { damping: 11, stiffness: 170 } });
  // 탈출 문 자리 (pano-door 안 px)
  const door = { x: 558, y: 148, w: 576, h: 1132 };
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <div style={band}>
        <Img src={staticFile("art/pano-door.jpg")} style={{ position: "absolute", top: 0, left: pan, height: 1280, filter: "saturate(1.15) brightness(.95)" }} />
        <div
          style={{
            position: "absolute",
            left: pan + door.x,
            top: door.y,
            width: door.w,
            height: door.h,
            borderRadius: 10,
            boxShadow: `0 0 0 6px rgba(255,0,255,${neon}), 0 0 60px 18px rgba(255,0,255,${0.55 * neon}), inset 0 0 120px rgba(255,0,255,${0.35 * neon})`,
            mixBlendMode: "screen",
          }}
        />
        <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 120px 30px rgba(14,14,16,.95)" }} />
      </div>
      <div style={{ position: "absolute", top: 140, width: "100%", textAlign: "center", transform: `scale(${interpolate(dday, [0, 1], [1.8, 1])})`, opacity: Math.min(1, dday * 2) }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 900, fontSize: 168, letterSpacing: "-0.03em", color: C.magenta, lineHeight: 1, textShadow: "0 0 70px rgba(255,0,255,.65)" }}>12.15</div>
        <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 56, color: C.white, letterSpacing: ".3em", marginTop: 6 }}>D-DAY</div>
      </div>
      <Lines at={10} style={{ top: 1790 - 60 }} lines={[{ t: "제3구역 벙커가 열린다", size: 54, color: "#d9d9e0", weight: 800 }]} />
      <Grain id="color-b" opacity={0.08} />
    </AbsoluteFill>
  );
};

/* ───────── 6. 키링을 폰에 톡! → 작전 개시 ───────── */
export const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TOUCH = BEAT.tag - SC.cta.from;
  const LOGO = BEAT.logo - SC.cta.from;
  const P = phoneSize(440);
  const px = (1080 - P.outerW) / 2;
  const py = 520;
  const touchPt = { x: px + P.outerW * 0.62, y: py + P.outerH * 0.2 };
  const k = interpolate(f, [2, TOUCH], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ringX = interpolate(k, [0, 1], [1180, touchPt.x]);
  const ringY = interpolate(k, [0, 1], [1780, touchPt.y]);
  const swing = Math.sin(f / 4.5) * 14 * (1 - k);
  const away = interpolate(f, [TOUCH + 4, TOUCH + 14], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const flip = interpolate(f, [TOUCH + 3, TOUCH + 22], [0, 180], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const bump = f >= TOUCH ? spring({ frame: f - TOUCH, fps, config: { damping: 8, stiffness: 260 } }) : 0;
  const hooray = spring({ frame: f - LOGO, fps, config: { damping: 9, stiffness: 160 } });
  const fadeOut = interpolate(f, [SC.cta.dur - 8, SC.cta.dur - 1], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, #2c0f30 0%, ${C.ink} 62%)` }}>
      <Fog opacity={0.18} />
      <div style={{ position: "absolute", top: 150, width: "100%", textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 32, color: C.magenta, letterSpacing: ".16em" }}>HOW TO JOIN</div>
      <Lines at={0} style={{ top: 200 }} lines={[{ t: <>키링을 폰에 <M>톡!</M></>, size: 116 }]} />
      {/* 폰: 뒷면 → 키링이 닿으면 뒤집혀 앱이 열린다 */}
      <div style={{ position: "absolute", left: px, top: py, width: P.outerW, height: P.outerH, perspective: 2200, transform: `scale(${1 + 0.03 * bump * (1 - bump)})` }}>
        <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transform: `rotateY(${flip}deg)` }}>
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
            <PhoneBack w={P.w} />
          </div>
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <Phone w={P.w} style={{ left: 0, top: 0 }} glow={0.35}>
              <Sequence from={TOUCH + 8} layout="none">
                <Clip name="start" start={0} last={41} />
              </Sequence>
            </Phone>
          </div>
        </div>
      </div>
      {/* NFC 물결 */}
      {[0, 5, 10].map((d) => {
        const p = interpolate(f - TOUCH - d, [0, 20], [0, 1], clamp);
        if (p <= 0 || p >= 1) return null;
        const r = 40 + 360 * p;
        return (
          <div
            key={d}
            style={{ position: "absolute", left: touchPt.x - r, top: touchPt.y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `7px solid rgba(255,0,255,${1 - p})`, boxShadow: `0 0 30px rgba(255,0,255,${0.6 * (1 - p)})` }}
          />
        );
      })}
      {/* 키링: 닿은 뒤에는 옆으로 빠지며 사라진다 */}
      {away < 1 && (
        <div
          style={{
            position: "absolute",
            left: ringX - 110 + away * 520,
            top: ringY - 170 - away * 120,
            transform: `rotate(${swing + away * 35}deg) scale(${1 - away * 0.25})`,
            transformOrigin: "50% 12%",
            opacity: 1 - away,
          }}
        >
          <Keyring size={220} />
        </div>
      )}
      <Lines
        at={TOUCH + 18}
        stagger={4}
        style={{ top: py + P.outerH + 46 }}
        lines={[
          { t: "늘곰 구출 작전", size: 62, color: "#d9d9e0", weight: 800 },
          { t: <M>지금 개시!</M>, size: 120 },
        ]}
      />
      {/* 늘곰: 기다릴게! */}
      {f >= LOGO && (
        <div style={{ position: "absolute", left: px + P.outerW - 70, top: py + P.outerH - 330, transform: `scale(${hooray}) rotate(${(1 - hooray) * -20 + Math.sin(f / 6) * 3}deg)`, transformOrigin: "50% 100%" }}>
          <div
            style={{
              position: "absolute",
              left: -90,
              top: -96,
              padding: "12px 26px",
              borderRadius: 28,
              background: "#FBF5E5",
              color: "#5a3b28",
              fontFamily: FONT.hand,
              fontWeight: 700,
              fontSize: 46,
              whiteSpace: "nowrap",
              boxShadow: "0 10px 30px rgba(0,0,0,.4)",
            }}
          >
            기다릴게!
          </div>
          <Img src={staticFile("neulgom/hooray.png")} style={{ height: 340, filter: "drop-shadow(0 16px 30px rgba(0,0,0,.55))" }} />
        </div>
      )}
      <div style={{ position: "absolute", top: 1840, width: "100%", textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 26, color: C.fog, letterSpacing: ".12em", opacity: interpolate(f, [LOGO, LOGO + 10], [0, 1], clamp) }}>
        평범한 스파이 · 회색 안개 통제 구역
      </div>
      <Grain id="cta" opacity={0.09} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut }} />
    </AbsoluteFill>
  );
};
