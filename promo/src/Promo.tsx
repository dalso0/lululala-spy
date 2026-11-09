// 평범한 스파이 홍보 쇼츠 (30초, 1080×1920) — 장면을 시간표(timeline.json)에 맞춰 놓는다
import "./fonts";
import { AbsoluteFill, Html5Audio, Sequence, staticFile } from "remotion";
import { BEATS, ColorScene, Cta, Hook, MissionBeat, Recruit, Sos } from "./scenes";
import { C, SC } from "./theme";
import { PixelMeter } from "./ui";

const D = SC.daily.from;
const B = SC.bomb.from;
const MI = SC.mirror.from;
const CE = SC.ceremony.from;
const CO = SC.color.from;

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink }}>
    <Sequence from={SC.hook.from} durationInFrames={SC.hook.dur}>
      <Hook />
    </Sequence>
    <Sequence from={SC.sos.from} durationInFrames={SC.sos.dur}>
      <Sos />
    </Sequence>
    <Sequence from={SC.recruit.from} durationInFrames={SC.recruit.dur}>
      <Recruit />
    </Sequence>
    {BEATS.map((b) => (
      <Sequence key={b.key} from={SC[b.key].from} durationInFrames={SC[b.key].dur}>
        <MissionBeat beat={b} dur={SC[b.key].dur} />
      </Sequence>
    ))}
    <Sequence from={SC.color.from} durationInFrames={SC.color.dur}>
      <ColorScene />
    </Sequence>
    <Sequence from={SC.cta.from} durationInFrames={SC.cta.dur}>
      <Cta />
    </Sequence>
    {/* 픽셀 5칸: 미션을 깰 때마다 하나씩, 색이 돌아올 때 다섯째 */}
    <Sequence from={D} durationInFrames={CO + 56 - D}>
      <PixelMeter events={[40, B - D + 80, MI - D + 60, CE - D + 40, CO - D + 4]} hideAt={CO + 56 - D} />
    </Sequence>
    {/* 소리: 음악 + 앱 효과음을 미리 섞은 한 줄 (scripts/sfx.cjs, 자리는 scripts/sfx-plan.cjs) */}
    <Html5Audio src={staticFile("sfx/mix.wav")} />
  </AbsoluteFill>
);
