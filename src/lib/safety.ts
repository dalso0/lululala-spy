// 학생 글에 위기 신호가 보이면: 학생에게는 바로 도움 연락처를 보여 주고,
// 선생님 검토 화면에는 '주의' 표시를 붙인다. (글을 막지는 않는다)

const CARE_WORDS = [
  "죽고싶", "죽고싶다", "죽어버리", "죽을래", "자살", "자해", "사라지고싶", "없어지고싶",
  "살기싫", "살고싶지않", "살아서뭐해", "뛰어내리", "목매", "손목긋", "극단적선택",
];

/** 띄어쓰기를 무시하고 위기 표현이 들어 있는지 본다 */
export function needsCare(text: string): boolean {
  const t = text.replace(/\s+/g, "");
  return CARE_WORDS.some((w) => t.includes(w));
}

export const HELP_LINES = [
  { name: "자살예방 상담전화", tel: "109", note: "24시간" },
  { name: "청소년 상담", tel: "1388", note: "24시간 · 문자 #1388" },
  { name: "학교 Wee클래스", tel: null, note: "상담 선생님께 직접" },
] as const;
