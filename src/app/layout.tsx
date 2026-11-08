import type { Metadata, Viewport } from "next";
import { Gaegu, Gowun_Dodum, Nanum_Gothic_Coding } from "next/font/google";
import { FxRoot } from "@/components/fx/FxRoot";
import { MotionProvider } from "@/components/MotionProvider";
import "./globals.css";

const dodum = Gowun_Dodum({ weight: "400", subsets: ["latin"], variable: "--font-dodum", preload: false });
const gaegu = Gaegu({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-gaegu", preload: false });
const coding = Nanum_Gothic_Coding({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-coding", preload: false });

export const metadata: Metadata = {
  title: "평범한 스파이",
  description: "작전명: 회색 안개 통제 구역 — 전설의 요원 늘곰 구출 작전",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0e10",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${dodum.variable} ${gaegu.variable} ${coding.variable} h-full antialiased`}>
      <body className="min-h-dvh">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
          <MotionProvider>{children}</MotionProvider>
          <FxRoot />
        </div>
      </body>
    </html>
  );
}
