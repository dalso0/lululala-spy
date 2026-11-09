// 홍보 영상의 소리를 파일로 만든다.
//   node scripts/sfx.cjs
//  1) 앱의 효과음(src/lib/fx/sound.ts)을 그대로 돌려 WAV 로 → public/sfx/<이름>.wav
//  2) 장면 시간표(src/timeline.json)에 맞춘 배경 음악(직접 합성, 저작권 걱정 없음) → public/sfx/score.wav
// 브라우저(크롬)의 OfflineAudioContext 로 '녹음'하므로 앱에서 나는 소리와 똑같다.

const { chromium } = require("playwright-core");
const http = require("http");
const fs = require("fs");
const path = require("path");
const ts = require(path.join(__dirname, "..", "..", "node_modules", "typescript"));

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.join(__dirname, "..", "public", "sfx");
const TL = require("../src/timeline.json");

const soundSrc = fs.readFileSync(path.join(__dirname, "..", "..", "src", "lib", "fx", "sound.ts"), "utf8");
const soundJs = ts.transpileModule(soundSrc, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;

const SOUNDS = [
  ["tap"], ["tick"], ["switch"], ["thunk"], ["latch"], ["whir", { duration: 0.9 }], ["hum"], ["power"], ["chime"], ["sparkle"],
  ["glass"], ["gulp"], ["deny"], ["focus"], ["stamp"], ["inhale", { duration: 2.4 }], ["hold", { duration: 1.2 }], ["exhale", { duration: 2.4 }],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http
    .createServer((req, res) => {
      if (req.url.startsWith("/footage.mp4")) {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        return fs.createReadStream(path.join(__dirname, "..", "public", TL.footage.file)).pipe(res);
      }
      if (req.url.startsWith("/sound.mjs")) {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        return res.end(soundJs);
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!doctype html><title>sfx</title>");
    })
    .listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.goto(base + "/");

  // WAV 만들기 + 끝의 빈 소리 잘라내기 (페이지 안에서 쓰는 도구)
  await page.evaluate(() => {
    window.trim = (buf) => {
      const ch = [buf.getChannelData(0), buf.getChannelData(1)];
      let last = 0;
      for (let i = 0; i < buf.length; i++) if (Math.abs(ch[0][i]) > 2e-4 || Math.abs(ch[1][i]) > 2e-4) last = i;
      const len = Math.max(1, Math.min(buf.length, last + Math.round(buf.sampleRate * 0.05)));
      const out = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate: buf.sampleRate });
      for (let c = 0; c < 2; c++) out.copyToChannel(ch[c].subarray(0, len), c);
      return out;
    };
    window.toWav = (buf, trim) => {
      const ch = [buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)];
      let len = buf.length;
      if (trim) {
        let last = 0;
        for (let i = 0; i < buf.length; i++) if (Math.abs(ch[0][i]) > 2e-4 || Math.abs(ch[1][i]) > 2e-4) last = i;
        len = Math.min(buf.length, last + Math.round(buf.sampleRate * 0.05));
      }
      const data = new DataView(new ArrayBuffer(44 + len * 4));
      const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
      w(0, "RIFF"); data.setUint32(4, 36 + len * 4, true); w(8, "WAVE"); w(12, "fmt ");
      data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
      data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * 4, true);
      data.setUint16(32, 4, true); data.setUint16(34, 16, true); w(36, "data"); data.setUint32(40, len * 4, true);
      for (let i = 0; i < len; i++)
        for (let c = 0; c < 2; c++) data.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i])) * 0x7fff, true);
      let s = "";
      const bytes = new Uint8Array(data.buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    };
  });

  // 1) 앱 효과음
  let n = 0;
  for (const [name, opts] of SOUNDS) {
    const b64 = await page.evaluate(
      async ({ name, opts, n }) => {
        const SR = 48000;
        window.AudioContext = function () {
          const c = new OfflineAudioContext(2, SR * 6, SR);
          window.__ctx = c;
          return c;
        };
        const m = await import(`/sound.mjs?n=${n}`);
        m.setSoundOn(true);
        m.unlockAudio();
        m.play(name, opts || undefined);
        const buf = await window.__ctx.startRendering();
        (window.__bufs ||= {})[name] = window.trim(buf);
        return window.toWav(buf, true);
      },
      { name, opts, n: n++ },
    );
    fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.from(b64, "base64"));
  }
  console.log(`효과음 ${SOUNDS.length}개`);

  // 2) 배경 음악 (장면 시간표에 맞춰). video7 장면에서는 쉬고 그 영상 소리가 나온다
  const score = await page.evaluate(async (TL) => {
    const SR = 48000;
    const D = TL.seconds;
    const S = TL.scenes;
    const c = new OfflineAudioContext(2, SR * D, SR);
    const master = c.createGain();
    master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;
    master.connect(comp).connect(c.destination);
    const noiseBuf = (() => {
      const b = c.createBuffer(1, SR * 2, SR);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    const env = (g, t, a, peak, dec, sustain = 0) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + dec);
    };
    const out = (gain, pan = 0) => {
      const g = c.createGain();
      g.gain.value = gain;
      if (pan) {
        const p = c.createStereoPanner();
        p.pan.value = pan;
        g.connect(p).connect(master);
      } else g.connect(master);
      return g;
    };
    const noise = (t, dur, { type = "bandpass", f = 3000, f2, q = 1, gain = 0.2, a = 0.005, pan = 0 } = {}) => {
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const fl = c.createBiquadFilter();
      fl.type = type;
      fl.frequency.setValueAtTime(f, t);
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
      fl.Q.value = q;
      const g = c.createGain();
      env(g, t, a, gain, dur);
      src.connect(fl).connect(g).connect(out(1, pan));
      src.start(t, Math.random());
      src.stop(t + a + dur + 0.05);
    };
    const tone = (t, dur, { f = 440, f2, type = "sine", gain = 0.2, a = 0.005, pan = 0, lp } = {}) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      const g = c.createGain();
      env(g, t, a, gain, dur);
      let node = o.connect(g);
      if (lp) {
        const fl = c.createBiquadFilter();
        fl.type = "lowpass";
        fl.frequency.value = lp;
        node = node.connect(fl);
      }
      node.connect(out(1, pan));
      o.start(t);
      o.stop(t + a + dur + 0.05);
    };
    const kick = (t, gain = 0.9) => tone(t, 0.3, { f: 150, f2: 42, gain });
    const hat = (t, gain = 0.12) => noise(t, 0.045, { type: "highpass", f: 7500, gain, pan: 0.2 });
    const clap = (t, gain = 0.3) => noise(t, 0.15, { type: "bandpass", f: 1700, q: 0.8, gain });
    const boom = (t, gain = 1) => {
      tone(t, 1.1, { f: 70, f2: 28, gain });
      noise(t, 1.3, { type: "lowpass", f: 2400, f2: 200, gain: 0.35 * gain });
    };
    const A = 55;
    const hz = (semi) => A * Math.pow(2, semi / 12);
    const beat = 60 / TL.bpm;

    // 낮게 깔린 소리(드론): 요원명 발급 장면 앞에서 들어와 작전이 시작되면 물러난다
    {
      const g = c.createGain();
      const t0 = S.recruit[0] - 0.8;
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.11, S.recruit[0] + 0.2);
      g.gain.setValueAtTime(0.11, S.v7hack[0] - 0.1);
      g.gain.linearRampToValueAtTime(0.03, S.v7hack[0] + 0.2);
      g.gain.setValueAtTime(0.03, S.daily[0]);
      g.gain.linearRampToValueAtTime(0.045, S.daily[0] + 0.3);
      g.gain.setValueAtTime(0.045, S.color[0] - 0.05);
      g.gain.linearRampToValueAtTime(0.0001, S.color[0] + 0.3);
      const fl = c.createBiquadFilter();
      fl.type = "lowpass";
      fl.frequency.value = 380;
      fl.Q.value = 6;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.18;
      const lg = c.createGain();
      lg.gain.value = 160;
      lfo.connect(lg).connect(fl.frequency);
      lfo.start(0);
      [hz(0), hz(0) * 1.006, hz(7), hz(12) * 0.997].forEach((f, i) => {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        const og = c.createGain();
        og.gain.value = i === 3 ? 0.4 : 0.7;
        o.connect(og).connect(fl);
        o.start(t0);
        o.stop(S.color[0] + 0.5);
      });
      fl.connect(g).connect(master);
    }

    // 요원명 발급: 심장 소리 → "바로 너." 쿵 → video7 로 넘어가는 쉭
    for (let t = S.recruit[0] + 0.1; t < S.recruit[1] - 0.2; t += 60 / 80) {
      tone(t, 0.14, { f: 62, f2: 40, gain: 0.5 });
      tone(t + 0.18, 0.12, { f: 55, f2: 38, gain: 0.3 });
    }
    boom(TL.beats.you, 0.75);
    noise(S.recruit[1] - 0.45, 0.45, { type: "highpass", f: 600, f2: 7000, gain: 0.14, a: 0.4 });

    // 작전 장면: 144 BPM, 2.5초(6박)마다 장면이 바뀐다
    noise(S.daily[0] - 0.6, 0.6, { type: "highpass", f: 400, f2: 8000, gain: 0.1, a: 0.55 });
    const bass = [0, 0, 0, 0, 3, 3, -2, -2];
    for (let i = 0, t = S.daily[0]; t < S.color[0] - 0.01; i++, t += beat) {
      kick(t, i % 6 === 0 ? 1.25 : 1.05);
      hat(t + beat / 2, 0.16);
      if (i % 2 === 1) clap(t, 0.4);
      for (let e = 0; e < 2; e++) {
        const tt = t + (e * beat) / 2;
        tone(tt, beat / 2 - 0.02, { f: hz(bass[(i * 2 + e) % 8] + 12), type: "sawtooth", gain: 0.19, lp: 480, a: 0.004 });
      }
      if (i % 6 === 0 && i > 0) noise(t - 0.12, 0.22, { type: "highpass", f: 1200, f2: 6000, gain: 0.12 });
    }
    noise(S.color[0] - 1.0, 1.0, { type: "highpass", f: 300, f2: 9000, gain: 0.16, a: 0.9 });
    tone(S.color[0] - 1.0, 1.0, { f: 180, f2: 1400, type: "sawtooth", gain: 0.05, a: 0.9, lp: 3000 });
    boom(S.color[0], 1);

    // 색이 돌아온다: 라 장조 화음 + 반짝이
    const chord = (t, dur, gain, semis = [12, 16, 19, 24]) => {
      const fl = c.createBiquadFilter();
      fl.type = "lowpass";
      fl.frequency.setValueAtTime(700, t);
      fl.frequency.exponentialRampToValueAtTime(3200, t + Math.min(2.5, dur));
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.5);
      g.gain.setValueAtTime(gain, Math.max(t + 0.5, t + dur - 0.5));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      fl.connect(g).connect(master);
      semis.forEach((s, k) => {
        for (const det of [0.997, 1.003]) {
          const o = c.createOscillator();
          o.type = k === 0 ? "sawtooth" : "triangle";
          o.frequency.value = hz(s + 12) * det;
          o.connect(fl);
          o.start(t);
          o.stop(t + dur + 0.05);
        }
      });
    };
    chord(S.color[0], S.cta[0] - S.color[0] + 0.3, 0.07);
    const arp = [24, 28, 31, 36, 31, 28];
    for (let i = 0, t = S.color[0] + 0.4; t < S.cta[0]; i++, t += beat / 2) tone(t, 0.16, { f: hz(arp[i % arp.length] + 12), type: "triangle", gain: 0.035, pan: i % 2 ? 0.3 : -0.3 });
    for (let t = S.color[0]; t < S.cta[0]; t += beat * 2) kick(t, 0.7);

    // 키링: 숨 고르고 → 톡! → video7 마지막 장면 전에 물러난다
    const tag = TL.beats.tagTouch;
    for (let t = S.cta[0]; t < tag - 0.1; t += beat) hat(t, 0.08);
    tone(S.cta[0], tag - S.cta[0], { f: hz(12), type: "triangle", gain: 0.05, a: 0.3, lp: 900 });
    boom(tag, 0.8);
    chord(tag, S.v7cta[0] - tag + 0.15, 0.08, [12, 16, 19, 24, 28]);
    for (let i = 0, t = tag; t < S.v7cta[0] - 0.05; i++, t += beat) {
      kick(t, i === 0 ? 1 : 0.75);
      hat(t + beat / 2, 0.1);
      if (i % 2 === 1) clap(t, 0.25);
    }

    // 마지막 카드: 쿵 + 화음 → "작전 개시!" → 끝
    boom(TL.beats.endHit, 0.9);
    chord(TL.beats.endHit, D - TL.beats.endHit, 0.09, [12, 16, 19, 24, 28]);
    kick(TL.beats.endHit + 0.6, 1);
    for (let i = 0, t = TL.beats.endHit + 0.6; t < D - 0.7; i++, t += beat) {
      if (i) kick(t, 0.7);
      hat(t + beat / 2, 0.09);
    }
    master.gain.setValueAtTime(0.9, D - 0.8);
    master.gain.linearRampToValueAtTime(0.0001, D - 0.02);

    const buf = await c.startRendering();
    let peak = 0;
    for (let ch = 0; ch < 2; ch++) for (const v of buf.getChannelData(ch)) peak = Math.max(peak, Math.abs(v));
    const k = 0.89 / (peak || 1);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] *= k;
    }
    window.__score = buf;
    return window.toWav(buf, false);
  }, TL);
  fs.writeFileSync(path.join(OUT, "score.wav"), Buffer.from(score, "base64"));
  console.log("배경 음악 score.wav");

  // 3) 음악 + 효과음을 한 줄로 섞고, 쇼츠에 맞는 크기(평균 약 -16dB, 최고 -1dB)로 다듬는다
  const PLAN = require("./sfx-plan.cjs");
  const mix = await page.evaluate(
    async ({ PLAN, fps, seconds, TL }) => {
      const SR = 48000;
      // video7 소리: 쓰는 구간만, 다른 장면과 비슷한 크기로
      const foot = await new OfflineAudioContext(2, SR, SR).decodeAudioData(await (await fetch("/footage.mp4")).arrayBuffer());
      const parts = Object.entries(TL.footage.from).map(([scene, src]) => ({ at: TL.scenes[scene][0], src, dur: TL.scenes[scene][1] - TL.scenes[scene][0] }));
      let fs2 = 0;
      let fn = 0;
      let fpeak = 0;
      for (const p of parts)
        for (let ch = 0; ch < 2; ch++) {
          const d = foot.getChannelData(ch);
          for (let i = Math.floor(p.src * foot.sampleRate); i < Math.min(d.length, (p.src + p.dur) * foot.sampleRate); i++) {
            fs2 += d[i] * d[i];
            fn++;
            fpeak = Math.max(fpeak, Math.abs(d[i]));
          }
        }
      const fRms = 20 * Math.log10(Math.sqrt(fs2 / Math.max(1, fn)) + 1e-9);
      const footGain = Math.min(Math.pow(10, (-19 - fRms) / 20), 0.95 / (fpeak || 1));
      const render = async (makeup) => {
        const c = new OfflineAudioContext(2, SR * seconds, SR);
        const bus = c.createGain();
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -22;
        comp.knee.value = 8;
        comp.ratio.value = 3.5;
        comp.attack.value = 0.004;
        comp.release.value = 0.18;
        const gain = c.createGain();
        gain.gain.value = makeup;
        const lim = c.createDynamicsCompressor();
        lim.threshold.value = -2.5;
        lim.knee.value = 0;
        lim.ratio.value = 20;
        lim.attack.value = 0.001;
        lim.release.value = 0.06;
        bus.connect(comp).connect(gain).connect(lim).connect(c.destination);
        const add = (buf, t, vol) => {
          const s = c.createBufferSource();
          s.buffer = buf;
          const g = c.createGain();
          g.gain.value = vol;
          s.connect(g).connect(bus);
          s.start(t);
        };
        add(window.__score, 0, 0.9);
        for (const [fr, name, vol] of PLAN) add(window.__bufs[name], fr / fps, vol);
        for (const p of parts) {
          const s = c.createBufferSource();
          s.buffer = foot;
          const g = c.createGain();
          const fade = 0.04;
          g.gain.setValueAtTime(p.at === 0 ? footGain : 0, p.at);
          if (p.at > 0) g.gain.linearRampToValueAtTime(footGain, p.at + fade);
          g.gain.setValueAtTime(footGain, p.at + p.dur - fade);
          g.gain.linearRampToValueAtTime(0, p.at + p.dur);
          s.connect(g).connect(bus);
          s.start(p.at, p.src, p.dur);
        }
        return c.startRendering();
      };
      const stats = (buf) => {
        const L = buf.getChannelData(0);
        const R = buf.getChannelData(1);
        let peak = 0;
        let sum = 0;
        for (let i = 0; i < L.length; i++) {
          peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
          sum += (L[i] * L[i] + R[i] * R[i]) / 2;
        }
        return { peak, rmsDb: 20 * Math.log10(Math.sqrt(sum / L.length) + 1e-9) };
      };
      const first = stats(await render(1));
      const makeup = Math.pow(10, (-16.5 - first.rmsDb) / 20);
      const buf = await render(makeup);
      const st = stats(buf);
      const k = Math.min(1, 0.89 / st.peak);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < d.length; i++) d[i] *= k;
      }
      const fin = stats(buf);
      return { wav: window.toWav(buf, false), rmsDb: fin.rmsDb.toFixed(1), peakDb: (20 * Math.log10(fin.peak)).toFixed(1), makeupDb: (20 * Math.log10(makeup)).toFixed(1) };
    },
    { PLAN, fps: TL.fps, seconds: TL.seconds, TL },
  );
  fs.writeFileSync(path.join(OUT, "mix.wav"), Buffer.from(mix.wav, "base64"));
  console.log(`섞은 소리 mix.wav: 평균 ${mix.rmsDb}dB · 최고 ${mix.peakDb}dB (보정 +${mix.makeupDb}dB)`);
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
