// 미션 목록 · 잠금 규칙 · 진행도 계산. 미션을 추가·수정할 때는 이 파일만 고치면 된다.

import { DAILY_ORDERS } from "./daily";

export type MissionId =
  | "m0_daily"
  | "m1_breathing"
  | "m2_mirror"
  | "m3_offline_walk"
  | "m3_offline_bowl"
  | "m3_offline_tea"
  | "m3_offline_stone"
  | "m3_offline_e"
  | "m3_offline_f";

export type Sense = "sight" | "hearing" | "smell" | "taste" | "touch";

export const SENSE_NAMES: Record<Sense, string> = {
  sight: "시각",
  hearing: "청각",
  smell: "후각",
  taste: "미각",
  touch: "촉각",
};

export type Zone = 1 | 2 | 3;

export type Mission = {
  id: MissionId;
  zone: Zone;
  codename: string;
  title: string;
  brief: string;
  /** 이 미션들을 먼저 깨야 열린다 */
  requires: MissionId[];
  /** 이 날짜(한국 시간, YYYY-MM-DD)부터 열린다 */
  opensOn?: string;
  /** 이 미션에서 깨우는 감각 (엔딩에서 '내가 깨운 감각'으로 보여 줄 것) */
  senses?: Sense[];
  /** 실제 미션 화면이 만들어졌는지 (아직이면 '준비 중' 화면) */
  ready: boolean;
};

/** D-Day 원데이 클래스 날짜 (모든 요원이 벙커에 모이는 날) */
export const D_DAY = "2026-12-10";
/** 화면에 보이는 D-Day: "12/10", "12월 10일" */
export const D_DAY_MD = `${Number(D_DAY.slice(5, 7))}/${Number(D_DAY.slice(8))}`;
export const D_DAY_KO = `${Number(D_DAY.slice(5, 7))}월 ${Number(D_DAY.slice(8))}일`;

export const MISSIONS: Mission[] = [
  {
    id: "m0_daily",
    zone: 1,
    codename: "ORDER 00",
    title: "평범지령",
    brief: "하늘 보기, 물 한 컵… 오늘의 평범한 일 하나로 적의 눈을 속여라.",
    requires: [],
    ready: true,
  },
  {
    id: "m1_breathing",
    zone: 2,
    codename: "MISSION 01",
    title: "스트레스 시한폭탄",
    brief: "가방 속 시한폭탄. 본부의 호흡 신호에 맞춰 숨을 쉬어 해체하라.",
    requires: ["m0_daily"],
    ready: true,
  },
  {
    id: "m2_mirror",
    zone: 2,
    codename: "MISSION 02",
    title: "진실의 거울 방",
    brief: "떠오르는 의심의 말들을 휴지통에 던지고, 나를 지키는 암호를 새겨라.",
    requires: ["m1_breathing"],
    ready: true,
  },
  {
    id: "m3_offline_walk",
    zone: 3,
    codename: "BUNKER A",
    title: "침묵의 복도",
    brief: "발바닥 감각에만 집중해 암흑 구역을 통과하라.",
    requires: [],
    opensOn: D_DAY,
    senses: ["touch"],
    ready: false,
  },
  {
    id: "m3_offline_bowl",
    zone: 3,
    codename: "BUNKER B",
    title: "주파수 동기화",
    brief: "싱잉볼 소리에 맞춰 일그러진 파동을 만다라로 맞춰라.",
    requires: [],
    opensOn: D_DAY,
    senses: ["hearing"],
    ready: false,
  },
  {
    id: "m3_offline_tea",
    zone: 3,
    codename: "BUNKER C",
    title: "비밀 해독제 배합",
    brief: "향과 맛으로 나만의 안정 비율을 찾아라.",
    requires: [],
    opensOn: D_DAY,
    senses: ["smell", "taste"],
    ready: false,
  },
  {
    id: "m3_offline_stone",
    zone: 3,
    codename: "BUNKER D",
    title: "돌연변이 봉인",
    brief: "걱정을 먹고 자라는 투명 괴물을 걱정돌 안에 봉인하라.",
    requires: [],
    opensOn: D_DAY,
    senses: ["touch"],
    ready: false,
  },
  // TODO: 다섯째·여섯째 부스 이름이 정해지면 바꾼다
  {
    id: "m3_offline_e",
    zone: 3,
    codename: "BUNKER E",
    title: "다섯째 벙커",
    brief: "부스 이름과 미션이 아직 정해지지 않았어요.",
    requires: [],
    opensOn: D_DAY,
    ready: false,
  },
  {
    id: "m3_offline_f",
    zone: 3,
    codename: "BUNKER F",
    title: "여섯째 벙커",
    brief: "부스 이름과 미션이 아직 정해지지 않았어요.",
    requires: [],
    opensOn: D_DAY,
    ready: false,
  },
];

/**
 * 구역별 목표. 목표까지만 '색채 복구'에 들어가고, 넘는 만큼은 보너스 조각.
 * 부스는 학생마다 6곳 중 2~3곳만 돌 수 있으므로 2곳이면 구역 완료.
 */
export const ZONES: Record<Zone, { name: string; goal: number; rule: string }> = {
  1: { name: "제1구역 · 일상의 위장술", goal: 1, rule: "평범지령 하나만 해도 구역 완료 · 더 할수록 늘곰의 암호 지령이 풀려요" },
  2: { name: "제2구역 · 멘탈 시뮬레이션실", goal: 2, rule: "함정 2개를 모두 돌파하면 구역 완료" },
  3: { name: "제3구역 · 감각 탈환 작전", goal: 2, rule: "벙커 6곳 중 2곳만 탈환해도 구역 완료 · 더 들르면 보너스 조각" },
};

export type Progress = {
  /** 목표 안에서 모은 조각 */
  counted: number;
  /** 전체 목표 조각 수 */
  goal: number;
  /** 목표를 넘겨 모은 보너스 조각 */
  bonus: number;
  /** 색채 복구율 0~1 */
  ratio: number;
};

export function progressOf(cleared: readonly string[]): Progress {
  let counted = 0;
  let bonus = 0;
  let goal = 0;
  for (const zone of Object.keys(ZONES).map(Number) as Zone[]) {
    const done = MISSIONS.filter((m) => m.zone === zone && cleared.includes(m.id)).length;
    const g = ZONES[zone].goal;
    counted += Math.min(done, g);
    bonus += Math.max(0, done - g);
    goal += g;
  }
  return { counted, goal, bonus, ratio: goal ? counted / goal : 0 };
}

/** 지금까지 깨운 감각 (평범지령·부스마다 다르므로 엔딩에서 개인별로 보여 준다) */
export function sensesOf(cleared: readonly string[], dailyDone: readonly string[] = []): Sense[] {
  const set = new Set<Sense>();
  for (const d of DAILY_ORDERS) if (dailyDone.includes(d.id)) set.add(d.sense);
  for (const m of MISSIONS) if (cleared.includes(m.id)) m.senses?.forEach((s) => set.add(s));
  return [...set];
}

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** 한국 시간 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayKST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

export type LockState = { locked: false } | { locked: true; reason: string };

export function lockState(mission: Mission, cleared: readonly string[], today = todayKST()): LockState {
  if (mission.opensOn && today < mission.opensOn) {
    const [, m, d] = mission.opensOn.split("-").map(Number);
    return { locked: true, reason: `${m}/${d} D-Day 개방` };
  }
  const missing = mission.requires.filter((r) => !cleared.includes(r));
  if (missing.length > 0) {
    const prev = getMission(missing[0]);
    return { locked: true, reason: `${prev?.title ?? "이전 미션"} 해결 후 개방` };
  }
  return { locked: false };
}
