import TL from "./timeline.json";

export const FPS = TL.fps;
export const TOTAL = Math.round(TL.seconds * FPS);
export const sec = (s: number) => Math.round(s * FPS);

type SceneName = keyof typeof TL.scenes;
/** 장면마다 시작 프레임과 길이 */
export const SC = Object.fromEntries(
  (Object.entries(TL.scenes) as [SceneName, number[]][]).map(([k, [a, b]]) => [k, { from: sec(a), dur: sec(b) - sec(a) }]),
) as Record<SceneName, { from: number; dur: number }>;
export const BEAT = { you: sec(TL.beats.you), tag: sec(TL.beats.tagTouch), end: sec(TL.beats.endHit) };
/** 다른 모델이 만든 영상(video7) 조각: 장면 이름 → 원본에서 시작하는 프레임 */
export const FOOT = { file: TL.footage.file, from: Object.fromEntries(Object.entries(TL.footage.from).map(([k, v]) => [k, sec(v)])) as Record<"v7open" | "v7hack" | "v7cta", number> };

// 앱과 같은 색
export const C = {
  ink: "#0e0e10",
  panel: "#18181b",
  line: "#2c2c31",
  fog: "#9b9ba3",
  magenta: "#ff00ff",
  cyan: "#7ff7ff",
  white: "#f4f4f6",
};
export const FONT = {
  sans: "Pretendard, 'Apple SD Gothic Neo', sans-serif",
  mono: "NanumGothicCoding, ui-monospace, monospace",
  hand: "Gaegu, Pretendard, sans-serif",
};
