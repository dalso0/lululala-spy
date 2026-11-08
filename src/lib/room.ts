// 360° 늘곰 본부: 본부를 한 바퀴 도는 영상(video.mp4)을 이어 붙인 파노라마 한 장(public/art/pano).
// 파노라마는 scripts/room/build-panorama.cjs 가 만든다. 영상을 바꾸면 그 스크립트를 다시 돌리고,
// 물건 위치가 달라졌으면 아래 좌표만 고치면 된다.
// 좌표는 높이 648px 파노라마(720p 영상) 기준 px. 같은 영상을 더 큰 해상도로 다시 만들면 비율대로 커진다.

import pano from "../../public/art/pano/manifest.json";
import type { MissionId } from "./missions";

export const PANO = { w: pano.w, h: pano.h, tile: pano.tile, tiles: pano.tiles } as const;
export const tileSrc = (i: number) => `/art/pano/${i}.webp`;
export const PREVIEW_SRC = "/art/pano/preview.webp";
/** 미리보기는 원본의 1/8 크기 */
export const PREVIEW_SCALE = 8;

/** 좌표 기준 높이 → 지금 파노라마 높이 */
const K = PANO.h / 648;

export type Rgb = readonly [number, number, number];
export type SpotFx = "heartbeat" | "cone" | "rings" | "rays" | "pulse" | "neon" | "screen" | "bubbles";

export type Spot = {
  id: string;
  /** 이 미션을 깨면 불이 들어온다 */
  mission?: MissionId;
  /** exit: 엔딩 문 / map: 부스 안내 지도 */
  kind?: "exit" | "map";
  label: string;
  x: number;
  y: number;
  r: number;
  glow: Rgb;
  fx?: SpotFx;
};

const RAW_SPOTS: Spot[] = [
  { id: "scope", mission: "m1_breathing", label: "심박 모니터", x: 213, y: 318, r: 88, glow: [90, 255, 160], fx: "heartbeat" },
  { id: "lamp", mission: "m2_mirror", label: "진실의 스탠드", x: 466, y: 300, r: 95, glow: [255, 168, 80], fx: "cone" },
  { id: "notes", mission: "m0_daily", label: "평범지령 메모", x: 690, y: 112, r: 165, glow: [255, 236, 200] },
  { id: "gears", mission: "m3_offline_f", label: "톱니 장치", x: 1258, y: 302, r: 150, glow: [255, 205, 130], fx: "pulse" },
  { id: "switches", mission: "m3_offline_stone", label: "봉인 스위치", x: 2243, y: 545, r: 140, glow: [255, 70, 220], fx: "pulse" },
  { id: "monitors", mission: "m3_offline_e", label: "감시 모니터", x: 2455, y: 270, r: 172, glow: [120, 230, 255], fx: "screen" },
  { id: "door", kind: "exit", label: "탈출 문", x: 2892, y: 370, r: 230, glow: [255, 0, 255], fx: "neon" },
  { id: "window", mission: "m3_offline_walk", label: "지하 창문", x: 3712, y: 195, r: 165, glow: [130, 235, 255], fx: "rays" },
  { id: "radio", mission: "m3_offline_bowl", label: "주파수 라디오", x: 3933, y: 545, r: 105, glow: [255, 188, 90], fx: "rings" },
  { id: "map", kind: "map", label: "작전 지도", x: 4860, y: 288, r: 260, glow: [255, 220, 170] },
  { id: "flasks", mission: "m3_offline_tea", label: "해독제 선반", x: 5400, y: 330, r: 165, glow: [140, 255, 180], fx: "bubbles" },
];
export const SPOTS: Spot[] = RAW_SPOTS.map((s) => ({ ...s, x: s.x * K, y: s.y * K, r: s.r * K }));

/** 처음부터 켜져 있는 작은 등 (본부가 완전히 죽어 있지는 않다는 느낌) */
export const LAMPS = [
  { x: 234, y: 113, r: 58 },
  { x: 2021, y: 234, r: 64 },
  { x: 2895, y: 40, r: 60 },
  { x: 3961, y: 156, r: 64 },
  { x: 4884, y: 96, r: 72 },
].map((l) => ({ x: l.x * K, y: l.y * K, r: l.r * K }));

/** 심박 모니터 화면 (파노라마 px) */
export const SCOPE_SCREEN = { x: 184 * K, y: 284 * K, w: 58 * K, h: 60 * K };
/** 스탠드 불빛 원뿔: 갓 아래 두 점 → 책상 위 두 점 */
export const LAMP_CONE = {
  top: [440 * K, 505 * K] as const,
  topY: 338 * K,
  bottom: [345 * K, 640 * K] as const,
  bottomY: 565 * K,
};

/** 화살표·나침반이 멈춰 서는 곳 */
export const STOPS = [
  { name: "작전 책상", x: 470 },
  { name: "톱니 벽", x: 1258 },
  { name: "제어판", x: 2350 },
  { name: "탈출 문", x: 2892 },
  { name: "창문", x: 3820 },
  { name: "작전 지도", x: 4860 },
  { name: "해독 선반", x: 5400 },
].map((s) => ({ name: s.name, x: s.x * K }));

/** 지금 보고 있는 곳 이름 */
const REGIONS = [
  { from: 120, name: "작전 책상" },
  { from: 900, name: "톱니 벽" },
  { from: 1560, name: "제어판" },
  { from: 2700, name: "탈출 문" },
  { from: 3100, name: "증기 배관" },
  { from: 3500, name: "창문" },
  { from: 4080, name: "책장" },
  { from: 4560, name: "작전 지도" },
  { from: 5180, name: "해독 선반" },
].map((r) => ({ from: r.from * K, name: r.name }));

export const wrap = (x: number) => ((x % PANO.w) + PANO.w) % PANO.w;
/** a 에서 b 까지 고리를 따라 가장 짧게 가는 거리 (−w/2 ~ w/2) */
export const wrapDelta = (d: number) => {
  const m = wrap(d + PANO.w / 2) - PANO.w / 2;
  return m;
};

export function regionAt(x: number) {
  const p = wrap(x);
  let name = REGIONS[REGIONS.length - 1].name; // 처음 120px 은 해독 선반 옆 문
  for (const r of REGIONS) if (p >= r.from) name = r.name;
  return name;
}

export const spotOfMission = (id: string) => SPOTS.find((s) => s.mission === id);
