// 제1구역 평범지령: 일상의 평범한 감각을 하나씩 깨우는 튜토리얼.
// 하나라도 해내면 첫 픽셀 조각, 할수록 방화벽이 뚫리고 수장 늘곰의 암호 지령이 한 줄씩 해독된다.

import type { Sense } from "./missions";

export type DailyOrder = {
  id: string;
  title: string;
  hint: string;
  sense: Sense;
};

export const DAILY_ORDERS: DailyOrder[] = [
  { id: "sky", title: "하늘 사진 한 장 찍기", hint: "오늘 하늘은 무슨 색이었나요? (사진은 폰에만 간직)", sense: "sight" },
  { id: "water", title: "물 한 컵 천천히 마시기", hint: "목을 넘어가는 시원함에 집중", sense: "taste" },
  { id: "newroute", title: "낯선 길로 하교하기", hint: "처음 보는 간판 하나 찾기", sense: "touch" },
  { id: "song", title: "좋아하는 노래 한 곡 끝까지 듣기", hint: "딴짓 없이 처음부터 끝까지", sense: "hearing" },
  { id: "meal", title: "밥 한 숟가락 크게 먹고 맛 느끼기", hint: "꼭꼭 씹으며 맛 세 가지 찾기", sense: "taste" },
  { id: "air", title: "창문 열고 바깥 냄새 맡기", hint: "비 냄새? 풀 냄새? 급식 냄새?", sense: "smell" },
];

/** 평범지령을 하나 해낼 때마다 한 줄씩 풀리는 수장 늘곰의 암호 지령 (뒤 구역의 단서가 숨어 있다) */
export const CIPHER_LINES = [
  "…여기는 늘곰. 요원에게 지령을 전한다…",
  "…회색 안개는 마음속 잡음을 먹고 자란다…",
  "…가방 속 폭탄… 숨을 고르면 멈춘다…",
  "…거울을 조심해. 의심의 말에 속지 마라…",
  "…주파수… 맑은 소리에 맞춰야 헬기가 온다…",
  "…돌연변이… 걱정은 돌 속에 가둬라. 연구소에서 기다리겠다.",
];

const VALID = new Set(DAILY_ORDERS.map((d) => d.id));
export const isDailyOrderId = (id: string) => VALID.has(id);
