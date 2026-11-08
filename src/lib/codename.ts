// 요원명 · 복구 코드 만들기. 이름·학번 같은 개인정보 없이 '나'를 구분하는 장치.

const ADJECTIVES = [
  "수상한", "은밀한", "느긋한", "반짝이는", "용감한", "조용한", "날쌘", "포근한",
  "씩씩한", "엉뚱한", "단단한", "말랑한", "상냥한", "재빠른", "신중한", "명랑한",
  "푸른", "노란", "하얀", "보랏빛", "새벽의", "한밤의", "구름 위의", "바람 같은",
];

const ANIMALS = [
  "수달", "고양이", "다람쥐", "펭귄", "부엉이", "여우", "고슴도치", "너구리",
  "판다", "해달", "거북이", "돌고래", "참새", "두더지", "알파카", "코알라",
  "미어캣", "라쿤", "햄스터", "토끼", "사슴", "오리", "카멜레온", "고래",
];

function hash(text: string, seed = 2166136261): number {
  let h = seed;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 요원 ID → 4자리 꼬리표 (예: 4CC4). 같은 이름의 요원을 구분한다 */
export function agentTag(spyId: string): string {
  return hash(spyId).toString(16).toUpperCase().padStart(8, "0").slice(0, 4);
}

/** 요원 ID → 무작위처럼 보이는 요원명 (예: "수상한 수달 #4CC4"). 같은 ID면 늘 같은 이름 */
export function makeCodename(spyId: string): string {
  const adj = ADJECTIVES[hash(spyId, 0x9e3779b9) % ADJECTIVES.length];
  const animal = ANIMALS[hash(spyId, 0x85ebca6b) % ANIMALS.length];
  return `${adj} ${animal} #${agentTag(spyId)}`;
}

/* ───── 복구 코드: 폰을 바꾸거나 기록이 지워졌을 때 같은 요원으로 돌아오는 열쇠 ───── */

// 헷갈리는 글자(0/O, 1/I/L)는 뺐다
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function makeRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** 사용자가 친 코드를 정리: 대문자로, 하이픈·공백 제거 */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidRecoveryCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}

/** 화면 표시용: K7Q4MZ2P → K7Q4-MZ2P */
export function formatRecoveryCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
