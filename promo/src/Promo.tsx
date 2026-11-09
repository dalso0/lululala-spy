// 평범한 스파이 홍보 쇼츠 (32초, 1080×1920) — 시네마틱(video7) + 실제 앱 장면을 시간표(timeline.json)에 맞춰 잇는다
import "./fonts";
import { AbsoluteFill, Html5Audio, Sequence, staticFile } from "remotion";
import { BEATS, ColorScene, Cta, EndCard, Footage, MissionBeat, Recruit } from "./scenes";
import { C, SC } from "./theme";
import { PixelMeter } from "./ui";

const D = SC.daily.from;

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink }}>
    <Sequence from={SC.v7open.from} durationInFrames={SC.v7open.dur}>
      <Footage part="v7open" flashIn={false} />
    </Sequence>
    <Sequence from={SC.recruit.from} durationInFrames={SC.recruit.dur}>
      <Recruit />
    </Sequence>
    <Sequence from={SC.v7hack.from} durationInFrames={SC.v7hack.dur}>
      <Footage part="v7hack" />
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
    <Sequence from={SC.v7cta.from} durationInFrames={SC.v7cta.dur}>
      <Footage part="v7cta" />
    </Sequence>
    <Sequence from={SC.end.from} durationInFrames={SC.end.dur}>
      <EndCard />
    </Sequence>
    {/* 픽셀 5칸: 작전을 깰 때마다 하나씩, 색이 돌아올 때 다섯째 */}
    <Sequence from={D} durationInFrames={SC.color.from + 60 - D}>
      <PixelMeter
        events={[32, SC.bomb.from - D + 66, SC.mirror.from - D + 48, SC.ceremony.from - D + 33, SC.color.from - D + 4]}
        hideAt={SC.color.from + 60 - D}
      />
    </Sequence>
    {/* 소리: video7 소리 + 배경 음악 + 앱 효과음을 미리 섞은 한 줄 (scripts/sfx.cjs, 자리는 scripts/sfx-plan.cjs) */}
    <Html5Audio src={staticFile("sfx/mix.wav")} />
  </AbsoluteFill>
);
