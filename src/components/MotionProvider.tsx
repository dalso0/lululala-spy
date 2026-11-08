"use client";

import { MotionConfig } from "framer-motion";

/** '동작 줄이기'를 켠 기기에서는 움직임(이동·확대)을 빼고 투명도 변화만 남긴다. 호흡 원처럼 꼭 필요한 움직임은 따로 처리. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
