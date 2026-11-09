// 장면들. 프레임 번호는 모두 그 장면 안에서의 번호(0부터)다.
// 시네마틱 장면(복도 경보 · 인형 늘곰 · 키링 태그)은 다른 모델이 만든 video7 을 그대로 쓰고,
// 앱 장면(요원명 발급 · 작전 4개 · 색 복구 · 키링 태그 방법)은 실제 앱 녹화로 만든다.
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BEAT, C, FONT, FOOT, SC } from "./theme";
import { Clip, clamp, Fog, GlitchText, Grain, Keyring, Line, Lines, M, Phone, PhoneBack, phoneSize, StaticFlash } from "./ui";

/* ───────── video7 조각 (소리는 미리 섞은 mix.wav 에 들어 있다) ───────── */
export const Footage: React.FC<{ part: keyof typeof FOOT.from; flashIn?: boolean }> = ({ part, flashIn = true }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <OffthreadVideo src={staticFile(FOOT.file)} trimBefore={FOOT.from[part]} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    {flashIn && <StaticFlash id={`ft-${part}`} at={0} dur={4} />}
  </AbsoluteFill>
);

/* ───────── 요원명 발급 → 바로 너. ───────── */
export const Recruit: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const YOU = BEAT.you - SC.recruit.from;
  const enter = spring({ frame: f, fps, config: { damping: 16, stiffness: 120 } });
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
        <Clip name="start" start={26} last={107} />
      </Phone>
      <Grain id="rec" opacity={0.12} />
      <StaticFlash id="rec-in" at={0} dur={5} />
    </AbsoluteFill>
  );
};

/* ───────── 작전 장면 (2.5초씩, 녹화를 조금 빠르게) ───────── */
export type BeatDef = {
  key: "daily" | "bomb" | "mirror" | "ceremony";
  tag: string;
  lines: Line[];
  clips: { name: string; start: number; last: number; dur: number; speed: number }[];
};
export const BEATS: BeatDef[] = [
  {
    key: "daily",
    tag: "MISSION 00 · 평범지령",
    lines: [{ t: "평범한 하루가", size: 74 }, { t: <M>곧 위장술</M>, size: 104 }],
    clips: [{ name: "daily", start: 8, last: 131, dur: 75, speed: 1.3 }],
  },
  {
    key: "bomb",
    tag: "MISSION 01 · 스트레스 시한폭탄",
    lines: [{ t: "숨 세 번으로", size: 74 }, { t: <M>폭탄 해체</M>, size: 104 }],
    clips: [{ name: "bomb", start: 4, last: 119, dur: 75, speed: 1.2 }],
  },
  {
    key: "mirror",
    tag: "MISSION 02 · 진실의 거울 방",
    lines: [{ t: "의심은 던지고", size: 74 }, { t: <M>거울은 깨고</M>, size: 104 }],
    clips: [
      { name: "mirror", start: 2, last: 71, dur: 36, speed: 1.25 },
      { name: "mirror-break", start: 0, last: 83, dur: 39, speed: 1.15 },
    ],
  },
  {
    key: "ceremony",
    tag: "PIXEL CORE INSTALL",
    lines: [{ t: "모은 픽셀로", size: 74 }, { t: <M>본부에 불을 켜라</M>, size: 92 }],
    clips: [{ name: "ceremony", start: 2, last: 125, dur: 75, speed: 1.2 }],
  },
];

export const MissionBeat: React.FC<{ beat: BeatDef; dur: number }> = ({ beat, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame: f, fps, config: { damping: 15, stiffness: 170 } });
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
        <Lines at={1} stagger={3} style={{ top: 246 }} lines={beat.lines} />
      </div>
      <Phone w={600} style={{ left: (1080 - P.outerW) / 2 + x, top: 545, transform: `rotate(${rot}deg)` }}>
        {beat.clips.map((c, i) => {
          const from = acc;
          acc += c.dur;
          return (
            <Sequence key={i} from={from} durationInFrames={c.dur} layout="none">
              <Clip name={c.name} start={c.start} last={c.last} speed={c.speed} />
            </Sequence>
          );
        })}
      </Phone>
      <Grain id={`beat-${beat.key}`} opacity={0.08} />
    </AbsoluteFill>
  );
};

/* ───────── 색이 돌아온다 → 12.15 D-DAY (탈출 문) ───────── */
export const ColorScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const CUT = 60;
  const reveal = interpolate(f, [4, 34], [0, 100], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const band: React.CSSProperties = { position: "absolute", top: 480, left: 0, width: 1080, height: 1280, overflow: "hidden" };
  if (f < CUT) {
    const pan = interpolate(f, [0, CUT], [-120, -380]);
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
  const pan = interpolate(g, [0, 60], [-270, -340]);
  const neon = 0.65 + 0.35 * Math.sin(g / 3.2);
  const dday = spring({ frame: g - 2, fps, config: { damping: 11, stiffness: 170 } });
  const door = { x: 558, y: 148, w: 576, h: 1132 }; // pano-door 안 탈출 문 자리
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
      <Lines at={10} style={{ top: 1730 }} lines={[{ t: "제3구역 벙커가 열린다", size: 54, color: "#d9d9e0", weight: 800 }]} />
      <Grain id="color-b" opacity={0.08} />
    </AbsoluteFill>
  );
};

/* ───────── 키링을 폰에 톡! → 본부(앱)가 열린다 ───────── */
export const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TOUCH = BEAT.tag - SC.cta.from;
  const P = phoneSize(440);
  const px = (1080 - P.outerW) / 2;
  const py = 500;
  const touchPt = { x: px + P.outerW * 0.62, y: py + P.outerH * 0.2 };
  const k = interpolate(f, [2, TOUCH], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ringX = interpolate(k, [0, 1], [1180, touchPt.x]);
  const ringY = interpolate(k, [0, 1], [1780, touchPt.y]);
  const swing = Math.sin(f / 4.5) * 14 * (1 - k);
  const away = interpolate(f, [TOUCH + 4, TOUCH + 14], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const flip = interpolate(f, [TOUCH + 3, TOUCH + 22], [0, 180], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const bump = f >= TOUCH ? spring({ frame: f - TOUCH, fps, config: { damping: 8, stiffness: 260 } }) : 0;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, #2c0f30 0%, ${C.ink} 62%)` }}>
      <Fog opacity={0.18} />
      <div style={{ position: "absolute", top: 150, width: "100%", textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 32, color: C.magenta, letterSpacing: ".16em" }}>HOW TO JOIN</div>
      <Lines at={0} style={{ top: 200 }} lines={[{ t: <>키링을 폰에 <M>톡!</M></>, size: 116 }]} />
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
      {[0, 5, 10].map((d) => {
        const p = interpolate(f - TOUCH - d, [0, 20], [0, 1], clamp);
        if (p <= 0 || p >= 1) return null;
        const r = 40 + 360 * p;
        return (
          <div
            key={d}
            style={{ position: "absolute", left: touchPt.x - r, top: touchPt.y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `7px solid rgba(127,247,255,${1 - p})`, boxShadow: `0 0 30px rgba(255,0,255,${0.6 * (1 - p)})` }}
          />
        );
      })}
      {away < 1 && (
        <div
          style={{
            position: "absolute",
            left: ringX - 100 + away * 520,
            top: ringY - 150 - away * 120,
            transform: `rotate(${swing + away * 35}deg) scale(${1 - away * 0.25})`,
            transformOrigin: "20% 10%",
            opacity: 1 - away,
          }}
        >
          <Keyring size={210} />
        </div>
      )}
      <Lines
        at={TOUCH + 16}
        stagger={4}
        style={{ top: py + P.outerH + 40 }}
        lines={[
          { t: "태그하면", size: 58, color: "#d9d9e0", weight: 800 },
          { t: <><M>본부</M>가 열린다</>, size: 96 },
        ]}
      />
      <Grain id="cta" opacity={0.09} />
    </AbsoluteFill>
  );
};

/* ───────── 마지막: 평범한 스파이 · 11.16(월) 요원 소집 · 작전 개시! ───────── */
export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bear = spring({ frame: f - 10, fps, config: { damping: 9, stiffness: 150 } });
  const go = spring({ frame: f - 18, fps, config: { damping: 9, stiffness: 200 } });
  const fadeOut = interpolate(f, [SC.end.dur - 7, SC.end.dur - 1], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 46%, #33103a 0%, ${C.ink} 64%)` }}>
      <Fog opacity={0.18} />
      <div style={{ position: "absolute", top: 300, width: "100%", textAlign: "center", fontFamily: FONT.mono, fontWeight: 700, fontSize: 32, color: C.fog, letterSpacing: ".2em" }}>
        OPERATION · GRAY FOG
      </div>
      <div style={{ position: "absolute", top: 352, width: "100%", display: "flex", justifyContent: "center" }}>
        <GlitchText size={150} at={0} seed="end" color={C.white}>
          평범한 스파이
        </GlitchText>
      </div>
      {/* 늘곰: 기다릴게! */}
      <div style={{ position: "absolute", left: 540 - 150, top: 610, transform: `scale(${bear}) rotate(${(1 - bear) * -18 + Math.sin(f / 6) * 3}deg)`, transformOrigin: "50% 100%" }}>
        <div
          style={{
            position: "absolute",
            left: 300,
            top: 120,
            padding: "12px 26px",
            borderRadius: 28,
            background: "#FBF5E5",
            color: "#5a3b28",
            fontFamily: FONT.hand,
            fontWeight: 700,
            fontSize: 50,
            whiteSpace: "nowrap",
            boxShadow: "0 10px 30px rgba(0,0,0,.4)",
          }}
        >
          기다릴게!
        </div>
        <Img src={staticFile("neulgom/hooray.png")} style={{ height: 420, filter: "drop-shadow(0 16px 30px rgba(0,0,0,.55))" }} />
      </div>
      <Lines at={6} style={{ top: 1080 }} lines={[{ t: "11.16(월) 요원 소집", size: 78 }]} />
      <div
        style={{
          position: "absolute",
          top: 1190,
          width: "100%",
          textAlign: "center",
          fontFamily: FONT.sans,
          fontWeight: 900,
          fontSize: 156,
          letterSpacing: "-0.03em",
          color: C.magenta,
          transform: `scale(${interpolate(go, [0, 1], [2, 1])})`,
          opacity: Math.min(1, go * 2),
          textShadow: "0 0 70px rgba(255,0,255,.6), 0 10px 40px rgba(0,0,0,.6)",
        }}
      >
        작전 개시!
      </div>
      <Grain id="end" opacity={0.1} />
      <StaticFlash id="end-in" at={0} dur={5} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut }} />
    </AbsoluteFill>
  );
};
