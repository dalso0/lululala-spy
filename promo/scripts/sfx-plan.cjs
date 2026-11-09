// 효과음을 놓을 자리: [프레임, 앱 효과음 이름, 크기]. 녹화할 때 누른 프레임(public/clips/*.json)과 재생 빠르기에 맞췄다.
// video7 장면에는 그 영상의 소리를 그대로 쓰므로 효과음을 얹지 않는다.
// 장면 시간은 src/timeline.json 에서 온다 — 시간표를 바꾸면 여기 자리도 같이 따라간다.
const TL = require("../src/timeline.json");
const FPS = TL.fps;
const sec = (s) => Math.round(s * FPS);
const SC = Object.fromEntries(Object.entries(TL.scenes).map(([k, [a, b]]) => [k, { from: sec(a), dur: sec(b) - sec(a) }]));
const YOU = sec(TL.beats.you);
const TAG = sec(TL.beats.tagTouch);
const R = SC.recruit.from;
const D = SC.daily.from;
const B = SC.bomb.from;
const MI = SC.mirror.from;
const CE = SC.ceremony.from;
const CO = SC.color.from;
const E = SC.end.from;

module.exports = [
  // 요원명 발급: 누르기 → 카드 → 바로 너.
  [R + 16, "tap", 0.8],
  [R + 26, "sparkle", 0.5],
  [YOU, "stamp", 0.95],
  // 평범지령: 체크 두 번 → 완료 → 픽셀
  [D + 2, "switch", 0.75],
  [D + 14, "switch", 0.75],
  [D + 28, "chime", 0.7],
  [D + 32, "sparkle", 0.5],
  // 시한폭탄: 시작 → 들이쉬기 → 픽셀
  [B + 2, "thunk", 0.7],
  [B + 5, "inhale", 0.75],
  [B + 66, "sparkle", 0.5],
  // 거울: 집기 → 휴지통 → 새기기 → 와장창
  [MI + 2, "tap", 0.6],
  [MI + 15, "thunk", 0.7],
  [MI + 39, "focus", 0.5],
  [MI + 45, "glass", 0.95],
  [MI + 48, "sparkle", 0.5],
  // 픽셀 장착
  [CE + 5, "latch", 0.85],
  [CE + 10, "whir", 0.6],
  [CE + 21, "thunk", 0.6],
  [CE + 33, "sparkle", 0.55],
  [CE + 53, "power", 0.5],
  // 색이 돌아온다 → 탈출 문
  [CO + 2, "power", 0.8],
  [CO + 6, "sparkle", 0.6],
  [CO + 20, "chime", 0.55],
  [CO + 61, "hum", 0.6],
  // 키링 톡! → 본부가 열린다
  [TAG, "chime", 0.95],
  [TAG, "sparkle", 0.7],
  [TAG + 4, "whir", 0.45],
  [TAG + 16, "stamp", 0.7],
  // 마지막: 늘곰 → 작전 개시!
  [E + 10, "sparkle", 0.6],
  [E + 18, "stamp", 0.9],
];
