// 홍보 영상에 쓸 그림을 public/ 으로 모은다 (원본은 앱과 늘곰 그림 폴더).
//   node scripts/prepare.cjs
//  - 본부 파노라마: 앱 타일(public/art/pano)을 이어 붙여 장면별로 잘라 JPEG 로
//  - 시한폭탄 · 장치 가방 그림, 늘곰 공식 포즈(배경 없는 PNG)

const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const APP = path.join(__dirname, "..", "..");
const OUT = path.join(__dirname, "..", "public");
const POSES = path.join(APP, "..", "neulgom-media", "poses-new");
const POSE_NAMES = ["phone", "hooray", "binoc", "headphone", "mag", "wave", "stamp", "f1", "crossed", "lookr"];

// 파노라마에서 잘라 낼 곳 (파노라마 px)
const CROPS = {
  "pano-desk": { x: -300, w: 2700 }, // 해독 선반 끝 + 작전 책상 + 메모 + 무전기 + 톱니
  "pano-door": { x: 3900, w: 1800 }, // 감시 모니터 + 탈출 문 + 배관
  "pano-wide": { x: 0, w: 0, scale: 0.5 }, // 한 바퀴 전체 (흐린 배경용)
};

(async () => {
  fs.mkdirSync(path.join(OUT, "art"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "neulgom"), { recursive: true });
  for (const f of ["bomb.webp", "case.webp"]) fs.copyFileSync(path.join(APP, "public", "art", f), path.join(OUT, "art", f));
  // 다른 모델이 만든 시네마틱 영상(교실 복도 경보 · 인형 늘곰 · 키링 태그) — 화질이 좋아서 앞뒤에 쓴다
  fs.mkdirSync(path.join(OUT, "footage"), { recursive: true });
  fs.copyFileSync(path.join(APP, "video7.mp4"), path.join(OUT, "footage", "v7.mp4"));
  for (const n of POSE_NAMES) fs.copyFileSync(path.join(POSES, `${n}.png`), path.join(OUT, "neulgom", `${n}.png`));

  const manifest = JSON.parse(fs.readFileSync(path.join(APP, "public", "art", "pano", "manifest.json"), "utf8"));
  const tiles = Array.from({ length: manifest.tiles }, (_, i) => "data:image/webp;base64," + fs.readFileSync(path.join(APP, "public", "art", "pano", `${i}.webp`)).toString("base64"));
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  const out = await page.evaluate(
    async ({ tiles, W, H, T, CROPS }) => {
      const ims = await Promise.all(tiles.map((s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; })));
      const full = document.createElement("canvas");
      full.width = W;
      full.height = H;
      const g = full.getContext("2d");
      ims.forEach((im, i) => g.drawImage(im, i * T, 0));
      const res = {};
      for (const [name, c] of Object.entries(CROPS)) {
        const k = c.scale || 1;
        const w = c.w || W;
        const cv = document.createElement("canvas");
        cv.width = Math.round(w * k);
        cv.height = Math.round(H * k);
        const cg = cv.getContext("2d");
        cg.imageSmoothingQuality = "high";
        // 고리라서 왼쪽 끝을 넘으면 오른쪽 끝에서 가져온다
        for (const off of [-W, 0, W]) cg.drawImage(full, (off - c.x) * k, 0, W * k, H * k);
        res[name] = cv.toDataURL("image/jpeg", 0.93);
      }
      return res;
    },
    { tiles, W: manifest.w, H: manifest.h, T: manifest.tile, CROPS },
  );
  for (const [name, url] of Object.entries(out)) fs.writeFileSync(path.join(OUT, "art", `${name}.jpg`), Buffer.from(url.split(",")[1], "base64"));
  await browser.close();
  console.log("그림 준비 끝:", fs.readdirSync(path.join(OUT, "art")).join(", "), "· 늘곰", POSE_NAMES.length, "장");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
