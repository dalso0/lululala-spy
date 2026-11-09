// 효과음을 놓을 자리: [프레임, 앱 효과음 이름, 크기]. 녹화할 때 누른 프레임(public/clips/*.json)에 맞췄다.
// 장면 시간은 src/timeline.json 에서 온다 — 시간표를 바꾸면 여기 자리도 같이 따라간다.
const TL = require("../src/timeline.json");
const FPS = TL.fps;
const sec = (s) => Math.round(s * FPS);
const SC = Object.fromEntries(Object.entries(TL.scenes).map(([k, [a, b]]) => [k, { from: sec(a), dur: sec(b) - sec(a) }]));
const BEAT = { tag: sec(TL.beats.tagTouch), logo: sec(TL.beats.logo) };
const D = SC.daily.from;
const B = SC.bomb.from;
const MI = SC.mirror.from;
const CE = SC.ceremony.from;
const CO = SC.color.from;

module.exports = [
  // 훅: 글자 찍히는 소리 · 글자 쿵
  ...[4, 7, 10, 13, 16, 19].map((fr) => [fr, "tick", 0.22]),
  [11, "thunk", 0.55],
  [23, "thunk", 0.7],
  // 늘곰 SOS: 손글씨 찍히는 소리 → 신호 끊김
  [SC.sos.from + 2, "hum", 0.45],
  ...Array.from({ length: 10 }, (_, i) => [SC.sos.from + 10 + i * 5, "tick", 0.13]),
  [SC.sos.from + 66, "deny", 0.7],
  // 요원 신분: 누르기 → 카드 → 바로 너.
  [SC.recruit.from + 42, "tap", 0.8],
  [SC.recruit.from + 50, "sparkle", 0.5],
  [SC.recruit.from + 60, "stamp", 0.95],
  // 평범지령: 체크 두 번 → 완료
  [D + 2, "switch", 0.75],
  [D + 18, "switch", 0.75],
  [D + 36, "chime", 0.7],
  [D + 40, "sparkle", 0.55],
  // 시한폭탄: 시작 → 들이쉬기
  [B + 2, "thunk", 0.7],
  [B + 6, "inhale", 0.75],
  [B + 80, "sparkle", 0.5],
  // 거울: 집기 → 휴지통 → 새기기 → 와장창
  [MI + 2, "tap", 0.6],
  [MI + 19, "thunk", 0.7],
  [MI + 48, "focus", 0.5],
  [MI + 54, "glass", 0.95],
  [MI + 60, "sparkle", 0.5],
  // 픽셀 장착
  [CE + 6, "latch", 0.85],
  [CE + 12, "whir", 0.6],
  [CE + 26, "thunk", 0.6],
  [CE + 40, "sparkle", 0.55],
  [CE + 64, "power", 0.5],
  // 색이 돌아온다 → 탈출 문
  [CO + 2, "power", 0.8],
  [CO + 6, "sparkle", 0.6],
  [CO + 20, "chime", 0.55],
  [CO + 57, "hum", 0.6],
  // 키링 톡!
  [BEAT.tag, "chime", 0.95],
  [BEAT.tag, "sparkle", 0.7],
  [BEAT.tag + 4, "whir", 0.45],
  [BEAT.tag + 18, "stamp", 0.85],
  [BEAT.logo, "sparkle", 0.6],
];
