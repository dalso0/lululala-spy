// 늘곰 본부(hq.webp, 896×1200) 안의 물건 좌표와, 어떤 미션을 깨면 어디에 불이 들어오는지.
// 좌표는 원본 그림 픽셀 기준. 그림을 바꾸면 여기 숫자만 고치면 된다.

import type { MissionId } from "./missions";

export const HQ = { src: "/art/hq.webp", w: 896, h: 1200 } as const;

export type Rgb = readonly [number, number, number];

export type SpotFx = "heartbeat" | "cone" | "rings" | "steam" | "rays" | "pulse" | "neon";

export type Spot = {
  id: string;
  /** 이 미션을 깨면 불이 들어온다 (없으면 엔딩 전용) */
  mission?: MissionId;
  /** 들여다볼 때 보이는 물건 이름 */
  label: string;
  x: number;
  y: number;
  /** 불빛 반경 (그림 px) */
  r: number;
  glow: Rgb;
  fx?: SpotFx;
};

export const SPOTS: Spot[] = [
  { id: "board", mission: "m0_daily", label: "작전 코르크보드", x: 745, y: 505, r: 158, glow: [255, 232, 196] },
  { id: "crt", mission: "m1_breathing", label: "심박 모니터", x: 118, y: 630, r: 96, glow: [90, 255, 160], fx: "heartbeat" },
  { id: "lamp", mission: "m2_mirror", label: "진실의 스탠드", x: 562, y: 566, r: 108, glow: [255, 168, 80], fx: "cone" },
  { id: "window", mission: "m3_offline_walk", label: "지하 창문", x: 195, y: 122, r: 112, glow: [130, 235, 255], fx: "rays" },
  { id: "radio", mission: "m3_offline_bowl", label: "주파수 라디오", x: 222, y: 425, r: 86, glow: [255, 188, 90], fx: "rings" },
  { id: "mug", mission: "m3_offline_tea", label: "해독제 머그", x: 685, y: 742, r: 74, glow: [255, 198, 140], fx: "steam" },
  { id: "device", mission: "m3_offline_stone", label: "봉인 장치", x: 490, y: 668, r: 86, glow: [255, 70, 220], fx: "pulse" },
  { id: "scope", mission: "m3_offline_e", label: "파형 측정기", x: 330, y: 608, r: 96, glow: [120, 255, 200], fx: "pulse" },
  { id: "gears", mission: "m3_offline_f", label: "톱니 선반", x: 790, y: 258, r: 76, glow: [255, 205, 130], fx: "pulse" },
];

/** 선생님이 늘곰 연구소를 열면 켜지는 곳 */
export const ENDING_SPOTS: Spot[] = [
  { id: "sign", label: "늘곰 간판", x: 772, y: 1052, r: 140, glow: [255, 0, 255], fx: "neon" },
  { id: "window2", label: "지하 창문", x: 660, y: 122, r: 112, glow: [130, 235, 255], fx: "rays" },
];

/** 처음부터 켜져 있는 작은 선반 등 (본부가 완전히 죽어 있지는 않다는 느낌) */
export const AMBIENT_LAMP: Spot = { id: "shelf-lamp", label: "선반 등", x: 400, y: 425, r: 50, glow: [255, 196, 120] };

/** 심박 모니터 화면 영역 (그림 px) */
export const CRT_SCREEN = { x: 66, y: 588, w: 104, h: 82 } as const;

/** 그림 px → 백분율 */
export const px = {
  x: (v: number) => (v / HQ.w) * 100,
  y: (v: number) => (v / HQ.h) * 100,
};
