"use client";

import { motion, type MotionValue } from "framer-motion";

type Props = {
  src: string;
  /** 원본 그림 크기 (px) */
  imgW: number;
  imgH: number;
  /** 오려 낼 원의 중심과 반지름 (원본 그림 px) */
  x: number;
  y: number;
  r: number;
  /** 0이면 원판 전체, 0~1이면 가운데를 비운 고리만 (예: 0.66 → 자물쇠는 그대로, 톱니만 돈다) */
  hole?: number;
  rotate?: MotionValue<number>;
};

/**
 * 2.5D 트릭: 그림 속 톱니바퀴를 같은 그림에서 동그랗게 오려 내 제자리에 겹친 뒤 돌린다.
 * 회전 0일 때는 원래 그림과 똑같아서 보이지 않다가, 돌기 시작하면 그림 속 톱니가 움직이는 것처럼 보인다.
 */
export function ImageCutout({ src, imgW, imgH, x, y, r, hole = 0, rotate }: Props) {
  const d = r * 2;
  const mask = hole > 0 ? `radial-gradient(circle closest-side, transparent ${hole * 100}%, #000 ${hole * 100 + 2}%)` : undefined;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: `${((x - r) / imgW) * 100}%`,
        top: `${((y - r) / imgH) * 100}%`,
        width: `${(d / imgW) * 100}%`,
        height: `${(d / imgH) * 100}%`,
        backgroundImage: `url(${src})`,
        backgroundSize: `${(imgW / d) * 100}% ${(imgH / d) * 100}%`,
        backgroundPosition: `${((x - r) / (imgW - d)) * 100}% ${((y - r) / (imgH - d)) * 100}%`,
        clipPath: "circle(50%)",
        maskImage: mask,
        WebkitMaskImage: mask,
        rotate,
      }}
    />
  );
}
