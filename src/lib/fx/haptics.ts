// 손맛(진동). 안드로이드는 Vibrate API 로 패턴까지, 아이폰은 공식 진동 기능이 없어서
// iOS 18 사파리의 '스위치 토글 햅틱'을 빌려 짧게 한 번 톡 울린다(구형 iOS 는 조용히 넘어감).

export type HapticKind = "tap" | "tick" | "select" | "thunk" | "heavy" | "success" | "error" | "unlock";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 7,
  tick: 4,
  select: 12,
  thunk: 28,
  heavy: 45,
  success: [16, 40, 24, 40, 70],
  error: [50, 40, 50],
  unlock: [8, 28, 8, 28, 42],
};

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/** iOS 18+: 숨겨 둔 '스위치' 체크박스를 토글하면 시스템이 햅틱을 낸다 */
function iosTick() {
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

export function haptic(kind: HapticKind) {
  if (typeof navigator === "undefined") return;
  // 브라우저는 사용자가 한 번이라도 화면을 터치한 뒤에만 진동을 허락한다 (그 전엔 조용히 넘어감)
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(PATTERNS[kind]);
    } else if (isIOS() && kind !== "tick") {
      iosTick();
    }
  } catch {
    /* 진동이 막힌 브라우저 */
  }
}
