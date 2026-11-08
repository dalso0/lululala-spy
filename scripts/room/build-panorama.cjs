// 360° 본부 파노라마 만들기
//   node scripts/room/build-panorama.cjs [영상] [조각]
//   예) node scripts/room/build-panorama.cjs video2.mp4 "8.8-8.09,1.7-4.98,7.95-5.7"
//
// 본부를 도는 영상의 '가운데 세로 띠'를 프레임마다 이어 붙여(slit-scan) 끝과 처음이 이어지는 긴 파노라마 한 장을 만든다.
// AI 영상은 한 바퀴를 그대로 돌지 않아서(중간에 장면이 끊기고 반대로 돈다) 쓸 구간을 '조각'으로 적어 준다.
//  - 조각 "a-b": a초 → b초. a > b 면 시간을 거꾸로 쓴다. 어느 쪽이든 화면 내용이 왼쪽으로 흘러야(카메라가 오른쪽으로 돌아야) 한다.
//  - 조각은 적은 순서대로 오른쪽으로 이어지고, 마지막 조각은 첫 조각으로 돌아온다(고리).
//  - 맞닿는 두 장면이 같은 물건을 보고 있으면 그 물건이 겹치도록 맞추고, 아니면 좁게 섞기만 한다.
//
// video2.mp4 (720×1280, 10초): 0.4~4.98초 오른쪽으로 돌고(처음 1.6초는 화면에 글씨가 있음) → 장면이 끊기고 →
// 5~8.8초 왼쪽으로 돌아 책상에서 멈춘다. 그래서 고리를 이렇게 만든다.
//   [책상 → 무전기 (8.8→8.09초)] + [무전기 → 톱니 → 창문 → 제어판 → 모니터 → 탈출 문 → 배관 (1.7→4.98초)]
//   + [창문 → 책장 → 지도 → 해독 선반 (7.95→5.7초)] → 다시 책상
// 무전기는 두 구간 모두에 나와서 그 자리를 맞춰 잇는다. 7.98초에 화면이 튀는 곳이 있어 그 앞뒤로 조각을 나눴다.
//
// 맥에 설치된 Google Chrome 을 쓴다(다른 경로면 CHROME=...). OUT=폴더 로 내보낼 곳을 바꾸고,
// DEBUG_OUT=폴더 를 주면 한 장짜리 확인용 그림(pano-full.jpg)도 쓴다.

const { chromium } = require("playwright-core");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VIDEO = path.resolve(process.argv[2] || "video2.mp4");
const PIECES = (process.argv[3] || "8.8-8.09,1.7-4.98,7.95-5.7").split(",").map((p) => {
  const [a, b] = p.split("-").map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) throw new Error("조각 형식이 틀렸습니다: " + p);
  return { a, b };
});
const OUT = path.resolve(process.env.OUT || "public/art/pano");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// px 값은 높이 720px 영상 기준. 더 큰 영상이면 높이 비율(K)대로 키운다.
const OPT = {
  fps: 30, // 초당 몇 장을 잴지
  measure: [0.12, 0.88], // 움직임을 잴 때 쓰는 높이 (위아래 글씨를 피한다)
  feather: 14, // 띠 사이를 부드럽게 겹치는 폭
  endExtra: 300, // 조각 끝에서 가운데 띠 바깥으로 더 쓰는 폭 (영상 폭의 절반을 넘지 않게 줄어든다)
  blend: 90, // 같은 물건으로 맞춘 이음매를 섞는 폭
  cut: 45, // 서로 다른 장면이 맞닿는 이음매를 섞는 폭 (좁게: 겹친 두 장면이 비쳐 보이지 않게)
  tile: 1024,
  quality: 0.86,
  sharpen: 0.4,
};

/** b 가 a 보다 내용이 왼쪽으로 s 만큼 움직였을 때 b[x - s] ≈ a[x]. 정규화한 닮은 정도(c)도 돌려준다 */
function shiftBetween(a, b, maxS, margin, minOverlap = 0) {
  const scores = new Map();
  let best = 0;
  let bestScore = -Infinity;
  for (let s = -maxS; s <= maxS; s++) {
    let num = 0;
    let na = 0;
    let nb = 0;
    let cnt = 0;
    for (let x = margin; x < a.length - margin; x++) {
      const xb = x - s;
      if (xb < margin || xb >= b.length - margin) continue;
      num += a[x] * b[xb];
      na += a[x] * a[x];
      nb += b[xb] * b[xb];
      cnt++;
    }
    if (cnt < minOverlap) continue;
    const sc = num / Math.sqrt(na * nb + 1e-9);
    scores.set(s, sc);
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  const l = scores.get(best - 1);
  const r = scores.get(best + 1);
  let sub = 0;
  if (l !== undefined && r !== undefined) {
    const den = l - 2 * bestScore + r;
    if (den < 0) sub = (0.5 * (l - r)) / den;
  }
  return { s: best + sub, c: bestScore };
}

(async () => {
  if (!fs.existsSync(VIDEO)) throw new Error("영상이 없습니다: " + VIDEO);
  const server = http
    .createServer((req, res) => {
      if (!req.url.startsWith("/v.mp4")) {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end('<video id=v src="/v.mp4" muted playsinline preload=auto></video>');
      }
      const stat = fs.statSync(VIDEO);
      const range = req.headers.range;
      if (range) {
        const [s, e] = range.replace("bytes=", "").split("-");
        const start = +s;
        const end = e ? +e : stat.size - 1;
        res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Content-Type": "video/mp4" });
        fs.createReadStream(VIDEO, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { "Content-Length": stat.size, "Content-Type": "video/mp4" });
        fs.createReadStream(VIDEO).pipe(res);
      }
    })
    .listen(0);
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);

  // 1) 프레임마다 세로 띠 밝기 변화(열 기울기)를 모은다
  console.log("1/4 프레임 분석 중…");
  const info = await page.evaluate(async ({ fps, measure }) => {
    const v = document.getElementById("v");
    for (let i = 0; i < 300 && v.readyState < 2; i++) await new Promise((r) => setTimeout(r, 100));
    const W = v.videoWidth;
    const H = v.videoHeight;
    const y0 = Math.round(H * measure[0]);
    const y1 = Math.round(H * measure[1]);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    const seek = (t) => new Promise((r) => { v.onseeked = r; v.currentTime = t; });
    const n = Math.floor(v.duration * fps);
    const times = [];
    const profiles = [];
    for (let i = 0; i < n; i++) {
      const t = Math.min(v.duration - 0.02, (i + 0.5) / fps);
      await seek(t);
      g.drawImage(v, 0, 0);
      const d = g.getImageData(0, y0, W, y1 - y0).data;
      const col = new Float32Array(W);
      for (let y = 0; y < y1 - y0; y++) {
        const row = y * W * 4;
        for (let x = 0; x < W; x++) {
          const k = row + x * 4;
          col[x] += d[k] + d[k + 1] + d[k + 2];
        }
      }
      const grad = new Array(W).fill(0);
      for (let x = 1; x < W; x++) grad[x] = col[x] - col[x - 1];
      times.push(t);
      profiles.push(grad);
    }
    return { W, H, duration: v.duration, times, profiles };
  }, OPT);

  const { times, profiles, W: FW, H: FH } = info;
  const K = FH / 720;
  const C = FW / 2;
  const E = Math.min(Math.round(OPT.endExtra * K), Math.floor(C - 10));
  const R = Math.round(OPT.blend * K);
  const Rc = Math.round(OPT.cut * K);
  const P = { ...OPT, E, feather: Math.round(OPT.feather * K) };
  console.log(`  영상 ${FW}×${FH} · ${info.duration.toFixed(1)}초 · 프레임 ${times.length}장`);
  const maxS = Math.round(Math.min(90 * K, FW * 0.3));
  const margin = Math.round(FW * 0.15);
  const d = [];
  for (let i = 0; i + 1 < profiles.length; i++) d.push(shiftBetween(profiles[i], profiles[i + 1], maxS, margin).s);

  // 2) 조각마다 쓸 프레임과 프레임 사이 이동량
  const pieces = PIECES.map(({ a, b }) => {
    const lo = Math.min(a, b) - 1e-3;
    const hi = Math.max(a, b) + 1e-3;
    const idx = times.map((t, i) => [t, i]).filter(([t]) => t >= lo && t <= hi).map(([, i]) => i);
    const frames = a < b ? idx : idx.reverse();
    const steps = frames.slice(0, -1).map((i) => Math.max(0, a < b ? d[i] : -d[i - 1]));
    const back = frames.slice(0, -1).filter((i) => (a < b ? d[i] : -d[i - 1]) < -2).length;
    const width = steps.reduce((x, y) => x + y, 0);
    console.log(`  조각 ${a}→${b}초: 프레임 ${frames.length}장 · 폭 ${Math.round(width)}px${back ? ` · 거꾸로 움직인 프레임 ${back}장(조각 방향 확인)` : ""}`);
    return { a, b, frames, steps };
  });
  if (pieces.some((p) => p.frames.length < 2)) throw new Error("프레임이 너무 적은 조각이 있습니다");

  console.log("2/4 이어 붙이는 중…");
  const result = await page.evaluate(
    async ({ P, R, Rc, pieces, times, FW, FH }) => {
      const v = document.getElementById("v");
      const seek = (t) => new Promise((r) => { v.onseeked = r; v.currentTime = t; });
      const H = FH;
      const C = FW / 2;
      const E = P.E;
      const frame = document.createElement("canvas");
      frame.width = FW;
      frame.height = H;
      const fg = frame.getContext("2d");

      // 조각 하나: 프레임마다 가운데 띠를 이동량만큼 옆으로 이어 붙인다
      const buildPiece = async (frames, steps) => {
        const X = [0];
        for (const s of steps) X.push(X[X.length - 1] + s);
        const L = Math.ceil(X[X.length - 1] + 2 * E);
        const seg = document.createElement("canvas");
        seg.width = L;
        seg.height = H;
        const sg = seg.getContext("2d");
        for (let k = 0; k < frames.length; k++) {
          const w = k < steps.length ? steps[k] : 0;
          const first = k === 0;
          const last = k === frames.length - 1;
          if (!first && !last && w < 0.5) continue; // 카메라가 멈춘(같은) 프레임
          await seek(times[frames[k]]);
          fg.drawImage(v, 0, 0, FW, H);
          const srcL = first ? C - E : C - P.feather;
          const srcR = last ? C + E : C + w;
          const sw = srcR - srcL;
          const strip = document.createElement("canvas");
          strip.width = Math.ceil(sw);
          strip.height = H;
          const tg = strip.getContext("2d");
          tg.drawImage(frame, srcL, 0, sw, H, 0, 0, sw, H);
          if (!first) {
            // 왼쪽 가장자리를 부드럽게. destination-in 은 칠한 곳 바깥을 지우므로 띠 전체를 그라데이션 한 번으로 칠한다
            const grad = tg.createLinearGradient(0, 0, strip.width, 0);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(Math.min(1, P.feather / strip.width), "rgba(0,0,0,1)");
            grad.addColorStop(1, "rgba(0,0,0,1)");
            tg.globalCompositeOperation = "destination-in";
            tg.fillStyle = grad;
            tg.fillRect(0, 0, strip.width, H);
          }
          sg.drawImage(strip, X[k] + E + (srcL - C), 0);
        }
        return { seg, L };
      };

      const built = [];
      for (const p of pieces) built.push(await buildPiece(p.frames, p.steps));

      // 맞닿는 곳: 앞 조각의 끝과 뒷 조각의 처음을 겹쳐 보며(1/4 크기 · 윤곽끼리 비교) 가장 잘 맞는 겹침 폭 F 를 찾는다.
      // 같은 물건이 보이면(닮음이 높으면) 그 폭으로 맞추고, 아니면 좁게(Rc) 섞기만 한다
      const SC = 0.25;
      const edges = (src, sx, sw) => {
        const w = Math.max(3, Math.round(sw * SC));
        const h = Math.round(H * SC);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(src, sx, 0, sw, H, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data;
        const lum = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
        const e = new Float32Array(w * h);
        for (let y = 1; y < h - 1; y++)
          for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            e[i] = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + w] - lum[i - w]);
          }
        return { e, w, h };
      };
      const seams = built.map((prev, j) => {
        const next = built[(j + 1) % built.length];
        const maxF = Math.min(Math.round(2.6 * E), prev.L - 40, next.L - 40);
        const A = edges(prev.seg, prev.L - maxF, maxF);
        const B = edges(next.seg, 0, maxF);
        let best = { F: R, c: -1, dy: 0 };
        for (let f = Math.round(0.55 * E * SC); f <= Math.min(A.w, B.w) - 2; f++)
          for (let dy = -3; dy <= 3; dy++) {
            let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
            for (let y = 4; y < A.h - 4; y++) {
              const ra = y * A.w + (A.w - f);
              const rb = (y + dy) * B.w;
              for (let x = 1; x < f - 1; x++) {
                const va = A.e[ra + x];
                const vb = B.e[rb + x];
                sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb; n++;
              }
            }
            const ma = sa / n;
            const mb = sb / n;
            const c = (sab / n - ma * mb) / Math.sqrt((saa / n - ma * ma) * (sbb / n - mb * mb) + 1e-6);
            if (c > best.c) best = { F: Math.round(f / SC), c, dy: Math.round(dy / SC) };
          }
        const aligned = best.c >= 0.5;
        return aligned ? { F: best.F, R: Math.min(R, Math.round(best.F / 2)), aligned, c: best.c, dy: best.dy } : { F: Rc, R: Rc, aligned, c: best.c, dy: best.dy };
      });

      // 조각 위치: 앞 조각과 F 만큼 겹친다. 마지막 조각의 끝 F 는 맨 앞으로 돌아와 첫 조각과 겹친다(고리)
      const xs = [0];
      for (let k = 1; k < built.length; k++) xs.push(xs[k - 1] + built[k - 1].L - seams[k - 1].F);
      const last = built.length - 1;
      const W = xs[last] + built[last].L - seams[last].F;
      const out = document.createElement("canvas");
      out.width = W;
      out.height = H;
      const og = out.getContext("2d");

      // src 의 [sx, sx+sw) 를 dx 에 그리되, 겹치는 폭 F 안 가운데 R 동안 0→1 (fadeIn) 또는 1→0 으로 바뀌는 투명도
      const drawFaded = (src, sx, sw, dx, F, R, fadeIn) => {
        const t = document.createElement("canvas");
        t.width = sw;
        t.height = H;
        const tg = t.getContext("2d");
        tg.drawImage(src, sx, 0, sw, H, 0, 0, sw, H);
        const a = (F - R) / 2;
        const lo = fadeIn ? 0 : 1;
        const hi = fadeIn ? 1 : 0;
        const grad = tg.createLinearGradient(0, 0, sw, 0);
        grad.addColorStop(0, `rgba(0,0,0,${lo})`);
        grad.addColorStop(Math.min(1, a / sw), `rgba(0,0,0,${lo})`);
        grad.addColorStop(Math.min(1, (a + R) / sw), `rgba(0,0,0,${hi})`);
        grad.addColorStop(1, `rgba(0,0,0,${hi})`);
        tg.globalCompositeOperation = "destination-in";
        tg.fillStyle = grad;
        tg.fillRect(0, 0, sw, H);
        og.drawImage(t, dx, 0);
      };
      og.drawImage(built[0].seg, 0, 0);
      for (let k = 1; k < built.length; k++) {
        const keep = k === last ? built[k].L - seams[last].F : built[k].L;
        drawFaded(built[k].seg, 0, keep, xs[k], seams[k - 1].F, seams[k - 1].R, true);
      }
      drawFaded(built[last].seg, built[last].L - seams[last].F, seams[last].F, 0, seams[last].F, seams[last].R, false);

      // 4) 살짝 선명하게(언샤프 마스크) 다듬으며 타일로 자른다. 고리라서 양 끝은 반대편을 이어 붙여 계산한다
      const PAD = 4;
      const tiles = [];
      for (let x = 0; x < W; x += P.tile) {
        const tw = Math.min(P.tile, W - x);
        const t = document.createElement("canvas");
        t.width = tw + 2 * PAD;
        t.height = H + 2 * PAD;
        const tg = t.getContext("2d", { willReadFrequently: true });
        for (const off of [-W, 0, W]) tg.drawImage(out, off - (x - PAD), PAD);
        tg.drawImage(t, 0, PAD, t.width, 1, 0, 0, t.width, PAD); // 위아래 가장자리는 맨 끝 줄을 늘려 채운다
        tg.drawImage(t, 0, PAD + H - 1, t.width, 1, 0, PAD + H, t.width, PAD);
        const b = document.createElement("canvas");
        b.width = t.width;
        b.height = t.height;
        const bg = b.getContext("2d", { willReadFrequently: true });
        bg.filter = "blur(1px)";
        bg.drawImage(t, 0, 0);
        const img = tg.getImageData(0, 0, t.width, t.height);
        const bl = bg.getImageData(0, 0, t.width, t.height).data;
        const px = img.data;
        for (let i = 0; i < px.length; i += 4)
          for (let ch = 0; ch < 3; ch++) px[i + ch] = px[i + ch] + P.sharpen * (px[i + ch] - bl[i + ch]);
        tg.putImageData(img, 0, 0);
        const f = document.createElement("canvas");
        f.width = tw;
        f.height = H;
        f.getContext("2d").drawImage(t, PAD, PAD, tw, H, 0, 0, tw, H);
        tiles.push(f.toDataURL("image/webp", P.quality));
      }
      const pw = Math.round(W / 8);
      const ph = Math.round(H / 8);
      const p = document.createElement("canvas");
      p.width = pw;
      p.height = ph;
      const pg = p.getContext("2d");
      pg.imageSmoothingQuality = "high";
      pg.drawImage(out, 0, 0, pw, ph);
      const preview = p.toDataURL("image/webp", 0.7);
      const full = out.toDataURL("image/jpeg", 0.85); // 확인용 (저장소에는 안 올림)
      return { W, H, tiles, preview, full, seams: xs, seamInfo: seams };
    },
    { P, R, Rc, pieces, times, FW, FH },
  );

  result.seamInfo.forEach((m, j) => {
    const p = pieces[j];
    const q = pieces[(j + 1) % pieces.length];
    console.log(`  이음매 ${j + 1} (${p.a}→${p.b}초 끝 ↔ ${q.a}→${q.b}초 처음): 닮음 ${m.c.toFixed(2)}${m.dy ? ` · 위아래 ${m.dy}px 어긋남` : ""} → ${m.aligned ? `물건을 맞춰 ${m.F}px 겹침` : "좁게 섞기"}`);
  });
  console.log("3/4 타일 저장 중…");
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  let bytes = 0;
  result.tiles.forEach((u, i) => {
    const buf = Buffer.from(u.split(",")[1], "base64");
    bytes += buf.length;
    fs.writeFileSync(path.join(OUT, `${i}.webp`), buf);
  });
  const pv = Buffer.from(result.preview.split(",")[1], "base64");
  fs.writeFileSync(path.join(OUT, "preview.webp"), pv);
  // 그림이 바뀌면 주소도 바뀌게(?v=) — 폰에 남아 있는 예전 타일이 섞이지 않도록
  const hash = crypto.createHash("sha1");
  for (const u of [...result.tiles, result.preview]) hash.update(u);
  const v = hash.digest("hex").slice(0, 8);
  fs.writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify({ w: result.W, h: result.H, tile: OPT.tile, tiles: result.tiles.length, v, seams: result.seams.map(Math.round) }, null, 1),
  );
  const debugDir = process.env.DEBUG_OUT;
  if (debugDir) fs.writeFileSync(path.join(debugDir, "pano-full.jpg"), Buffer.from(result.full.split(",")[1], "base64"));
  console.log(`4/4 완료: ${result.W}×${result.H}px, 타일 ${result.tiles.length}장 ${Math.round(bytes / 1024)}KB + 미리보기 ${Math.round(pv.length / 1024)}KB`);
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
