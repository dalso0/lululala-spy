// 360° 늘곰 본부: 본부를 도는 영상(video2.mp4)을 이어 붙인 파노라마 한 장(public/art/pano).
// 파노라마는 scripts/room/build-panorama.cjs 가 만든다. 영상을 바꾸면 그 스크립트를 다시 돌리고,
// 물건 위치가 달라졌으면 아래 좌표만 고치면 된다.
// 좌표는 높이 1280px 파노라마(720×1280 세로 영상) 기준 px. 같은 영상을 다른 해상도로 다시 만들면 비율대로 맞춰진다.

import pano from "../../public/art/pano/manifest.json";
import type { MissionId } from "./missions";

export const PANO = { w: pano.w, h: pano.h, tile: pano.tile, tiles: pano.tiles } as const;
// ?v= 는 그림이 바뀔 때마다 달라진다(만들 때 계산) → 폰에 남은 예전 타일과 섞이지 않는다
export const tileSrc = (i: number) => `/art/pano/${i}.webp?v=${pano.v}`;
export const PREVIEW_SRC = `/art/pano/preview.webp?v=${pano.v}`;
/** 미리보기는 원본의 1/8 크기 */
export const PREVIEW_SCALE = 8;

/** 좌표 기준 높이 → 지금 파노라마 높이 */
const K = PANO.h / 1280;

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
  { id: "scope", mission: "m1_breathing", label: "심박 모니터", x: 185, y: 600, r: 165, glow: [90, 255, 160], fx: "heartbeat" },
  { id: "lamp", mission: "m2_mirror", label: "진실의 스탠드", x: 560, y: 600, r: 180, glow: [255, 168, 80], fx: "cone" },
  { id: "notes", mission: "m0_daily", label: "평범지령 메모", x: 970, y: 200, r: 240, glow: [255, 236, 200] },
  { id: "gears", mission: "m3_offline_f", label: "톱니 장치", x: 1950, y: 545, r: 260, glow: [255, 205, 130], fx: "pulse" },
  { id: "switches", mission: "m3_offline_stone", label: "봉인 스위치", x: 3018, y: 446, r: 170, glow: [255, 70, 220], fx: "pulse" },
  { id: "monitors", mission: "m3_offline_e", label: "감시 모니터", x: 4200, y: 482, r: 210, glow: [120, 230, 255], fx: "screen" },
  { id: "door", kind: "exit", label: "탈출 문", x: 4746, y: 700, r: 420, glow: [255, 0, 255], fx: "neon" },
  { id: "window", mission: "m3_offline_walk", label: "지하 창문", x: 6280, y: 360, r: 280, glow: [130, 235, 255], fx: "rays" },
  { id: "radio", mission: "m3_offline_bowl", label: "주파수 라디오", x: 6738, y: 965, r: 200, glow: [255, 188, 90], fx: "rings" },
  { id: "map", kind: "map", label: "작전 지도", x: 8320, y: 510, r: 480, glow: [255, 220, 170] },
  { id: "flasks", mission: "m3_offline_tea", label: "해독제 선반", x: 9190, y: 575, r: 260, glow: [140, 255, 180], fx: "bubbles" },
];
export const SPOTS: Spot[] = RAW_SPOTS.map((s) => ({ ...s, x: s.x * K, y: s.y * K, r: s.r * K }));

/** 처음부터 켜져 있는 작은 등 (본부가 완전히 죽어 있지는 않다는 느낌) */
export const LAMPS = [
  { x: 177, y: 187, r: 80 }, // 책상 선반 등
  { x: 3237, y: 420, r: 90 }, // 제어판 매달린 등
  { x: 4752, y: 70, r: 100 }, // 탈출 문 위 등
  { x: 6765, y: 262, r: 90 }, // 창문 옆 벽등
  { x: 8362, y: 168, r: 120 }, // 지도 위 등
].map((l) => ({ x: l.x * K, y: l.y * K, r: l.r * K }));

/** 심박 모니터 화면 */
export const SCOPE_SCREEN = { x: 96 * K, y: 519 * K, w: 96 * K, h: 98 * K };
/** 스탠드 불빛 원뿔: 갓 아래 두 점 → 책상 위 두 점 */
export const LAMP_CONE = {
  top: [515 * K, 655 * K] as const,
  topY: 600 * K,
  bottom: [280 * K, 720 * K] as const,
  bottomY: 930 * K,
};

/** 화살표·나침반이 멈춰 서는 곳 */
export const STOPS = [
  { name: "작전 책상", x: 580 },
  { name: "톱니 벽", x: 1950 },
  { name: "제어판", x: 3150 },
  { name: "감시 모니터", x: 4100 },
  { name: "탈출 문", x: 4746 },
  { name: "창문", x: 6480 },
  { name: "작전 지도", x: 8320 },
  { name: "해독 선반", x: 9150 },
].map((s) => ({ name: s.name, x: s.x * K }));

/** 지금 보고 있는 곳 이름 */
const REGIONS = [
  { from: 0, name: "작전 책상" },
  { from: 1350, name: "톱니 벽" },
  { from: 2450, name: "제어판" },
  { from: 3560, name: "감시 모니터" },
  { from: 4430, name: "탈출 문" },
  { from: 5100, name: "증기 배관" },
  { from: 5950, name: "창문" },
  { from: 6990, name: "책장" },
  { from: 7820, name: "작전 지도" },
  { from: 8900, name: "해독 선반" },
].map((r) => ({ from: r.from * K, name: r.name }));

export const wrap = (x: number) => ((x % PANO.w) + PANO.w) % PANO.w;
/** a 에서 b 까지 고리를 따라 가장 짧게 가는 거리 (−w/2 ~ w/2) */
export const wrapDelta = (d: number) => {
  const m = wrap(d + PANO.w / 2) - PANO.w / 2;
  return m;
};

export function regionAt(x: number) {
  const p = wrap(x);
  let name = REGIONS[0].name;
  for (const r of REGIONS) if (p >= r.from) name = r.name;
  return name;
}

export const spotOfMission = (id: string) => SPOTS.find((s) => s.mission === id);
