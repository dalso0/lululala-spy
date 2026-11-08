import type { NextConfig } from "next";

// GitHub Pages 같은 정적 호스팅에 그대로 올릴 수 있게 정적 내보내기(out/ 폴더)로 빌드한다.
// 하위 경로에 올릴 때는 NEXT_PUBLIC_BASE_PATH=/저장소이름 을 지정한다.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
