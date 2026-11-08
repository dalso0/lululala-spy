// 360° 늘곰 본부: 본부를 한 바퀴 도는 영상(video.mp4)에서 뽑은 프레임으로 만든 '둘러보기'.
// 프레임은 영상 한가운데를 세로로 잘라 낸 576×648 (회전 중엔 절반 크기 lo/, 벽 앞에 멈추면 선명한 것).
//
// 영상은 AI가 만든 것이라 방이 정확히 한 바퀴로 이어지지 않는다: 앞 절반(0~18)은 오른쪽으로 돌고,
// 철문 뒤에서 장면이 끊긴 뒤 뒤 절반(19~35)은 반대로 돈다. 그래서 뒤 절반을 거꾸로 이어 붙여
// '왼쪽으로 밀면 늘 화면이 왼쪽으로 흐르는' 고리를 만들고, 끊기는 두 곳은 어둡게 디졸브한다.

import type { MissionId } from "./missions";

export const ROOM = { w: 576, h: 648 } as const;

const range = (a: number, b: number) => (a <= b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : Array.from({ length: a - b + 1 }, (_, i) => a - i));

/** 보는 순서대로 늘어놓은 영상 프레임 번호 (왼쪽으로 밀면 다음) */
export const SEQUENCE: number[] = [...range(0, 18), ...range(31, 20)];

/** SEQUENCE[i] 와 SEQUENCE[i+1] 사이에서 장면이 끊긴다 (마지막 → 처음 포함) */
export const CUT_AFTER = new Set<number>([18, SEQUENCE.length - 1]);

const pad = (n: number) => String(n).padStart(2, "0");
export const loSrc = (frame: number) => `/art/room/lo/${pad(frame)}.webp`;
export const hiSrc = (frame: number) => `/art/room/${pad(frame)}.webp`;

export type Rgb = readonly [number, number, number];
export type SpotFx = "heartbeat" | "cone" | "rings" | "rays" | "pulse" | "neon" | "screen" | "bubbles";

export type Spot = {
  id: string;
  /** 이 미션을 깨면 불이 들어온다 */
  mission?: MissionId;
  /** exit: 엔딩 문 / map: 부스 안내 지도 */
  kind?: "exit" | "map";
  label: string;
  /** 프레임(576×648) 안 좌표 */
  x: number;
  y: number;
  r: number;
  glow: Rgb;
  fx?: SpotFx;
};

export type Station = {
  id: string;
  name: string;
  /** 영상 프레임 번호 */
  frame: number;
  spots: Spot[];
  /** 처음부터 켜져 있는 작은 등 */
  lamps?: { x: number; y: number; r: number }[];
};

const WARM: Rgb = [255, 196, 120];

export const STATIONS: Station[] = [
  {
    id: "desk",
    name: "작전 책상",
    frame: 1,
    lamps: [{ x: 40, y: 112, r: 52 }],
    spots: [
      { id: "notes", mission: "m0_daily", label: "평범지령 메모", x: 445, y: 108, r: 118, glow: [255, 236, 200] },
      { id: "scope", mission: "m1_breathing", label: "심박 모니터", x: 58, y: 326, r: 74, glow: [90, 255, 160], fx: "heartbeat" },
      { id: "lamp", mission: "m2_mirror", label: "진실의 스탠드", x: 276, y: 306, r: 84, glow: [255, 168, 80], fx: "cone" },
    ],
  },
  {
    id: "gears",
    name: "톱니 벽",
    frame: 6,
    spots: [{ id: "gears", mission: "m3_offline_f", label: "톱니 장치", x: 300, y: 300, r: 122, glow: [255, 205, 130], fx: "pulse" }],
  },
  {
    id: "panel",
    name: "제어판",
    frame: 12,
    lamps: [{ x: 56, y: 246, r: 58 }],
    spots: [
      { id: "monitor", mission: "m3_offline_e", label: "감시 모니터", x: 350, y: 252, r: 88, glow: [120, 230, 255], fx: "screen" },
      { id: "switches", mission: "m3_offline_stone", label: "봉인 스위치", x: 275, y: 548, r: 96, glow: [255, 70, 220], fx: "pulse" },
    ],
  },
  {
    id: "door",
    name: "탈출 문",
    frame: 16,
    lamps: [{ x: 290, y: 36, r: 46 }],
    spots: [{ id: "door", kind: "exit", label: "탈출 문", x: 275, y: 380, r: 195, glow: [255, 0, 255], fx: "neon" }],
  },
  {
    id: "window",
    name: "창문",
    frame: 30,
    lamps: [{ x: 446, y: 150, r: 56 }],
    spots: [
      { id: "window", mission: "m3_offline_walk", label: "지하 창문", x: 170, y: 200, r: 138, glow: [130, 235, 255], fx: "rays" },
      { id: "radio", mission: "m3_offline_bowl", label: "주파수 라디오", x: 420, y: 548, r: 82, glow: [255, 188, 90], fx: "rings" },
    ],
  },
  {
    id: "map",
    name: "작전 지도",
    frame: 23,
    lamps: [{ x: 300, y: 92, r: 60 }],
    spots: [{ id: "map", kind: "map", label: "작전 지도", x: 235, y: 290, r: 205, glow: WARM }],
  },
  {
    id: "lab",
    name: "해독 선반",
    frame: 20,
    spots: [{ id: "flasks", mission: "m3_offline_tea", label: "해독제 선반", x: 265, y: 335, r: 138, glow: [140, 255, 180], fx: "bubbles" }],
  },
];

/** 각 벽의 고리 위 위치 (SEQUENCE 안 번호) */
export const stationPos = (s: Station) => SEQUENCE.indexOf(s.frame);

/** 미션 → 그 물건이 있는 벽 */
export const stationOfMission = (id: string) => STATIONS.findIndex((s) => s.spots.some((p) => p.mission === id));

/** 심박 모니터 화면 영역 (책상 프레임 안) */
export const SCOPE_SCREEN = { x: 2, y: 298, w: 50, h: 48 } as const;

/** 프레임 px → 백분율 */
export const px = {
  x: (v: number) => (v / ROOM.w) * 100,
  y: (v: number) => (v / ROOM.h) * 100,
};
