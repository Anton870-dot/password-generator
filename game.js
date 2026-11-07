// ---------- Игра «Лунная тревога» ----------
// Шутер от первого лица в духе игр 90-х. Свой движок:
//  • 3D через видеокарту (WebGL): свободный обзор, живой свет, кровь, брызги на стенах, куски мутантов;
//  • запасной лучевой рендер на процессоре — если видеокарта недоступна.
// Уровни, звуки и эффекты — свои. Картинки — из game-art.js. Math.random не используется.
(function () {
  'use strict';

  const ART = window.GAME_ART || {};
  const META = window.GAME_ART_META || {};
  // во сколько раз картинки детальнее «логического» экрана 320×200 (2 — двойное разрешение)
  const ART_S = META.scale || 1;

  // ---------- случайные числа (crypto) ----------
  const rbuf = new Uint32Array(256);
  let rpos = 256;
  function rnd() {
    if (rpos >= 256) { crypto.getRandomValues(rbuf); rpos = 0; }
    return rbuf[rpos++] / 4294967296;
  }
  const rr = (a, b) => a + (b - a) * rnd();

  // ---------- размеры экрана (логические) ----------
  const W = 320, VH = 200, HUDH = 40, H = VH + HUDH;
  const PLANE = 0.66; // ширина поля зрения (~66°)
  const EYE = 0.5;    // высота глаз (стена = 1)

  // ---------- оформление ----------
  const css = `
#lunarWin { padding: 0; z-index: 62; }
#lunarWin .win95-window.lunar { width: 100%; height: 100%; max-width: none; display: flex; flex-direction: column; box-shadow: none; }
.ln-stage { flex: 1; min-height: 0; position: relative; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.ln-stage.portrait { flex-direction: column; justify-content: flex-start; }
#lnCanvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; flex: none; }
.ln-touch { display: none; }
.ln-stage.touch .ln-touch { display: block; }
.ln-stage.touch:not(.portrait) .ln-touch { position: absolute; inset: 0; }
.ln-stage.portrait .ln-touch { position: relative; flex: 1; width: 100%; background: #101418; border-top: 2px solid #808080; }
.ln-btn { position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; border-radius: 50%; background: rgba(192,192,192,.28); border: 2px solid rgba(255,255,255,.55); color: #fff; font: bold 12px Tahoma, Verdana, sans-serif; text-shadow: 1px 1px 0 #000; line-height: 1.1; }
.ln-btn.on { background: rgba(255,255,255,.45); }
.ln-fire { right: 16px; bottom: 20px; width: 86px; height: 86px; font-size: 14px; background: rgba(200,40,40,.4); }
.ln-use { right: 112px; bottom: 26px; width: 60px; height: 60px; }
.ln-weap { right: 24px; bottom: 118px; width: 58px; height: 58px; font-size: 11px; }
.ln-pause { right: 10px; top: 10px; width: 42px; height: 42px; border-radius: 6px; font-size: 16px; }
.ln-zone { position: absolute; left: 14px; bottom: 14px; color: rgba(255,255,255,.35); font: 11px Tahoma, sans-serif; pointer-events: none; }
.ln-zone.r { left: auto; right: 64px; bottom: auto; top: 24px; }
.ln-stage:not(.portrait) .ln-zone.r { display: none; }
.ln-stick { position: absolute; width: 110px; height: 110px; margin: -55px 0 0 -55px; border-radius: 50%; border: 2px solid rgba(255,255,255,.4); background: rgba(255,255,255,.06); display: none; pointer-events: none; }
.ln-knob { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; background: rgba(255,255,255,.45); }
.ln-menu { position: absolute; inset: 0; z-index: 5; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 16px; background: rgba(0,0,0,.72); color: #fff; text-align: center; overflow: auto; }
.ln-menu.show { display: flex; }
.ln-menu h1 { font: bold 28px "Courier New", monospace; color: #8dff96; letter-spacing: 3px; text-shadow: 0 0 10px #1f8a2a, 2px 2px 0 #000; }
.ln-menu h2 { font: bold 18px "Courier New", monospace; color: #ffd95a; text-shadow: 2px 2px 0 #000; }
.ln-menu p { max-width: 460px; font-size: 13px; line-height: 1.45; }
.ln-menu .win95-button { min-width: 240px; }
.ln-menu .ln-small { font-size: 11px; color: #aaa; }
.ln-dos { position: absolute; inset: 0; z-index: 8; display: none; background: #000; color: #aaa; overflow: hidden; cursor: default;
  font: clamp(10px, 2.3vw, 15px)/1.4 "Courier New", Courier, monospace; }
.ln-dos.show { display: block; }
.ln-dos-bar { background: #0000a8; color: #ffff55; text-align: center; padding: 3px 4px; white-space: pre; overflow: hidden; }
.ln-dos pre { margin: 0; padding: 6px 10px; white-space: pre-wrap; font: inherit; }
.ln-dos .ok { color: #55ff55; }
.ln-dos .warn { color: #ff5555; }
.ln-dos .hi { color: #fff; }
.ln-dos .cur { animation: lnBlink .5s steps(1) infinite; }
@keyframes lnBlink { 50% { opacity: 0; } }
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const win = document.createElement('div');
  win.className = 'modal';
  win.id = 'lunarWin';
  win.innerHTML = `
  <div class="win95-window lunar">
    <div class="win95-titlebar">
      <span>🌙 Лунная тревога</span>
      <div class="win95-titlebar-buttons">
        <span class="win95-btn-sm" id="lnX" role="button" aria-label="Закрыть">✕</span>
      </div>
    </div>
    <div class="ln-stage" id="lnStage">
      <canvas id="lnCanvas" width="${W}" height="${H}"></canvas>
      <div class="ln-touch" id="lnTouch">
        <div class="ln-zone">◀ ходить ▶</div>
        <div class="ln-zone r">обзор — ведите пальцем</div>
        <div class="ln-stick" id="lnStick"><div class="ln-knob" id="lnKnob"></div></div>
        <div class="ln-btn ln-fire" data-b="fire">ОГОНЬ</div>
        <div class="ln-btn ln-use" data-b="use">Открыть</div>
        <div class="ln-btn ln-weap" data-b="weap">Оружие</div>
        <div class="ln-btn ln-pause" data-b="pause">II</div>
      </div>
      <div class="ln-menu" id="lnMenu"></div>
      <div class="ln-dos" id="lnDos"><div class="ln-dos-bar">Л У Н Н А Я   Т Р Е В О Г А   —   запуск системы v1.0</div><pre id="lnDosText"></pre></div>
    </div>
  </div>`;
  document.body.appendChild(win);

  const stage = document.getElementById('lnStage');
  const canvas = document.getElementById('lnCanvas');
  const ctx = canvas.getContext('2d');
  const menu = document.getElementById('lnMenu');
  const touchEl = document.getElementById('lnTouch');
  const stick = document.getElementById('lnStick');
  const knob = document.getElementById('lnKnob');
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
  stage.classList.toggle('touch', isTouch);

  // запасной рендер
  const img = ctx.createImageData(W, VH);
  const buf = new Uint32Array(img.data.buffer);
  const zbuf = new Float32Array(W);

  // ---------- настройки и прогресс ----------
  const saved = { level: 1, gore: 2, q: 2, gl: true, post: true };
  try {
    const s = JSON.parse(localStorage.getItem('pg95-lunar') || 'null');
    if (s) {
      if (Number.isInteger(s.level)) saved.level = Math.max(1, Math.min(3, s.level));
      if ([0, 1, 2].includes(s.gore)) saved.gore = s.gore;
      if ([1, 2, 3].includes(s.q)) saved.q = s.q;
      if (typeof s.gl === 'boolean') saved.gl = s.gl;
      if (typeof s.post === 'boolean') saved.post = s.post;
      if (s.qv === 2) saved.qv = 2;
    }
  } catch (e) {}
  // с версии 3.10 на компьютере по умолчанию высокая чёткость (раньше была обычная)
  if (saved.qv !== 2) { saved.q = isTouch ? 2 : 3; saved.qv = 2; }
  function store() { try { localStorage.setItem('pg95-lunar', JSON.stringify(saved)); } catch (e) {} }
  function saveProgress(level) { saved.level = Math.max(saved.level, Math.min(LEVELS.length, level)); store(); }

  // ---------- картинки ----------
  const TEX = {};   // {w, h, px: Uint32Array}
  const IMG = {};   // canvas для drawImage
  let artReady = false;

  function loadArt() {
    const names = Object.keys(ART);
    return Promise.all(names.map(name => new Promise(res => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height);
        TEX[name] = { w: c.width, h: c.height, px: new Uint32Array(d.data.buffer.slice(0)) };
        IMG[name] = c;
        res();
      };
      im.onerror = () => res();
      im.src = ART[name];
    }))).then(() => {
      if (TEX.floor) TEX.ceil = recolor(TEX.floor, (r, g, b) => { const v = (r + g + b) / 3; return [v * 0.55 + 6, v * 0.6 + 8, v * 0.7 + 14]; });
      if (TEX.door) {
        TEX.locked = recolor(TEX.door, (r, g, b) => [Math.min(255, r * 1.15 + 30), g * 0.7, b * 0.7]);
        TEX.exit = recolor(TEX.door, (r, g, b) => [r * 0.6, Math.min(255, g * 1.1 + 40), b * 0.7]);
      }
      TEX.shard = makeShard();
      TEX.puff = makePuff();
      TEX.dot = makeDot();
      TEX.hole = makeHole();
      TEX.lamp = makeLamp();
      TEX.casing = makeCasing([200, 160, 60], [120, 90, 30]);
      TEX.shell = makeCasing([200, 30, 30], [210, 170, 70]);
      for (let i = 0; i < 4; i++) { TEX['splat' + i] = makeSplat(); TEX['wsplat' + i] = makeWallSplat(); }
      TEX.drop = makeDrop();
      TEX.glow = makeTex(64, 64, (x, y) => {
        const d = Math.hypot(x - 31.5, y - 31.5) / 31.5;
        if (d >= 1) return 0;
        return rgba(255, 255, 255, 255 * Math.exp(-d * d * 4.5) * (1 - d));
      });
      TEX.mist = makeMist();
      for (let i = 0; i < 8; i++) {
        TEX['gib-tech-' + i] = makeChunk(TEX['tech-walk']);
        TEX['gib-astro-' + i] = makeChunk(TEX['astro-walk']);
      }
      for (let i = 0; i < 6; i++) TEX['meat-' + i] = makeChunk(null);
      artReady = true;
    });
  }

  function recolor(t, fn) {
    const px = new Uint32Array(t.px.length);
    for (let i = 0; i < px.length; i++) {
      const c = t.px[i];
      const [r, g, b] = fn(c & 255, (c >> 8) & 255, (c >> 16) & 255);
      px[i] = (c & 0xff000000) | (cl(b) << 16) | (cl(g) << 8) | cl(r);
    }
    return { w: t.w, h: t.h, px };
  }
  function cl(v) { return Math.max(0, Math.min(255, v | 0)); }
  function rgba(r, g, b, a) { return ((cl(a) << 24) | (cl(b) << 16) | (cl(g) << 8) | cl(r)) >>> 0; }
  function makeTex(n, m, fn) {
    const px = new Uint32Array(n * m);
    for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) px[y * n + x] = fn(x, y) || 0;
    return { w: n, h: m, px };
  }
  // кристальный осколок
  function makeShard() {
    return makeTex(12, 12, (x, y) => {
      const d = Math.abs(x - 5.5) / 3.2 + Math.abs(y - 5.5) / 5.5;
      if (d > 1) return 0;
      const k = 1 - d;
      return rgba(60 + 150 * k * k, 200 + 55 * k, 70 + 140 * k * k, 255);
    });
  }
  function makePuff() {
    return makeTex(8, 8, (x, y) => {
      const d = Math.hypot(x - 3.5, y - 3.5) / 3.8;
      if (d > 1) return 0;
      const k = 1 - d;
      return rgba(255 * Math.min(1, 0.6 + k), 150 + 100 * k, 40 + 80 * k, 255);
    });
  }
  // белая капля (красится цветом частицы)
  function makeDot() {
    return makeTex(8, 8, (x, y) => Math.hypot(x - 3.5, y - 3.5) < 3.6 ? rgba(255, 255, 255, 255) : 0);
  }
  // след от пули
  function makeHole() {
    return makeTex(16, 16, (x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 2.6) return rgba(10, 10, 10, 240);
      if (d < 6) return rgba(30, 30, 30, 140 * (1 - (d - 2.6) / 3.4));
      return 0;
    });
  }
  // светильник на потолке
  function makeLamp() {
    return makeTex(16, 16, (x, y) => {
      const e = Math.min(x, y, 15 - x, 15 - y);
      if (e < 2) return rgba(110, 110, 120, 255);
      return rgba(255, 250, 235, 255);
    });
  }
  // гильза / патрон дроби
  function makeCasing(body, base) {
    return makeTex(4, 8, (x, y) => {
      const c = y >= 6 ? base : body;
      const k = x === 1 ? 1.25 : x === 3 ? 0.7 : 1;
      return rgba(c[0] * k, c[1] * k, c[2] * k, 255);
    });
  }
  // ---- кровь: всё белое/серое, цвет даёт частица или след (так один рисунок годится для разных оттенков)
  // лужа/клякса на полу: густое пятно, брызги вокруг, блики
  function makeSplat() {
    const n = 48, c = n / 2;
    const blobs = [];
    for (let i = 0; i < 12; i++) { const a = rnd() * 6.283, d = rnd() * 12; blobs.push([c + Math.cos(a) * d, c + Math.sin(a) * d, 4 + rnd() * 7]); }
    for (let i = 0; i < 14; i++) { const a = rnd() * 6.283, d = 14 + rnd() * 8; blobs.push([c + Math.cos(a) * d, c + Math.sin(a) * d, 0.8 + rnd() * 2]); }
    // вытянутые брызги-лучи
    for (let i = 0; i < 6; i++) { const a = rnd() * 6.283; for (let k = 0; k < 5; k++) { const d = 10 + k * 2.5; blobs.push([c + Math.cos(a) * d, c + Math.sin(a) * d, 2.2 - k * 0.35]); } }
    return makeTex(n, n, (x, y) => {
      let v = 0;
      for (const [bx, by, r] of blobs) v = Math.max(v, 1 - Math.hypot(x - bx, y - by) / r);
      if (v <= 0) return 0;
      const k = Math.min(1, v * 2.2);
      let sh = 120 + 135 * k;                       // к краям темнее (кровь засыхает)
      if (v > 0.55 && rnd() < 0.04) sh = 255 + 60;  // блик на густой крови
      return rgba(sh, sh, sh, Math.min(255, 150 + v * 420));
    });
  }
  // клякса на стене: пятно и потёки вниз
  function makeWallSplat() {
    const w = 32, h = 64, cx = 16, cy = 18;
    const blobs = [];
    for (let i = 0; i < 9; i++) { const a = rnd() * 6.283, d = rnd() * 8; blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3 + rnd() * 5]); }
    for (let i = 0; i < 10; i++) { const a = rnd() * 6.283, d = 10 + rnd() * 5; blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.8 + rnd() * 1.5]); }
    const drips = [];
    for (let i = 0; i < 3 + rnd() * 4; i++) drips.push([cx + rr(-8, 8), cy + rr(2, 6), rr(14, 42), rr(0.8, 1.8)]);
    return makeTex(w, h, (x, y) => {
      let v = 0;
      for (const [bx, by, r] of blobs) v = Math.max(v, 1 - Math.hypot(x - bx, y - by) / r);
      for (const [dx, dy, len, wd] of drips) {
        if (y < dy || y > dy + len + 2) continue;
        const t = (y - dy) / len;
        const ww = t > 1 ? wd + 1.2 : wd * (1 - t * 0.4);   // на конце потёка — капля
        const ay = t > 1 ? 1 - (y - dy - len) / 2.5 : 1;
        v = Math.max(v, (1 - Math.abs(x - dx) / ww) * ay);
      }
      if (v <= 0) return 0;
      const sh = 120 + 135 * Math.min(1, v * 2);
      return rgba(sh, sh, sh, Math.min(255, 160 + v * 400));
    });
  }
  // мягкая капля
  function makeDrop() {
    return makeTex(16, 16, (x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5) / 7.5;
      if (d >= 1) return 0;
      const a = Math.pow(1 - d, 0.6);
      const sh = d < 0.35 && x < 7 && y < 7 ? 255 : 200;
      return rgba(sh, sh, sh, 255 * a);
    });
  }
  // кровавая дымка
  function makeMist() {
    return makeTex(32, 32, (x, y) => {
      const d = Math.hypot(x - 15.5, y - 15.5) / 15.5;
      if (d >= 1) return 0;
      const a = Math.exp(-d * d * 3.2) * (0.75 + rnd() * 0.25);
      return rgba(220, 220, 220, 255 * a);
    });
  }
  // кусок мутанта: рваный край, кусок одежды/кожи с его картинки, мясо и кровь по краям
  function makeChunk(src) {
    const n = (16 + ((rnd() * 10) | 0)) * ART_S, c = n / 2;
    const blobs = [];
    for (let i = 0; i < 5; i++) { const a = rnd() * 6.283, d = rnd() * n * 0.22; blobs.push([c + Math.cos(a) * d, c + Math.sin(a) * d, n * (0.18 + rnd() * 0.2)]); }
    const sx0 = src ? Math.floor(rr(0.22, 0.78) * src.w - n / 2) : 0, sy0 = src ? Math.floor(rr(0.1, 0.8) * src.h - n / 2) : 0;
    const bone = rnd() < 0.25, boneA = rnd() * 3.14;
    return makeTex(n, n, (x, y) => {
      let v = 0;
      for (const [bx, by, r] of blobs) v = Math.max(v, 1 - Math.hypot(x - bx, y - by) / r);
      if (v <= 0) return 0;
      let r, g, b;
      const flesh = () => { const k = rr(0.75, 1.15); r = 150 * k; g = 22 * k; b = 26 * k; if (rnd() < 0.06) { r = 225; g = 190; b = 140; } };
      if (src) {
        const px = src.px[Math.min(src.h - 1, Math.max(0, sy0 + y)) * src.w + Math.min(src.w - 1, Math.max(0, sx0 + x))];
        if ((px >>> 24) < 128) flesh(); else { r = px & 255; g = (px >> 8) & 255; b = (px >> 16) & 255; }
        if (rnd() < 0.12) { r = r * 0.6 + 60; g *= 0.3; b *= 0.3; }   // пятна крови на одежде
      } else flesh();
      if (bone) { const d = Math.abs((x - c) * Math.sin(boneA) - (y - c) * Math.cos(boneA)); if (d < 1.4 && v > 0.3) { r = 230; g = 222; b = 205; } }
      if (v < 0.28) { r = 95 + rnd() * 30; g = 6; b = 9; }                // рваный кровавый край
      return rgba(r, g, b, 255);
    });
  }

  // ---------- звуки (синтез) ----------
  let actx = null, noiseBuf = null, master = null;
  let VS = 1; // громкость текущего звука (тише — если источник далеко)
  // Sound объявлен в index.html через const — это не свойство window, поэтому проверяем через typeof
  const soundOn = () => typeof Sound === 'undefined' || !Sound.isOn || Sound.isOn();
  function audio() {
    if (!soundOn()) return null;
    if (!actx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      actx = new C();
      master = actx.createGain();
      master.gain.value = 0.6;
      master.connect(actx.destination);
      noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  function env(g, t, a, peak, dur) {
    peak = Math.max(0.0002, peak * VS);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function noise(dur, type, freq, vol, delay, q) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + (delay || 0);
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = c.createGain(); env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, rnd() * 0.5); s.stop(t + dur + 0.05);
  }
  function tone(type, f0, f1, dur, vol, delay) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); env(g, t, 0.006, vol, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // звук из точки уровня: чем дальше, тем тише
  function atDist(x, y, fn, range) {
    if (!G) return;
    const d = Math.hypot(x - G.px, y - G.py);
    const k = 1 - d / (range || 14);
    if (k <= 0.03) return;
    VS = k * k;
    try { fn(); } finally { VS = 1; }
  }
  let lastTink = 0;
  const SFX = {
    // выстрел: резкий щелчок + «тело» + низкий удар + эхо станции
    pistol() {
      noise(0.05, 'highpass', 3000, 0.9);
      noise(0.18, 'bandpass', 1100, 1.2, 0, 0.8);
      tone('triangle', 190, 55, 0.14, 0.7);
      noise(0.55, 'lowpass', 700, 0.22, 0.05);
    },
    shotgun() {
      noise(0.07, 'highpass', 2200, 1.0);
      noise(0.45, 'lowpass', 1400, 1.5);
      tone('triangle', 120, 32, 0.32, 1.0);
      tone('sine', 70, 28, 0.45, 0.8);
      noise(0.9, 'lowpass', 450, 0.35, 0.08);
    },
    empty() { noise(0.03, 'highpass', 4000, 0.3); },
    techAlert() { tone('sawtooth', 120, 70, 0.5, 0.18); tone('sawtooth', 126, 64, 0.5, 0.12); },
    astroAlert() { tone('sawtooth', 70, 45, 0.7, 0.2); tone('square', 900, 300, 0.4, 0.04, 0.05); },
    pain() { tone('square', 260, 120, 0.12, 0.12); },
    die() { tone('sawtooth', 220, 40, 0.7, 0.2); noise(0.5, 'lowpass', 900, 0.4); },
    shatter() { for (let i = 0; i < 5; i++) tone('sine', 1800 + rnd() * 1800, 900, 0.18, 0.06, i * 0.04); },
    gib() { noise(0.5, 'lowpass', 500, 1.0); tone('sine', 90, 30, 0.4, 0.6); noise(0.3, 'bandpass', 900, 0.5, 0.05, 1.5); for (let i = 0; i < 7; i++) tone('sine', 1500 + rnd() * 2500, 800, 0.2, 0.05, 0.05 + i * 0.05); },
    splat() { noise(0.12, 'lowpass', 700, 0.35); },
    flesh() { noise(0.08, 'bandpass', 600, 0.45, 0, 1.2); },
    ricochet() { tone('sine', 2400 + rnd() * 1500, 900, 0.12, 0.05); },
    // гильза об пол: звонкий металлический «дзынь»
    tink(heavy) {
      const t = performance.now(); if (t - lastTink < 45) return; lastTink = t;
      const f = heavy ? 1700 + rnd() * 600 : 3600 + rnd() * 1800;
      tone('sine', f, f * 0.97, 0.16, heavy ? 0.12 : 0.14);
      tone('sine', f * 2.76, f * 2.7, 0.08, 0.06);
      noise(0.02, 'highpass', 6000, 0.12);
    },
    // лом: свист замаха, удар по телу, звон о стену, добивание, оглушение
    swing() { noise(0.2, 'bandpass', 700, 0.45, 0, 1.2); noise(0.14, 'bandpass', 1600, 0.2, 0.04, 2); },
    bash() { noise(0.14, 'lowpass', 650, 1.1); tone('sine', 120, 45, 0.2, 0.8); noise(0.05, 'highpass', 2600, 0.45); noise(0.18, 'bandpass', 400, 0.5, 0.03, 1.5); },
    clang() { tone('sine', 1180, 1150, 0.5, 0.16); tone('sine', 2730, 2700, 0.32, 0.09); tone('sine', 4100, 4050, 0.18, 0.05); noise(0.04, 'highpass', 4000, 0.4); },
    finisher() {
      tone('sawtooth', 85, 28, 0.7, 0.45); noise(0.6, 'lowpass', 380, 0.9, 0.05);
      noise(0.15, 'bandpass', 1300, 0.7, 0.08, 1.2);
      for (let i = 0; i < 8; i++) tone('sine', 1600 + rnd() * 2600, 900, 0.25, 0.05, 0.1 + i * 0.04);
    },
    // лифт: гул мотора и удар при остановке; приземление после прыжка
    lift() { tone('sawtooth', 48, 62, 1.4, 0.14); noise(1.3, 'lowpass', 300, 0.25); tone('square', 900, 900, 0.06, 0.04); },
    liftStop() { noise(0.15, 'lowpass', 500, 0.6); tone('sine', 90, 40, 0.2, 0.4); tone('sine', 1300, 1250, 0.3, 0.05, 0.03); },
    land() { noise(0.12, 'lowpass', 400, 0.7); tone('sine', 110, 45, 0.15, 0.5); },
    stun() { tone('sine', 620, 380, 0.6, 0.06); tone('sine', 660, 400, 0.6, 0.05, 0.1); tone('sawtooth', 110, 80, 0.7, 0.08); },
    // шаги мутантов
    stepTech() { noise(0.09, 'lowpass', 350, 0.5); noise(0.05, 'bandpass', 900, 0.15, 0.02, 2); },
    stepAstro() { tone('sine', 75, 38, 0.18, 0.7); noise(0.12, 'lowpass', 260, 0.6); tone('square', 420, 380, 0.05, 0.05, 0.01); },
    // рычание и стоны
    growlTech() {
      const b = 95 + rnd() * 40;
      tone('sawtooth', b, b * 0.75, 0.9, 0.12); tone('sawtooth', b * 1.02, b * 0.7, 0.9, 0.09);
      noise(0.8, 'bandpass', 500, 0.12, 0, 3);
    },
    growlAstro() {
      tone('sawtooth', 60, 42, 1.1, 0.16); tone('square', 63, 45, 1.1, 0.05);
      noise(0.6, 'bandpass', 2200, 0.12, 0.1, 6); // хрип сломанной рации шлема
      noise(0.3, 'bandpass', 1500, 0.1, 0.6, 6);
    },
    spit() { noise(0.25, 'bandpass', 1200, 0.35, 0, 2); tone('sine', 700, 300, 0.2, 0.06); },
    claw() { noise(0.12, 'highpass', 2200, 0.5); },
    hurt() { tone('square', 150, 80, 0.22, 0.2); noise(0.1, 'lowpass', 600, 0.4); },
    pickup() { tone('sine', 660, 660, 0.08, 0.15); tone('sine', 990, 990, 0.12, 0.15, 0.07); },
    weapon() { noise(0.05, 'highpass', 2500, 0.3); noise(0.05, 'highpass', 2000, 0.3, 0.12); },
    pump() { noise(0.06, 'highpass', 2200, 0.4); noise(0.07, 'bandpass', 1200, 0.4, 0.13, 2); },
    door() { tone('sawtooth', 55, 70, 0.7, 0.12); noise(0.6, 'lowpass', 400, 0.25); },
    locked() { tone('square', 200, 200, 0.12, 0.12); tone('square', 150, 150, 0.2, 0.12, 0.13); },
    exit() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.35, 0.18, i * 0.12)); }
  };

  // ---------- уровни ----------
  // # стена станции, R скала, W окно, D дверь, L красная дверь (нужна карта), X шлюз-выход
  // P игрок (смотрит вправо), t техник, a космонавт, h аптечка, b патроны, r броня, o кислород, k карта
  const LEVELS = [
    {
      name: 'Жилой модуль',
      intro: 'Станция «Селена-7» не отвечает уже трое суток. Найдите красную карту доступа и доберитесь до шлюза (зелёная дверь).',
      amb: [0.17, 0.18, 0.22], lamp: [1.25, 1.17, 1.0], lampR: 4.4, red: 0,
      // цветокоррекция «как в кино»: холодный станционный свет
      grade: { tint: [0.96, 1.0, 1.08], sat: 0.92, con: 1.08, bloom: 0.85 },
      // высоты: прямоугольники [x0, y0, x1, y1], f — пол, c — потолок (стена = 1)
      zones: [
        { r: [13, 1, 22, 3], c: 2 },                                  // высокий зал с лестницей на балкон
        { r: [18, 1, 18, 3], f: 0.25 }, { r: [19, 1, 19, 3], f: 0.5 }, { r: [20, 1, 22, 3], f: 0.75 },
        { r: [7, 8, 10, 8], f: -0.25 }, { r: [7, 9, 10, 11], f: -0.5 }, { r: [7, 12, 10, 12], f: -0.25 }, // котлован
        { r: [18, 10, 22, 14], c: 2 }, { r: [21, 10, 22, 14], f: 1 }   // шлюз на возвышении
      ],
      lifts: [{ x: 20, y: 12, lo: 0, hi: 1, start: 'lo' }],
      stepTex: 'wall-station',
      map: [
        '########################',
        '#P...#......W..........#',
        '#....#..t...W.....t....#',
        '#....D......W..........#',
        '#....#..h...W###D#######',
        '##D###......#....#.....#',
        '#....##D#####.b..#..k..#',
        '#.t..#......#....D.....#',
        '#....D..a...##D###..t..#',
        '#.b..#......#....#######',
        '######..o...#.t..L.....#',
        '#....#......#....#..h..#',
        '#..r.D......#....#.....X',
        '#....#####D##....#.a...#',
        '#....#.......b...#.....#',
        '########################'
      ]
    },
    {
      name: 'Кристальная шахта',
      intro: 'Внизу шахта, где добывали зелёный кристалл. Отсюда всё и началось. Карта доступа где-то в глубине.',
      amb: [0.1, 0.13, 0.11], lamp: [0.6, 1.15, 0.65], lampR: 3.8, red: 0,
      // ядовито-зелёная шахта, кристаллы сильнее светятся
      grade: { tint: [0.92, 1.06, 0.9], sat: 1.06, con: 1.12, bloom: 1.25 },
      zones: [
        { r: [7, 7, 13, 12], c: 2 },                                  // пещера
        { r: [7, 9, 13, 10], f: -1.5 }, { r: [10, 9, 10, 10], f: 0 }   // пропасть и узкий мост
      ],
      lifts: [{ x: 7, y: 9, lo: -1.5, hi: 0 }],                         // выбраться со дна пропасти
      stepTex: 'wall-rock', pitTex: 'wall-rock',
      map: [
        'RRRRRRRRRRRRRRRRRRRRRRRR',
        'RP....R.......R........R',
        'R.....R...t...R...a....R',
        'R.....D.......R........R',
        'R.....R...h...RRRDRRRRRR',
        'RRRDRRR.......R....R...R',
        'R.....RRRRDRRRR.t..R.k.R',
        'R..t..R.......D....D...R',
        'R.....R...a...R....RRRRR',
        'R..b..R.......RRRRRRRRRR',
        'RRRRDRR.o.....R........R',
        'R.....R.......L....a...R',
        'R..r..D...t...R........X',
        'R.....RRRRRDRRR..t.....R',
        'R.h.........b.R...h....R',
        'RRRRRRRRRRRRRRRRRRRRRRRR'
      ]
    },
    {
      name: 'Командный центр',
      intro: 'Последний рывок. За красной дверью — причал с эвакуационным шаттлом.',
      amb: [0.14, 0.15, 0.19], lamp: [1.05, 1.1, 1.25], lampR: 4.4, red: 0.35,
      // тревожный командный центр: тёплые красные тени
      grade: { tint: [1.07, 0.96, 0.95], sat: 0.95, con: 1.14, bloom: 1.0 },
      zones: [
        { r: [6, 1, 19, 4], c: 2 },                                   // большой зал
        { r: [8, 3, 17, 3], f: 0.25 }, { r: [8, 1, 17, 2], f: 0.5 }    // командный мостик с лестницей
      ],
      lifts: [],
      stepTex: 'wall-station',
      map: [
        '########################',
        '#P...#.....WWWW.....#..#',
        '#....D..t...........D.k#',
        '#....#.....a........#..#',
        '##D###..............##D#',
        '#....####D######D####..#',
        '#..t.#......#.......#..#',
        '#....D..a...D...t...#a.#',
        '#.h..#......#.......#..#',
        '####D####L###########b.#',
        '#......#...........#####',
        '#..a...#....t...a..D.t.#',
        '#......#...........#...#',
        '#.r..o.#.b.......h.#...X',
        '#......#...........#.b.#',
        '########################'
      ]
    }
  ];

  const WALLTEX = { '#': 'wall-station', 'R': 'wall-rock', 'W': 'wall-window' };
  const ENEMY = {
    t: { name: 'tech', hp: 30, speed: 1.05, upp: 0.8 / (112 * ART_S), alert: 'techAlert' },
    a: { name: 'astro', hp: 85, speed: 1.65, upp: 0.92 / (120 * ART_S), alert: 'astroAlert' }
  };
  const IU = 0.009 / ART_S; // размер предмета в мире на точку картинки
  const ITEM = {
    h: { tex: 'medkit', upp: IU },
    b: { tex: 'ammo', upp: IU },
    r: { tex: 'armor', upp: IU },
    o: { tex: 'oxygen', upp: IU },
    k: { tex: 'keycard', upp: IU }
  };
  // клавиши 1, 2, 3 — по порядку
  const WEAPONS = [
    { id: 'crowbar', name: 'Монтажный лом', short: '', ammo: null, cd: 0.5, frames: [['raise', 0.1], ['hit', 0.14], ['idle', 0.16]], sfx: 'swing', kick: 0, melee: true },
    { id: 'pistol', name: 'Пистолет Самойлова, 10 мм', short: '10 мм', ammo: 'bullets', cd: 0.34, frames: [['fire', 0.07], ['smoke', 0.22]], sfx: 'pistol', kick: 0.18 },
    { id: 'shotgun', name: 'Гвардейский дробовик', short: 'дробь', ammo: 'shells', cd: 0.9, frames: [['fire', 0.1], ['idle', 0.14], ['reload', 0.36]], sfx: 'shotgun', kick: 0.5 }
  ];
  const wid = () => WEAPONS[G.p.weapon].id;

  // ---------- состояние ----------
  let G = null;            // текущая игра
  let state = 'title';     // title | intro | play | pause | dead | done | win
  let open = false, raf = null, lastT = 0;

  function newPlayer() {
    return { hp: 100, armor: 0, bullets: 40, shells: 10, weapon: 1, key: false };
  }
  const alive = e => e.st !== 'dead' && e.st !== 'dying' && e.st !== 'gone';
  // какой кадр мутанта показать сейчас
  function enemyFrame(e) {
    const n = e.def.name, has = f => !!TEX[n + '-' + f];
    if (e.st === 'dead') return n + '-dead';
    if (e.st === 'dying') return n + '-dying';
    if ((e.wind > 0 || e.atk > 0) && has('attack')) return n + '-attack';
    if ((e.pain > 0 || e.stag > 0) && has('pain')) return n + '-pain';
    if (has('walk1')) {
      if (e.st === 'chase' && e.mv > 0.2) return n + (Math.sin(e.phase) >= 0 ? '-walk1' : '-walk2');
      return n + '-walk1';
    }
    return n + '-walk';
  }

  function startLevel(n, player) {
    const L = LEVELS[n];
    const rows = L.map;
    const MH = rows.length, MW = rows[0].length;
    const cells = new Uint8Array(MW * MH); // 0 пусто, 1 стена, 2 дверь, 3 красная дверь, 4 выход
    const wtex = new Array(MW * MH).fill(null);
    const doors = new Map();
    const enemies = [], items = [];
    let px = 1.5, py = 1.5;
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const ch = rows[y][x] || '#', i = y * MW + x;
        if (WALLTEX[ch]) { cells[i] = 1; wtex[i] = WALLTEX[ch]; }
        else if (ch === 'D' || ch === 'L') { cells[i] = ch === 'D' ? 2 : 3; doors.set(i, { open: 0, dir: 0, timer: 0 }); }
        else if (ch === 'X') { cells[i] = 4; }
        else if (ch === 'P') { px = x + 0.5; py = y + 0.5; }
        else if (ENEMY[ch]) {
          const e = ENEMY[ch];
          enemies.push({ kind: ch, def: e, x: x + 0.5, y: y + 0.5, hp: e.hp, st: 'idle', t: 0, cd: 1 + rnd(), flash: 0, anim: rnd() * 6, see: 0, seeT: 0, kx: 0, ky: 0, stun: 0,
            phase: rnd() * 6, mv: 0, atk: 0, pain: 0, painDir: 1, seed: rnd() * 100, growlT: 2 + rnd() * 6, stepS: 0, pauseT: 0 });
        } else if (ITEM[ch]) items.push({ kind: ch, x: x + 0.5, y: y + 0.5 });
      }
    }
    // высоты пола и потолка
    const fh = new Float32Array(MW * MH), chh = new Float32Array(MW * MH).fill(1);
    for (const zn of (L.zones || [])) {
      const [x0, y0, x1, y1] = zn.r;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (zn.f !== undefined) fh[y * MW + x] = zn.f;
        if (zn.c !== undefined) chh[y * MW + x] = zn.c;
      }
    }
    // лифты: пол двигается между lo и hi
    const lifts = new Map();
    for (const l of (L.lifts || [])) {
      const h = l.start === 'lo' ? l.lo : l.hi;
      lifts.set(l.y * MW + l.x, { x: l.x, y: l.y, lo: l.lo, hi: l.hi, h, target: h });
    }
    const fAt = (x, y) => { const i = Math.floor(y) * MW + Math.floor(x), l = lifts.get(i); return l ? l.h : fh[i]; };
    enemies.forEach(e => { e.z = fAt(e.x, e.y); e.vz = 0; e.enemy = true; });
    items.forEach(it => { it.z = fAt(it.x, it.y); });
    // светильники: примерно по одному на 3–4 клетки
    const lamps = [];
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      if (cells[y * MW + x] !== 0) continue;
      if (lamps.some(l => Math.hypot(l.x - x - 0.5, l.y - y - 0.5) < 3.3)) continue;
      const red = rnd() < L.red;
      lamps.push({ x: x + 0.5, y: y + 0.5, col: red ? [1.1, 0.22, 0.18] : L.lamp, r: L.lampR, flick: rnd() < 0.2, ph: rnd() * 100 });
    }
    // на дне глубоких ям светятся кристаллы — зелёный свет снизу
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      const i = y * MW + x;
      if (cells[i] !== 0 || fh[i] > -0.99 || lifts.has(i)) continue;
      if (lamps.some(l => l.floor && Math.hypot(l.x - x - 0.5, l.y - y - 0.5) < 2.2)) continue;
      lamps.push({ x: x + 0.5, y: y + 0.5, col: [0.35, 1.25, 0.45], r: 3.2, flick: false, ph: rnd() * 100, floor: true, fy: fh[i] + 0.3 });
    }
    G = {
      n, MW, MH, cells, wtex, doors, enemies, items, shots: [], puffs: [], lamps,
      fh, ch: chh, lifts,
      parts: [], decals: [], lights: [],
      px, py, dirX: 1, dirY: 0, planeX: 0, planeY: PLANE, pitch: 0,
      pz: fAt(px, py), vz: 0, camZ: fAt(px, py),
      p: player || newPlayer(),
      wpTimer: 0, wpFrame: -1, wpSeq: 0, wpSwitch: 0, wpNext: -1,
      bob: 0, moving: 0, flashHurt: 0, flashPick: 0, muzzle: 0, shake: 0, deadT: 0, finT: 0, slowT: 0, stagHint: false,
      face: { look: 0, lookT: 1, mode: '', modeT: 0, hold: 0, calm: false },
      msg: '', msgT: 0, time: 0, kills: 0, total: enemies.length, found: 0, totalItems: items.length
    };
    G.p.key = false;
    if (gl3d) GL.build(G);
    say(L.name, 3);
  }

  function say(text, sec) { if (G) { G.msg = text; G.msgT = sec || 2.2; } }

  // ---------- карта ----------
  function cellAt(x, y) {
    if (x < 0 || y < 0 || x >= G.MW || y >= G.MH) return 1;
    return G.cells[y * G.MW + x];
  }
  function solidAt(x, y) {
    const c = cellAt(x, y);
    if (c === 0) return false;
    if (c === 2 || c === 3) return G.doors.get(y * G.MW + x).open < 0.9;
    return true;
  }
  const wallAt = (x, y) => { const c = cellAt(x, y); return c === 1 || c === 4; };
  // высота пола и потолка клетки (лифт — текущая высота платформы)
  function floorAt(x, y) {
    if (x < 0 || y < 0 || x >= G.MW || y >= G.MH) return 99;
    const i = y * G.MW + x, l = G.lifts.get(i);
    return l ? l.h : G.fh[i];
  }
  function ceilAt(x, y) {
    if (x < 0 || y < 0 || x >= G.MW || y >= G.MH) return -99;
    return G.ch[y * G.MW + x];
  }
  const floorP = (x, y) => floorAt(Math.floor(x), Math.floor(y));
  const STEP = 0.45;   // на сколько можно шагнуть вверх
  // можно ли встать в клетку, находясь на высоте z (мутанты не прыгают в глубокие ямы)
  function passable(cx, cy, z, enemy) {
    if (solidAt(cx, cy)) return false;
    if (z === undefined) return true;
    const f = floorAt(cx, cy);
    if (f - z > STEP) return false;
    if (enemy && z - f > 1.1) return false;
    if (ceilAt(cx, cy) - Math.max(f, z) < 0.7) return false;
    return true;
  }
  function blocked(x, y, r, z, enemy) {
    return !passable(Math.floor(x - r), Math.floor(y - r), z, enemy) || !passable(Math.floor(x + r), Math.floor(y - r), z, enemy) ||
      !passable(Math.floor(x - r), Math.floor(y + r), z, enemy) || !passable(Math.floor(x + r), Math.floor(y + r), z, enemy);
  }
  function moveBody(o, dx, dy, r) {
    if (!blocked(o.x + dx, o.y, r, o.z, o.enemy)) o.x += dx;
    if (!blocked(o.x, o.y + dy, r, o.z, o.enemy)) o.y += dy;
  }
  // падение и шаги вверх: тело встаёт на пол клетки под собой
  function settle(o, dt) {
    const f = floorP(o.x, o.y);
    if (o.z > f + 0.001) {
      o.vz -= 12 * dt;
      o.z += o.vz * dt;
      if (o.z <= f) { const v = o.vz; o.z = f; o.vz = 0; return v; }
    } else { o.z = f; o.vz = 0; }
    return 0;
  }
  // видно ли точку b из точки a — с учётом стен, полов и потолков
  function sight(ax, ay, bx, by, az, bz) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 0.1);
    for (let i = 1; i < n; i++) {
      const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
      const cx = Math.floor(x), cy = Math.floor(y);
      if (solidAt(cx, cy)) return false;
      if (az !== undefined) {
        const z = az + (bz - az) * i / n;
        if (z < floorAt(cx, cy) || z > ceilAt(cx, cy)) return false;
      }
    }
    return true;
  }
  // луч выстрела в 3D: стены, двери, ступени, пол и потолок. slope — наклон (тангенс угла)
  function trace3D(ox, oy, oz, dx, dy, slope) {
    let mx = Math.floor(ox), my = Math.floor(oy);
    const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy);
    const stx = dx < 0 ? -1 : 1, sty = dy < 0 ? -1 : 1;
    let sdx = dx < 0 ? (ox - mx) * ddx : (mx + 1 - ox) * ddx;
    let sdy = dy < 0 ? (oy - my) * ddy : (my + 1 - oy) * ddy;
    let t = 0;
    for (let s = 0; s < 80; s++) {
      const tn = Math.min(sdx, sdy);
      // внутри текущей клетки: пол или потолок
      const f = floorAt(mx, my), c = ceilAt(mx, my);
      if (slope < 0) { const tf = (f - oz) / slope; if (tf >= t - 1e-6 && tf <= tn) return { d: tf, n: [0, 1, 0], y: f, door: false }; }
      if (slope > 0) { const tc = (c - oz) / slope; if (tc >= t - 1e-6 && tc <= tn) return { d: tc, n: [0, -1, 0], y: c, door: false }; }
      let side;
      if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
      t = tn;
      const nrm = [side === 0 ? -stx : 0, 0, side === 1 ? -sty : 0];
      const cell = cellAt(mx, my);
      if (cell === 2 || cell === 3) {
        const dr = G.doors.get(my * G.MW + mx);
        let d, w;
        if (side === 0) { d = (mx - ox + (1 - stx) / 2 + stx * 0.5) / dx; w = oy + d * dy - my; }
        else { d = (my - oy + (1 - sty) / 2 + sty * 0.5) / dy; w = ox + d * dx - mx; }
        if (w >= 0 && w < 1 && w >= dr.open) return { d, n: nrm, y: oz + slope * d, door: true };
      } else if (cell) return { d: t, n: nrm, y: oz + slope * t, door: false };
      // край ступени или нависающий потолок
      const z = oz + slope * t;
      if (z < floorAt(mx, my) || z > ceilAt(mx, my)) return { d: t, n: nrm, y: z, door: false };
    }
    return { d: 40, n: [0, 1, 0], y: oz, door: true };
  }
  // луч по клеткам: расстояние до стены/двери и нормаль поверхности
  function castRay(ox, oy, dx, dy) {
    let mx = Math.floor(ox), my = Math.floor(oy);
    const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy);
    const stx = dx < 0 ? -1 : 1, sty = dy < 0 ? -1 : 1;
    let sdx = dx < 0 ? (ox - mx) * ddx : (mx + 1 - ox) * ddx;
    let sdy = dy < 0 ? (oy - my) * ddy : (my + 1 - oy) * ddy;
    for (let s = 0; s < 80; s++) {
      let side;
      if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
      const c = cellAt(mx, my);
      if (!c) continue;
      if (c === 2 || c === 3) {
        const dr = G.doors.get(my * G.MW + mx);
        let d, w;
        if (side === 0) { d = (mx - ox + (1 - stx) / 2 + stx * 0.5) / dx; w = oy + d * dy - my; }
        else { d = (my - oy + (1 - sty) / 2 + sty * 0.5) / dy; w = ox + d * dx - mx; }
        if (w < 0 || w >= 1 || w < dr.open) continue;
        return { d, nx: side === 0 ? -stx : 0, ny: side === 1 ? -sty : 0, door: true };
      }
      return { d: side === 0 ? sdx - ddx : sdy - ddy, nx: side === 0 ? -stx : 0, ny: side === 1 ? -sty : 0, door: false };
    }
    return { d: 40, nx: 0, ny: 0, door: true };
  }

  // =====================================================================
  //  3D-движок (WebGL)
  // =====================================================================
  const GL = (function () {
    const cv = document.createElement('canvas');
    let gl = null, prog = null, loc = {}, vbo = null, sbo = null;
    const texGL = new Map();
    let stat = [];            // статичные куски уровня: {tex, start, count, emis}
    let dyn = new Float32Array(12 * 6 * 3000), dynN = 0, segs = [];
    const view = new Float32Array(16), proj = new Float32Array(16), mvp = new Float32Array(16);
    const LP = new Float32Array(32), LC = new Float32Array(24);

    const VS = `
attribute vec3 aP; attribute vec2 aT; attribute vec3 aN; attribute vec4 aC;
uniform mat4 uM;
varying vec3 vP; varying vec2 vT; varying vec3 vN; varying vec4 vC;
void main() { vP = aP; vT = aT; vN = aN; vC = aC; gl_Position = uM * vec4(aP, 1.0); }`;
    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vP; varying vec2 vT; varying vec3 vN; varying vec4 vC;
uniform sampler2D uS; uniform sampler2D uAO; uniform vec3 uAmb; uniform vec3 uEye;
uniform vec4 uLP[8]; uniform vec3 uLC[8];
uniform float uFlat; uniform float uBlend; uniform float uFlash; uniform float uFog;
uniform float uBump; uniform vec2 uTexel; uniform float uSpec; uniform vec2 uMap;
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
void main() {
  vec4 c = texture2D(uS, vT);
  // ореолы: просто прибавляем свет
  if (uBlend > 1.5) { if (c.a < 0.01) discard; gl_FragColor = vec4(c.rgb * vC.rgb, c.a * vC.a); return; }
  if (uBlend < 0.5) { if (c.a < 0.5) discard; } else { if (c.a < 0.03) discard; }
  vec3 base = c.rgb * vC.rgb;
  vec3 n = normalize(vN);
  float ao = 1.0;
  if (uBump > 0.5) {
    // рельеф: яркость картинки — как высота; швы и заклёпки становятся объёмными
    bool flr = abs(n.y) > 0.5;
    vec3 T = flr ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), n));
    vec3 B = flr ? vec3(0.0, 0.0, 1.0) : vec3(0.0, -1.0, 0.0);
    float hL = lum(texture2D(uS, vT - vec2(uTexel.x, 0.0)).rgb);
    float hR = lum(texture2D(uS, vT + vec2(uTexel.x, 0.0)).rgb);
    float hU = lum(texture2D(uS, vT - vec2(0.0, uTexel.y)).rgb);
    float hD = lum(texture2D(uS, vT + vec2(0.0, uTexel.y)).rgb);
    n = normalize(n + (T * (hL - hR) + B * (hU - hD)) * 2.4);
    // тени в углах: у пола и потолка, вдоль стен
    if (flr) ao = texture2D(uAO, vP.xz / uMap).r;
    // у стен тень в углах уже «запечена» в цвет вершин
  }
  vec3 V = normalize(uEye - vP);
  vec3 L = uAmb * ao;
  vec3 S = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec3 d = uLP[i].xyz - vP;
    float dist = length(d);
    vec3 ld = d / max(dist, 0.001);
    float att = clamp(1.0 - dist / uLP[i].w, 0.0, 1.0);
    att *= att;
    float nd = mix(max(dot(n, ld), 0.0) * 0.8 + 0.2, 1.0, uFlat);
    L += uLC[i] * att * nd * mix(1.0, ao, 0.6);
    // блик на металле
    if (uSpec > 0.0) S += uLC[i] * att * pow(max(dot(n, normalize(ld + V)), 0.0), 24.0);
  }
  float fd = length(vP - uEye);
  float fog = clamp(1.3 - fd * uFog, 0.08, 1.0);
  vec3 col = base * L * fog + S * uSpec * (0.2 + lum(c.rgb)) * fog * ao;
  float glow = smoothstep(0.12, 0.35, c.g - max(c.r, c.b)) * 0.85;
  // в прозрачном проходе альфа вершины — это прозрачность, а не свечение
  float em = uBlend > 0.5 ? 0.0 : vC.a;
  col = max(col, base * max(em, glow * fog * 1.4));
  col = mix(col, vec3(1.0, 0.96, 0.9), uFlash);
  gl_FragColor = vec4(col, uBlend > 0.5 ? c.a * vC.a : 1.0);
}`;

    function init() {
      try {
        gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }) ||
          cv.getContext('experimental-webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
      } catch (e) { gl = null; }
      if (!gl) return false;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      try {
        prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      } catch (e) { gl = null; return false; }
      gl.useProgram(prog);
      ['aP', 'aT', 'aN', 'aC'].forEach(n => { loc[n] = gl.getAttribLocation(prog, n); });
      ['uM', 'uS', 'uAO', 'uAmb', 'uEye', 'uLP', 'uLC', 'uFlat', 'uBlend', 'uFlash', 'uFog', 'uBump', 'uTexel', 'uSpec', 'uMap'].forEach(n => { loc[n] = gl.getUniformLocation(prog, n); });
      vbo = gl.createBuffer();
      sbo = gl.createBuffer();
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.uniform1i(loc.uS, 0);
      gl.uniform1i(loc.uAO, 1);
      return true;
    }

    // блеск и рельеф для поверхностей уровня: металл блестит сильнее, скала — слабо
    const SPEC = { 'wall-station': 0.9, door: 1.0, locked: 1.0, exit: 0.9, floor: 0.8, ceil: 0.3, 'wall-rock': 0.35, 'wall-window': 0.6 };
    function surface(name, on) {
      const t = TEX[name];
      if (on && t && SPEC[name] !== undefined) {
        gl.uniform1f(loc.uBump, 1); gl.uniform2f(loc.uTexel, 1 / t.w, 1 / t.h); gl.uniform1f(loc.uSpec, SPEC[name]);
      } else { gl.uniform1f(loc.uBump, 0); gl.uniform1f(loc.uSpec, 0); }
    }

    // карта теней в углах для пола и потолка: темнее у стен
    let aoTex = null;
    function buildAO(g) {
      const R = 8, AW = g.MW * R, AH = g.MH * R, data = new Uint8Array(AW * AH);
      const isWall = (x, z) => { const k = (x < 0 || z < 0 || x >= g.MW || z >= g.MH) ? 1 : g.cells[z * g.MW + x]; return k === 1 || k === 4; };
      for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) {
        const x = (i + 0.5) / R, z = (j + 0.5) / R, cx = Math.floor(x), cz = Math.floor(z);
        const f0 = g.fh[cz * g.MW + cx] || 0;
        let d = 1;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const wx = cx + dx, wz = cz + dz;
          // тень и у стены, и у подножия ступени/балкона
          const higher = !isWall(wx, wz) && wx >= 0 && wz >= 0 && wx < g.MW && wz < g.MH && g.fh[wz * g.MW + wx] > f0 + 0.2;
          if (!isWall(wx, wz) && !higher) continue;
          const ex = Math.max(wx - x, 0, x - wx - 1), ez = Math.max(wz - z, 0, z - wz - 1);
          d = Math.min(d, Math.hypot(ex, ez));
        }
        const t = Math.min(1, d / 0.55), s = t * t * (3 - 2 * t);
        data[j * AW + i] = Math.round((0.45 + 0.55 * s) * 255);
      }
      if (!aoTex) aoTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, aoTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, AW, AH, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.activeTexture(gl.TEXTURE0);
    }

    function tex(name) {
      if (texGL.has(name)) return texGL.get(name);
      const t = TEX[name];
      if (!t) return null;
      const id = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, id);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, t.w, t.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(t.px.buffer, t.px.byteOffset, t.px.byteLength));
      const pot = (t.w & (t.w - 1)) === 0 && (t.h & (t.h - 1)) === 0;
      // мягкие картинки (свечение, дымка, капли) сглаживаем, остальное — чёткие пиксели
      const soft = name === 'glow' || name === 'mist' || name === 'drop';
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, soft ? gl.LINEAR : gl.NEAREST);
      if (pot) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, soft ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, soft ? gl.CLAMP_TO_EDGE : gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, soft ? gl.CLAMP_TO_EDGE : gl.REPEAT);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, soft ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      texGL.set(name, id);
      return id;
    }

    // ---- сборка вершин: позиция(3) uv(2) нормаль(3) цвет(4)
    let out = null, outN = 0;
    function v(x, y, z, u, t, nx, ny, nz, r, g, b, a) {
      if ((outN + 1) * 12 > out.length) { const n = new Float32Array(out.length * 2); n.set(out); out = n; }
      const o = outN * 12;
      out[o] = x; out[o + 1] = y; out[o + 2] = z; out[o + 3] = u; out[o + 4] = t;
      out[o + 5] = nx; out[o + 6] = ny; out[o + 7] = nz; out[o + 8] = r; out[o + 9] = g; out[o + 10] = b; out[o + 11] = a;
      outN++;
    }
    // четырёхугольник: A,B — низ (слева, справа), C,D — верх (справа, слева)
    function quad(A, B, C, D, u0, v0, u1, v1, n, c) {
      v(A[0], A[1], A[2], u0, v1, n[0], n[1], n[2], c[0], c[1], c[2], c[3]);
      v(B[0], B[1], B[2], u1, v1, n[0], n[1], n[2], c[0], c[1], c[2], c[3]);
      v(C[0], C[1], C[2], u1, v0, n[0], n[1], n[2], c[0], c[1], c[2], c[3]);
      v(A[0], A[1], A[2], u0, v1, n[0], n[1], n[2], c[0], c[1], c[2], c[3]);
      v(C[0], C[1], C[2], u1, v0, n[0], n[1], n[2], c[0], c[1], c[2], c[3]);
      v(D[0], D[1], D[2], u0, v0, n[0], n[1], n[2], c[0], c[1], c[2], c[3]);
    }
    let building = false, bArr = null;
    const WHITE = [1, 1, 1, 0];

    // ---- статичная геометрия уровня (стены, пол, потолок, светильники)
    // четырёхугольник с разным цветом низа и верха (для теней у пола и потолка)
    function quadV(A, B, C, D, u0, v0, u1, v1, n, cb, ct) {
      v(A[0], A[1], A[2], u0, v1, n[0], n[1], n[2], cb[0], cb[1], cb[2], cb[3]);
      v(B[0], B[1], B[2], u1, v1, n[0], n[1], n[2], cb[0], cb[1], cb[2], cb[3]);
      v(C[0], C[1], C[2], u1, v0, n[0], n[1], n[2], ct[0], ct[1], ct[2], ct[3]);
      v(A[0], A[1], A[2], u0, v1, n[0], n[1], n[2], cb[0], cb[1], cb[2], cb[3]);
      v(C[0], C[1], C[2], u1, v0, n[0], n[1], n[2], ct[0], ct[1], ct[2], ct[3]);
      v(D[0], D[1], D[2], u0, v0, n[0], n[1], n[2], ct[0], ct[1], ct[2], ct[3]);
    }
    // вертикальная грань на краю клетки A (ax, az) со стороны соседа (dx, dz), от высоты y0 до y1.
    // fA, cA — пол и потолок клетки A: возле них грань темнее (тень в углу)
    function edgeFace(ax, az, dx, dz, y0, y1, fA, cA, emis) {
      if (y1 - y0 < 0.001) return;
      let P0, P1, n;
      if (dx === -1) { P0 = [ax, az + 1]; P1 = [ax, az]; n = [1, 0, 0]; }
      else if (dx === 1) { P0 = [ax + 1, az]; P1 = [ax + 1, az + 1]; n = [-1, 0, 0]; }
      else if (dz === -1) { P0 = [ax, az]; P1 = [ax + 1, az]; n = [0, 0, 1]; }
      else { P0 = [ax + 1, az + 1]; P1 = [ax, az + 1]; n = [0, 0, -1]; }
      const AO = y => (0.55 + 0.45 * Math.min(1, Math.max(0, (y - fA) / 0.3))) * (0.75 + 0.25 * Math.min(1, Math.max(0, (cA - y) / 0.18)));
      const cuts = [y0, fA + 0.3, cA - 0.18, y1].filter(t => t >= y0 && t <= y1).sort((a, b) => a - b);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const ya = cuts[i], yb = cuts[i + 1];
        if (yb - ya < 0.001) continue;
        const ka = AO(ya), kb = AO(yb);
        quadV([P0[0], ya, P0[1]], [P1[0], ya, P1[1]], [P1[0], yb, P1[1]], [P0[0], yb, P0[1]], 0, -yb, 1, -ya, n,
          [ka, ka, ka, emis], [kb, kb, kb, emis]);
      }
    }
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    function build(g) {
      const groups = new Map();
      const add = (name, fn) => { if (!groups.has(name)) groups.set(name, []); groups.get(name).push(fn); };
      const L = LEVELS[g.n], MW = g.MW, MH = g.MH;
      const stepTex = L.stepTex || 'wall-station';
      const kind = (x, z) => (x < 0 || z < 0 || x >= MW || z >= MH) ? 1 : g.cells[z * MW + x];
      const isW = (x, z) => { const k = kind(x, z); return k === 1 || k === 4; };
      const lift = (x, z) => g.lifts.get(z * MW + x);
      for (let z = 0; z < MH; z++) for (let x = 0; x < MW; x++) {
        if (isW(x, z)) continue;
        const i = z * MW + x, lf = lift(x, z);
        const fA = lf ? lf.lo : g.fh[i], cA = g.ch[i];
        // пол (у лифта — рисуется отдельно, он движется) и потолок
        if (!lf) {
          const ft = fA <= -0.99 && L.pitTex ? L.pitTex : 'floor';
          add(ft, () => quad([x, fA, z + 1], [x + 1, fA, z + 1], [x + 1, fA, z], [x, fA, z], x, z, x + 1, z + 1, [0, 1, 0], WHITE));
        }
        add('ceil', () => quad([x, cA, z], [x + 1, cA, z], [x + 1, cA, z + 1], [x, cA, z + 1], x, z, x + 1, z + 1, [0, -1, 0], WHITE));
        for (const [dx, dz] of DIRS) {
          const nx = x + dx, nz = z + dz;
          if (isW(nx, nz)) {
            // стена: от пола до потолка этой клетки (у лифта — от нижнего положения)
            const k = kind(nx, nz), name = k === 4 ? 'exit' : (g.wtex[nz * MW + nx] || stepTex);
            const emis = name === 'wall-window' ? 0.55 : k === 4 ? 0.25 : 0;
            add(name, () => edgeFace(x, z, dx, dz, fA, cA, fA, cA, emis));
            continue;
          }
          if (lf || lift(nx, nz)) continue;   // края лифтов рисуются каждый кадр
          const j = nz * MW + nx;
          // ступенька вверх (видна из этой, нижней клетки)
          if (g.fh[j] > fA + 0.001) add(stepTex, () => edgeFace(x, z, dx, dz, fA, g.fh[j], fA, cA, 0));
          // уступ потолка (виден из этой, высокой клетки)
          if (g.ch[j] < cA - 0.001) add(stepTex, () => edgeFace(x, z, dx, dz, g.ch[j], cA, fA, cA, 0));
        }
      }
      for (const l of g.lamps) {
        if (l.floor) continue;   // кристаллы на дне ямы — только свет
        const s = 0.16, ly = g.ch[Math.floor(l.y) * MW + Math.floor(l.x)] - 0.002;
        const c = [l.col[0] > l.col[1] * 2 ? 1 : 0.95, l.col[0] > l.col[1] * 2 ? 0.35 : 0.97, l.col[0] > l.col[1] * 2 ? 0.3 : 0.95, 1];
        add('lamp', () => quad([l.x - s, ly, l.y - s], [l.x + s, ly, l.y - s], [l.x + s, ly, l.y + s], [l.x - s, ly, l.y + s], 0, 0, 1, 1, [0, -1, 0], c));
      }
      building = true;
      bArr = new Float32Array(12 * 6 * 2000);
      out = bArr; outN = 0;
      stat = [];
      for (const [name, list] of groups) {
        const start = outN;
        list.forEach(fn => fn());
        stat.push({ tex: name, start, count: outN - start });
      }
      bArr = out;
      buildAO(g);
      gl.bindBuffer(gl.ARRAY_BUFFER, sbo);
      gl.bufferData(gl.ARRAY_BUFFER, bArr.subarray(0, outN * 12), gl.STATIC_DRAW);
      building = false;
    }

    function seg(name, flat, blend, flash) {
      const l = segs[segs.length - 1];
      if (l && l.tex === name && l.flat === flat && l.blend === blend && l.flash === flash) return;
      segs.push({ tex: name, flat, blend, flash, start: outN, count: 0 });
    }
    function closeSegs() { segs.forEach((s, i) => { s.count = (i + 1 < segs.length ? segs[i + 1].start : outN) - s.start; }); }

    function attribs() {
      const S = 48;
      gl.enableVertexAttribArray(loc.aP); gl.vertexAttribPointer(loc.aP, 3, gl.FLOAT, false, S, 0);
      gl.enableVertexAttribArray(loc.aT); gl.vertexAttribPointer(loc.aT, 2, gl.FLOAT, false, S, 12);
      gl.enableVertexAttribArray(loc.aN); gl.vertexAttribPointer(loc.aN, 3, gl.FLOAT, false, S, 20);
      gl.enableVertexAttribArray(loc.aC); gl.vertexAttribPointer(loc.aC, 4, gl.FLOAT, false, S, 32);
    }

    function perspective(m, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2);
      m.fill(0);
      m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = 2 * far * near / (near - far);
    }
    function lookAt(m, e, c, u) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
      let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
      l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      m[0] = xx; m[1] = yx; m[2] = zx; m[3] = 0;
      m[4] = xy; m[5] = yy; m[6] = zy; m[7] = 0;
      m[8] = xz; m[9] = yz; m[10] = zz; m[11] = 0;
      m[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
      m[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
      m[14] = -(zx * e[0] + zy * e[1] + zz * e[2]);
      m[15] = 1;
    }
    function mul(o, a, b) {
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    }

    function resize(w, h) { cv.width = w; cv.height = h; if (gl) { gl.viewport(0, 0, w, h); postResize(); } }

    // =================== кино-обработка кадра ===================
    // кадр рисуется во внутреннюю текстуру, потом: свечение → цветокоррекция, виньетка, зерно, ранения
    const QVS = `
attribute vec2 aQ; varying vec2 vU;
void main() { vU = aQ * 0.5 + 0.5; gl_Position = vec4(aQ, 0.0, 1.0); }`;
    const HEAD = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vU;`;
    // яркие места, уменьшенные в 4 раза
    const QFS_BRIGHT = HEAD + `
uniform sampler2D uT; uniform vec2 uPx; uniform float uTh;
void main() {
  vec3 c = (texture2D(uT, vU + vec2(-uPx.x, -uPx.y)).rgb + texture2D(uT, vU + vec2(uPx.x, -uPx.y)).rgb +
            texture2D(uT, vU + vec2(-uPx.x, uPx.y)).rgb + texture2D(uT, vU + vec2(uPx.x, uPx.y)).rgb) * 0.25;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(uTh, uTh + 0.3, l), 1.0);
}`;
    // размытие по Гауссу в одну сторону
    const QFS_BLUR = HEAD + `
uniform sampler2D uT; uniform vec2 uDir;
void main() {
  vec3 c = texture2D(uT, vU).rgb * 0.227;
  c += (texture2D(uT, vU + uDir * 1.385).rgb + texture2D(uT, vU - uDir * 1.385).rgb) * 0.316;
  c += (texture2D(uT, vU + uDir * 3.231).rgb + texture2D(uT, vU - uDir * 3.231).rgb) * 0.070;
  gl_FragColor = vec4(c, 1.0);
}`;
    // итог: свечение, цвет, контраст, виньетка, зерно, красные края при ранении, расслоение цвета
    const QFS_FINAL = HEAD + `
uniform sampler2D uT; uniform sampler2D uB;
uniform vec3 uTint; uniform float uSat; uniform float uCon; uniform float uBloom;
uniform float uVig; uniform float uGrain; uniform float uTime; uniform float uHurt; uniform float uLow; uniform float uAb;
void main() {
  vec2 d = vU - 0.5;
  float r = length(d);
  vec2 off = d * (uAb + uHurt * 0.012) * r * 2.0;
  vec3 col = vec3(texture2D(uT, vU + off).r, texture2D(uT, vU).g, texture2D(uT, vU - off).b);
  col += texture2D(uB, vU).rgb * uBloom;
  col *= uTint;
  float l = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(vec3(l), col, uSat * (1.0 - uLow * 0.35));
  col = (col - 0.5) * uCon + 0.5;
  col *= 1.0 - uVig * smoothstep(0.32, 0.78, r);
  float red = clamp(uHurt * 0.9 + uLow * 0.55, 0.0, 0.85) * smoothstep(0.18, 0.72, r);
  col = mix(col, vec3(0.42, 0.0, 0.02), red);
  float n = fract(sin(dot(vU * 917.0 + uTime * 61.3, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * uGrain;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
    let post = null;
    function mkProg(vs, fs) {
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'aQ');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    }
    function mkTarget(w, h, depth) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      let rb = null;
      if (depth) {
        rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      }
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { t, f, rb, w, h, ok };
    }
    function freeTarget(x) { if (!x) return; gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); if (x.rb) gl.deleteRenderbuffer(x.rb); }
    function initPost() {
      try {
        post = { bright: mkProg(QVS, QFS_BRIGHT), blur: mkProg(QVS, QFS_BLUR), fin: mkProg(QVS, QFS_FINAL), quad: gl.createBuffer(), main: null, b1: null, b2: null };
        gl.bindBuffer(gl.ARRAY_BUFFER, post.quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
      } catch (e) { post = null; }
      gl.useProgram(prog);
    }
    function postResize() {
      if (!post) return;
      [post.main, post.b1, post.b2].forEach(freeTarget);
      const w = cv.width, h = cv.height, bw = Math.max(16, w >> 2), bh = Math.max(16, h >> 2);
      post.main = mkTarget(w, h, true); post.b1 = mkTarget(bw, bh, false); post.b2 = mkTarget(bw, bh, false);
      if (!post.main.ok || !post.b1.ok || !post.b2.ok) { [post.main, post.b1, post.b2].forEach(freeTarget); post = null; }
    }
    const postOn = () => !!(post && post.main && saved.post);
    function quadPass(pr, target, setup) {
      gl.useProgram(pr.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
      gl.viewport(0, 0, target ? target.w : cv.width, target ? target.h : cv.height);
      setup(pr.u);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function postProcess(g) {
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
      gl.bindBuffer(gl.ARRAY_BUFFER, post.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      const gr = LEVELS[g.n].grade || { tint: [1, 1, 1], sat: 1, con: 1.05, bloom: 0.9 };
      const m = post.main, b1 = post.b1, b2 = post.b2;
      gl.activeTexture(gl.TEXTURE0);
      // 1. яркое — в маленькую текстуру
      quadPass(post.bright, b1, u => { gl.bindTexture(gl.TEXTURE_2D, m.t); gl.uniform1i(u.uT, 0); gl.uniform2f(u.uPx, 1 / m.w, 1 / m.h); gl.uniform1f(u.uTh, 0.62); });
      // 2. размытие: по горизонтали и по вертикали, дважды — широкое мягкое свечение
      for (let k = 0; k < 2; k++) {
        quadPass(post.blur, b2, u => { gl.bindTexture(gl.TEXTURE_2D, b1.t); gl.uniform1i(u.uT, 0); gl.uniform2f(u.uDir, (1 + k) / b1.w, 0); });
        quadPass(post.blur, b1, u => { gl.bindTexture(gl.TEXTURE_2D, b2.t); gl.uniform1i(u.uT, 0); gl.uniform2f(u.uDir, 0, (1 + k) / b1.h); });
      }
      // 3. итоговый кадр
      const low = g.p.hp < 30 && g.p.hp > 0 ? (0.55 + 0.45 * Math.sin(g.time * 7)) * (1 - g.p.hp / 30) : 0;
      quadPass(post.fin, null, u => {
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, b1.t); gl.uniform1i(u.uB, 1);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.t); gl.uniform1i(u.uT, 0);
        gl.uniform3f(u.uTint, gr.tint[0], gr.tint[1], gr.tint[2]);
        gl.uniform1f(u.uSat, gr.sat); gl.uniform1f(u.uCon, gr.con); gl.uniform1f(u.uBloom, gr.bloom);
        gl.uniform1f(u.uVig, 0.5); gl.uniform1f(u.uGrain, 0.05); gl.uniform1f(u.uTime, g.time % 100);
        gl.uniform1f(u.uHurt, Math.min(1, g.flashHurt)); gl.uniform1f(u.uLow, low); gl.uniform1f(u.uAb, 0.0025);
      });
      // вернуть состояние для обычного рисования
      gl.useProgram(prog);
      gl.enable(gl.DEPTH_TEST);
      gl.activeTexture(gl.TEXTURE0);
    }

    // ---- кадр
    function draw(g, cam) {
      const L = LEVELS[g.n];
      const pp = postOn();
      gl.bindFramebuffer(gl.FRAMEBUFFER, pp ? post.main.f : null);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const f = [g.dirX * cp, sp, g.dirY * cp];
      const e = cam.eye;
      lookAt(view, e, [e[0] + f[0], e[1] + f[1], e[2] + f[2]], [0, 1, 0]);
      const aspect = W / VH;
      perspective(proj, 2 * Math.atan(PLANE * 1.08 / aspect), aspect, 0.02, 60);
      mul(mvp, proj, view);
      gl.uniformMatrix4fv(loc.uM, false, mvp);
      gl.uniform3f(loc.uAmb, L.amb[0], L.amb[1], L.amb[2]);
      gl.uniform3f(loc.uEye, e[0], e[1], e[2]);
      gl.uniform1f(loc.uFog, 0.075);

      // свет: динамический (вспышки, осколки) + ближайшие светильники
      const cand = [];
      for (const l of g.lights) cand.push({ x: l.x, y: l.y, z: l.z, r: l.r, c: l.c, k: l.t / l.t0, s: -10 });
      const t = g.time;
      for (const l of g.lamps) {
        const d = Math.hypot(l.x - e[0], l.y - e[2]);
        if (d > 13) continue;
        let k = 1;
        if (l.flick) { const q = Math.sin(t * 13 + l.ph) + Math.sin(t * 7.3 + l.ph * 2); k = q > 1.2 ? 0.15 : q > 0.6 ? 0.6 : 1; }
        l.kNow = k;
        l.cy = g.ch[Math.floor(l.y) * g.MW + Math.floor(l.x)];
        cand.push({ x: l.x, y: l.floor ? l.fy : l.cy - 0.08, z: l.y, r: l.r, c: l.col, k, s: d });
      }
      cand.sort((a, b) => a.s - b.s);
      LP.fill(0); LC.fill(0);
      for (let i = 0; i < 8; i++) {
        const l = cand[i];
        if (!l) { LP[i * 4 + 3] = 1; continue; }
        LP[i * 4] = l.x; LP[i * 4 + 1] = l.y; LP[i * 4 + 2] = l.z; LP[i * 4 + 3] = l.r;
        LC[i * 3] = l.c[0] * l.k; LC[i * 3 + 1] = l.c[1] * l.k; LC[i * 3 + 2] = l.c[2] * l.k;
      }
      gl.uniform4fv(loc.uLP, LP);
      gl.uniform3fv(loc.uLC, LC);

      // статичная часть уровня
      gl.bindBuffer(gl.ARRAY_BUFFER, sbo);
      attribs();
      gl.uniform1f(loc.uFlat, 0); gl.uniform1f(loc.uBlend, 0); gl.uniform1f(loc.uFlash, 0);
      gl.uniform2f(loc.uMap, g.MW, g.MH);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, aoTex); gl.activeTexture(gl.TEXTURE0);
      for (const s of stat) {
        surface(s.tex, true);
        gl.bindTexture(gl.TEXTURE_2D, tex(s.tex));
        gl.drawArrays(gl.TRIANGLES, s.start, s.count);
      }

      // динамическая часть: двери, спрайты, частицы, следы
      out = dyn; outN = 0; segs = [];
      const rx = -g.dirY, rz = g.dirX;                       // вправо по горизонтали
      const ux = view[1], uy = view[5], uz = view[9];          // «вверх» камеры
      const qx = view[0], qy = view[4], qz = view[8];          // «вправо» камеры
      // двери
      for (const [i, d] of g.doors) {
        const cx = i % g.MW, cz = (i / g.MW) | 0;
        const name = g.cells[i] === 2 ? 'door' : 'locked';
        seg(name, 0, 0, 0);
        const o = d.open, f = g.fh[i], c = g.ch[i];
        if (wallAt(cx - 1, cz) && wallAt(cx + 1, cz)) {
          const z = cz + 0.5;
          quad([cx + o, f, z], [cx + 1 + o, f, z], [cx + 1 + o, c, z], [cx + o, c, z], 0, f - c, 1, 0, [0, 0, 1], WHITE);
        } else {
          const x = cx + 0.5;
          quad([x, f, cz + 1 + o], [x, f, cz + o], [x, c, cz + o], [x, c, cz + 1 + o], 0, f - c, 1, 0, [1, 0, 0], WHITE);
        }
      }
      // лифты: платформа и её борта
      for (const l of g.lifts.values()) {
        const x = l.x, z = l.y, h = l.h, cA = g.ch[z * g.MW + x];
        seg('floor', 0, 0, 0);
        quad([x, h, z + 1], [x + 1, h, z + 1], [x + 1, h, z], [x, h, z], x, z, x + 1, z + 1, [0, 1, 0], [1, 0.88, 0.55, 0]);
        for (const [dx, dz] of DIRS) {
          const nx = x + dx, nz = z + dz;
          if (wallAt(nx, nz) || nx < 0 || nz < 0 || nx >= g.MW || nz >= g.MH) continue;
          const fN = floorAt(nx, nz), cN = g.ch[nz * g.MW + nx];
          // борт лифта виден снизу — полосатый, как у дверей
          if (fN < h) { seg('door', 0, 0, 0); edgeFace(nx, nz, -dx, -dz, fN, h, fN, cN, 0); }
          // соседний пол выше платформы — ступень видна с лифта
          else if (fN > h) { seg(LEVELS[g.n].stepTex || 'wall-station', 0, 0, 0); edgeFace(x, z, dx, dz, h, fN, h, cA, 0); }
        }
      }
      // спрайты на полу: предметы, враги, трупы
      const sprite = (name, x, z, h, lift, mirror, flash, emis) => {
        const tt = TEX[name]; if (!tt) return;
        const w2 = h * tt.w / tt.h / 2;
        seg(name, 1, 0, flash ? 0.65 : 0);
        const u0 = mirror ? 1 : 0, u1 = mirror ? 0 : 1;
        const c = [1, 1, 1, emis || 0];
        quad([x - rx * w2, lift, z - rz * w2], [x + rx * w2, lift, z + rz * w2], [x + rx * w2, lift + h, z + rz * w2], [x - rx * w2, lift + h, z - rz * w2], u0, 0, u1, 1, [0, 1, 0], c);
      };
      // мутант: картинка натянута на сетку, и сетка гнётся — шаги, руки, дыхание, рывок, боль
      const enemyMesh = (en, name, h, aspect, real) => {
        const w = h * aspect;
        const stag = en.stag > 0;
        // оглушённый мутант мерцает — подсказка, что его можно добить
        seg(name, 1, 0, en.flash > 0 ? 0.65 : stag ? 0.12 + 0.12 * Math.sin(g.time * 9) : 0);
        const isTech = en.kind === 't';
        const ph = en.phase, mv = en.mv;
        // на настоящих кадрах ходьбы ноги и руки уже нарисованы — сгибаем совсем чуть-чуть
        const mvL = real ? mv * 0.25 : mv;
        const sP = Math.sin(ph), cP = Math.cos(ph);
        const atk = en.atk > 0 ? Math.sin((1 - en.atk / 0.32) * Math.PI) : 0;
        const pain = en.pain > 0 ? Math.sin(en.pain / 0.28 * Math.PI) : 0;
        const idle = en.st === 'idle';
        const breathe = Math.sin(g.time * (idle ? 1.6 : 2.6) + en.seed) * (idle ? 0.014 : 0.01);
        const sway = Math.sin(g.time * 0.7 + en.seed) * (idle ? 0.02 : 0);
        const hipY = isTech ? 0.56 : 0.58;     // где кончается корпус и начинаются ноги (доля высоты сверху)
        const bounce = Math.abs(cP) * mv * (isTech ? 0.025 : 0.035) * h;
        const P = (u, v) => {
          let lx = (u - 0.5) * w, ly = (1 - v) * h;
          const side = u < 0.5 ? 1 : -1;
          const top = Math.max(0, (hipY - v) / hipY);           // 0 у бёдер … 1 у макушки
          if (v > hipY) {
            // ноги: поочерёдно поднимаются и сгибаются
            const k = (v - hipY) / (1 - hipY);
            const lift = Math.max(0, side * sP) * mvL;
            ly += lift * (isTech ? 0.1 : 0.08) * h * k;
            lx -= side * lift * 0.025 * h * k;
          } else {
            ly += bounce * (0.4 + 0.6 * top);
          }
          // корпус переваливается над опорной ногой
          lx += sP * mv * (isTech ? 0.05 : 0.03) * h * (0.3 + top);
          // техник ещё и заваливается вбок, как будто одна нога не слушается
          if (isTech) lx += Math.sin(ph * 0.5 + 1) * mv * 0.03 * h * top;
          // руки болтаются в такт шагам
          const armZone = Math.abs(u - 0.5) > 0.27 && v > 0.2 && v < 0.68;
          if (armZone) {
            const a = (v - 0.2) / 0.48;
            lx += side * Math.sin(ph + (u < 0.5 ? 0 : Math.PI)) * mvL * 0.035 * h * a;
            ly += Math.cos(ph * 2) * mvL * 0.01 * h * a;
          }
          // дыхание и покачивание на месте
          ly += breathe * h * top;
          lx += sway * h * top;
          // атака: рывок — верх раздувается и подаётся вниз-вперёд
          if (atk) { lx *= 1 + atk * 0.16 * top; ly -= atk * 0.06 * h * top; }
          // попадание: дёргается вбок и назад
          if (pain) { lx += pain * 0.07 * h * top * en.painDir; ly += pain * 0.025 * h * top; }
          // оглушён: шатается и оседает
          if (stag) {
            lx += Math.sin(g.time * 4 + en.seed) * 0.09 * h * top;
            ly -= (0.06 + Math.sin(g.time * 7) * 0.015) * h * top;
            if (v > hipY) lx += Math.sin(g.time * 4 + en.seed + 1) * 0.03 * h * ((v - hipY) / (1 - hipY));
          }
          return [en.x + rx * lx, ly + en.z, en.y + rz * lx];
        };
        const C = 5, R = 10;
        const c = [1, 1, 1, 0];
        for (let r = 0; r < R; r++) {
          const v0 = r / R, v1 = (r + 1) / R;
          for (let q = 0; q < C; q++) {
            const u0 = q / C, u1 = (q + 1) / C;
            quad(P(u0, v1), P(u1, v1), P(u1, v0), P(u0, v0), u0, v0, u1, v1, [0, 1, 0], c);
          }
        }
      };
      for (const it of g.items) { const d = ITEM[it.kind], tt = TEX[d.tex]; if (tt) sprite(d.tex, it.x, it.y, tt.h * d.upp, it.z, false, false, it.kind === 'k' ? 0.4 : 0); }
      for (const en of g.enemies) {
        if (en.st === 'gone') continue;
        const name = enemyFrame(en);
        const tt = TEX[name]; if (!tt) continue;
        if (alive(en)) enemyMesh(en, name, tt.h * en.def.upp, tt.w / tt.h, !name.endsWith('-walk'));
        else sprite(name, en.x, en.y, tt.h * en.def.upp, en.z, false, en.flash > 0, 0);
      }
      // частицы и осколки — повёрнуты к камере
      const bill = (name, x, y, z, s, c, u0, v0, u1, v1) => {
        seg(name, 1, 0, 0);
        quad([x - qx * s - ux * s, y - qy * s - uy * s, z - qz * s - uz * s],
          [x + qx * s - ux * s, y + qy * s - uy * s, z + qz * s - uz * s],
          [x + qx * s + ux * s, y + qy * s + uy * s, z + qz * s + uz * s],
          [x - qx * s + ux * s, y - qy * s + uy * s, z - qz * s + uz * s],
          u0, v0, u1, v1, [0, 1, 0], c);
      };
      for (const s of g.shots) bill('shard', s.x, s.z, s.y, 0.07, [1, 1, 1, 1], 0, 0, 1, 1);
      for (const p of g.parts) if (!p.blend) bill(p.tex, p.x, p.y, p.z, p.s, p.c, p.u0, p.v0, p.u1, p.v1);
      const opaqueEnd = segs.length;
      // следы: кровь и дырки от пуль (полупрозрачные, прижаты к поверхности)
      for (const dc of g.decals) {
        seg(dc.tex, 0, 1, 0);
        const s = dc.s, sy = dc.s * (dc.ar || 1), tx = dc.t, bx = dc.b, n = dc.n;
        const P = (a, b) => [dc.x + tx[0] * a * s + bx[0] * b * sy, dc.y + tx[1] * a * s + bx[1] * b * sy, dc.z + tx[2] * a * s + bx[2] * b * sy];
        // на стене верх картинки — вверху (потёки вниз)
        if (n[1] === 0) quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), 0, 0, 1, 1, n, dc.c);
        else quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), 0, 0, 1, 1, n, dc.c);
      }
      const decalEnd = segs.length;
      // летящая кровь: мягкие капли, вытянутые по направлению полёта, и дымка
      const ex = cam.eye[0], ey = cam.eye[1], ez = cam.eye[2];
      for (const p of g.parts) {
        if (!p.blend) continue;
        seg(p.tex, 1, 1, 0);
        const c = [p.c[0], p.c[1], p.c[2], p.a];
        const sp = Math.hypot(p.vx, p.vy, p.vz);
        if (p.kind === 'blood' && sp > 0.8) {
          const dx = p.vx / sp, dy = p.vy / sp, dz = p.vz / sp;
          let wx = p.x - ex, wy = p.y - ey, wz = p.z - ez;
          // поперечная ось: перпендикулярно полёту и взгляду
          let sx = dy * wz - dz * wy, sy2 = dz * wx - dx * wz, sz = dx * wy - dy * wx;
          const sl = Math.hypot(sx, sy2, sz) || 1; sx /= sl; sy2 /= sl; sz /= sl;
          const L = p.s + Math.min(0.06, sp * 0.009), Wd = p.s;
          quad([p.x - dx * L - sx * Wd, p.y - dy * L - sy2 * Wd, p.z - dz * L - sz * Wd],
            [p.x - dx * L + sx * Wd, p.y - dy * L + sy2 * Wd, p.z - dz * L + sz * Wd],
            [p.x + dx * L + sx * Wd, p.y + dy * L + sy2 * Wd, p.z + dz * L + sz * Wd],
            [p.x + dx * L - sx * Wd, p.y + dy * L - sy2 * Wd, p.z + dz * L - sz * Wd],
            0, 0, 1, 1, [0, 1, 0], c);
        } else {
          const s = p.s;
          quad([p.x - qx * s - ux * s, p.y - qy * s - uy * s, p.z - qz * s - uz * s],
            [p.x + qx * s - ux * s, p.y + qy * s - uy * s, p.z + qz * s - uz * s],
            [p.x + qx * s + ux * s, p.y + qy * s + uy * s, p.z + qz * s + uz * s],
            [p.x - qx * s + ux * s, p.y - qy * s + uy * s, p.z - qz * s + uz * s],
            0, 0, 1, 1, [0, 1, 0], c);
        }
      }
      // ореолы света (складываются со светом сцены)
      const glowStart = segs.length;
      const glow = (x, y, z, s, r, gg, b) => {
        seg('glow', 1, 2, 0);
        quad([x - qx * s - ux * s, y - qy * s - uy * s, z - qz * s - uz * s],
          [x + qx * s - ux * s, y + qy * s - uy * s, z + qz * s - uz * s],
          [x + qx * s + ux * s, y + qy * s + uy * s, z + qz * s + uz * s],
          [x - qx * s + ux * s, y - qy * s + uy * s, z - qz * s + uz * s],
          0, 0, 1, 1, [0, 1, 0], [r, gg, b, 1]);
      };
      for (const l of g.lamps) {
        if (Math.hypot(l.x - ex, l.y - ez) > 14) continue;
        const k = l.kNow === undefined ? 1 : l.kNow;
        if (l.floor) { glow(l.x, l.fy - 0.15, l.y, 0.7, 0.1, 0.35, 0.13); continue; }
        const cy = l.cy || 1;
        glow(l.x, cy - 0.03, l.y, 0.26, l.col[0] * 0.55 * k, l.col[1] * 0.55 * k, l.col[2] * 0.55 * k);
        glow(l.x, cy - 0.1, l.y, 0.7, l.col[0] * 0.12 * k, l.col[1] * 0.12 * k, l.col[2] * 0.12 * k);
      }
      for (const s of g.shots) glow(s.x, s.z, s.y, 0.2, 0.25, 0.9, 0.35);
      let nCr = 0;
      for (const p of g.parts) if (p.kind === 'crystal' && nCr++ < 80) glow(p.x, p.y, p.z, 0.06, 0.15, 0.55, 0.2);
      for (const l of g.lights) { const k = l.t / l.t0; glow(l.x, l.y, l.z, l.r * 0.16, l.c[0] * 0.25 * k, l.c[1] * 0.25 * k, l.c[2] * 0.25 * k); }
      if (g.muzzle > 0) {
        const m = g.muzzle;
        glow(ex + f[0] * 0.55 + rx * 0.05, ey - 0.07 + f[1] * 0.55, ez + f[2] * 0.55 + rz * 0.05, 0.35 * m, 0.9 * m, 0.6 * m, 0.25 * m);
      }
      // зелёный свет шлюза
      for (let z = 0; z < g.MH; z++) for (let x = 0; x < g.MW; x++) {
        if (g.cells[z * g.MW + x] !== 4) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = g.cells[(z + dz) * g.MW + x + dx];
          if (k !== 0 || Math.hypot(x + 0.5 - ex, z + 0.5 - ez) > 12) continue;
          glow(x + 0.5 + dx * 0.56, g.fh[(z + dz) * g.MW + x + dx] + 0.55, z + 0.5 + dz * 0.56, 0.55, 0.1, 0.4, 0.15);
        }
      }
      closeSegs();
      dyn = out;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, dyn.subarray(0, outN * 12), gl.DYNAMIC_DRAW);
      attribs();
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (!s.count) continue;
        if (i === opaqueEnd) {
          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.depthMask(false);
          gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4);
        }
        if (i === decalEnd) gl.disable(gl.POLYGON_OFFSET_FILL);
        if (i === glowStart) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.uniform1f(loc.uFlat, s.flat); gl.uniform1f(loc.uBlend, s.blend); gl.uniform1f(loc.uFlash, s.flash);
        surface(s.tex, s.flat === 0 && s.blend === 0);
        gl.bindTexture(gl.TEXTURE_2D, tex(s.tex));
        gl.drawArrays(gl.TRIANGLES, s.start, s.count);
      }
      gl.disable(gl.BLEND); gl.depthMask(true); gl.disable(gl.POLYGON_OFFSET_FILL);
      if (pp) postProcess(g);
    }

    return { init: () => { const ok = init(); if (ok) initPost(); return ok; }, build, draw, resize, canvas: cv, ok: () => !!gl, postOn: () => !!gl && gl3d && postOn() };
  })();

  let gl3d = false; // рисуем через видеокарту?
  let K = 1;        // во сколько раз чётче логического экрана 320×240

  function applyQuality() {
    gl3d = saved.gl && GL.ok();
    K = gl3d ? saved.q : 1;
    canvas.width = W * K; canvas.height = H * K;
    if (gl3d) { GL.resize(W * K, VH * K); if (G) GL.build(G); }
  }

  // =====================================================================
  //  запасной рендер (процессор, лучи)
  // =====================================================================
  function fog(d) {
    const f = 1.25 - d * 0.085 + G.muzzle * 0.35;
    return (Math.max(0.16, Math.min(1, f)) * 256) | 0;
  }
  function shade(c, f) {
    const r = ((c & 255) * f) >> 8, g = (((c >> 8) & 255) * f) >> 8, b = (((c >> 16) & 255) * f) >> 8;
    return 0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
  }
  function renderSoft() {
    const { px, py, dirX, dirY, planeX, planeY } = G;
    const fl = TEX.floor, ce = TEX.ceil, FW = fl.w;
    const rdx0 = dirX - planeX, rdy0 = dirY - planeY, rdx1 = dirX + planeX, rdy1 = dirY + planeY;
    const half = VH / 2;
    for (let y = half + 1; y < VH; y++) {
      const rowDist = half / (y - half);
      const sx = rowDist * (rdx1 - rdx0) / W, sy = rowDist * (rdy1 - rdy0) / W;
      let fx = px + rowDist * rdx0, fy = py + rowDist * rdy0;
      const f = fog(rowDist), fc = (f * 0.8) | 0;
      const ro = y * W, rc = (VH - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const tx = ((fx - Math.floor(fx)) * FW) & (FW - 1), ty = ((fy - Math.floor(fy)) * FW) & (FW - 1);
        const k = ty * FW + tx;
        buf[ro + x] = shade(fl.px[k], f);
        buf[rc + x] = shade(ce.px[k], fc);
        fx += sx; fy += sy;
      }
    }
    buf.fill(0xff000000, (half - 1) * W, (half + 1) * W);
    for (let x = 0; x < W; x++) {
      const cam = 2 * x / W - 1;
      const rdx = dirX + planeX * cam, rdy = dirY + planeY * cam;
      let mx = Math.floor(px), my = Math.floor(py);
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      const stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
      let sdx = rdx < 0 ? (px - mx) * ddx : (mx + 1 - px) * ddx;
      let sdy = rdy < 0 ? (py - my) * ddy : (my + 1 - py) * ddy;
      let side = 0, dist = 30, u = 0, tex = null, hit = false;
      for (let s = 0; s < 64 && !hit; s++) {
        if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
        const c = cellAt(mx, my);
        if (!c) continue;
        if (c === 2 || c === 3) {
          const dr = G.doors.get(my * G.MW + mx);
          let d, w;
          if (side === 0) { d = (mx - px + (1 - stx) / 2 + stx * 0.5) / rdx; w = py + d * rdy - my; }
          else { d = (my - py + (1 - sty) / 2 + sty * 0.5) / rdy; w = px + d * rdx - mx; }
          if (w < 0 || w >= 1 || w < dr.open) continue;
          dist = d; u = w - dr.open; tex = c === 2 ? TEX.door : TEX.locked; hit = true;
        } else {
          dist = side === 0 ? sdx - ddx : sdy - ddy;
          u = side === 0 ? py + dist * rdy : px + dist * rdx;
          u -= Math.floor(u);
          tex = c === 4 ? TEX.exit : TEX[G.wtex[my * G.MW + mx]];
          if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) u = 1 - u;
          hit = true;
        }
      }
      if (dist < 0.05) dist = 0.05;
      zbuf[x] = dist;
      if (!tex) continue;
      const lineH = VH / dist;
      const top = half - lineH / 2;
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(VH - 1, Math.floor(top + lineH));
      const tw = tex.w, th = tex.h;
      const tx = Math.min(tw - 1, (u * tw) | 0);
      const step = th / lineH;
      let tp = (y0 - top) * step;
      let f = fog(dist);
      if (side === 1) f = (f * 0.8) | 0;
      if (tex === TEX['wall-window']) f = Math.max(f, 150);
      for (let y = y0; y <= y1; y++) {
        const ty = Math.min(th - 1, tp | 0);
        buf[y * W + x] = shade(tex.px[ty * tw + tx], f);
        tp += step;
      }
    }
    const list = [];
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const add = (x, y, tex, worldH, opt) => {
      const dx = x - px, dy = y - py;
      const ty = invDet * (-planeY * dx + planeX * dy);
      if (ty <= 0.12 || !tex) return;
      list.push({ tx: invDet * (dirY * dx - dirX * dy), ty, tex, worldH, opt });
    };
    for (const it of G.items) { const d = ITEM[it.kind], t = TEX[d.tex]; if (t) add(it.x, it.y, t, t.h * d.upp, null); }
    for (const e of G.enemies) {
      if (e.st === 'gone') continue;
      const fname = enemyFrame(e);
      const fr = fname.slice(e.def.name.length + 1);
      const t = TEX[fname];
      if (!t) continue;
      let bob = 0, sq = 1;
      if (fr === 'walk' && e.st === 'chase') { bob = Math.abs(Math.sin(e.anim * 5)) * 0.03; sq = 1 + Math.sin(e.anim * 10) * 0.02; }
      add(e.x, e.y, t, t.h * e.def.upp * sq, { flash: e.flash, lift: bob, mirror: fr === 'walk' && e.def.name === 'tech' && Math.sin(e.anim * 5) < 0 && e.st === 'chase' });
    }
    for (const s of G.shots) add(s.x, s.y, TEX.shard, 0.16, { lift: 0.32, glow: true });
    for (const p of G.puffs) add(p.x, p.y, TEX.puff, 0.08 * (1 + (0.25 - p.t) * 4), { lift: 0.42, glow: true });
    list.sort((a, b) => b.ty - a.ty);
    for (const s of list) drawSpriteSoft(s);
  }
  function drawSpriteSoft(s) {
    const { tex, ty, worldH } = s, o = s.opt || {};
    const sx = (W / 2) * (1 + s.tx / ty);
    const hPx = worldH * VH / ty;
    const wPx = hPx * tex.w / tex.h;
    const floorY = VH / 2 + (VH / 2) / ty;
    const top = floorY - hPx - (o.lift || 0) * VH / ty;
    const left = sx - wPx / 2;
    const x0 = Math.max(0, Math.ceil(left)), x1 = Math.min(W - 1, Math.floor(left + wPx));
    const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(VH - 1, Math.floor(top + hPx));
    if (x0 > x1 || y0 > y1) return;
    const f = o.glow ? 256 : fog(ty);
    const flash = o.flash > 0;
    for (let x = x0; x <= x1; x++) {
      if (ty >= zbuf[x]) continue;
      let u = (((x - left) / wPx) * tex.w) | 0;
      if (u >= tex.w) u = tex.w - 1;
      if (o.mirror) u = tex.w - 1 - u;
      for (let y = y0; y <= y1; y++) {
        let v = (((y - top) / hPx) * tex.h) | 0;
        if (v >= tex.h) v = tex.h - 1;
        const c = tex.px[v * tex.w + u];
        if ((c >>> 24) < 128) continue;
        buf[y * W + x] = flash ? shade(c, 420) : shade(c, f);
      }
    }
  }

  // =====================================================================
  //  оружие, вспышки, панель (поверх картинки)
  // =====================================================================
  function drawOverlay() {
    const w = WEAPONS[G.p.weapon];
    let base = w.id;
    let frame = 'idle';
    if (G.wpFrame >= 0) frame = w.frames[G.wpFrame][0];
    // добивание: на миг в руке лом, какое бы оружие ни было
    if (G.finT > 0) { base = 'crowbar'; frame = G.finT > 0.2 ? 'raise' : 'hit'; }
    const im = IMG[base + '-' + frame] || IMG[base + '-idle'];
    const idle = IMG[base + '-idle'];
    if (base === 'crowbar' && im && state !== 'dead') {
      const m = (META.crowbar && META.crowbar[frame]) || { dx: -im.width / 2, dy: -im.height };
      const bx = Math.sin(G.bob) * 5 * G.moving, by = Math.abs(Math.cos(G.bob)) * 5 * G.moving;
      const sw = G.wpSwitch > 0 ? (G.wpSwitch > 0.15 ? (0.3 - G.wpSwitch) : G.wpSwitch) / 0.15 * 110 : 0;
      ctx.imageSmoothingEnabled = false;
      // след от взмаха
      if (frame === 'hit') {
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = 'rgba(230,230,220,' + (0.22 - i * 0.05) + ')';
          ctx.lineWidth = 6 - i;
          ctx.beginPath();
          ctx.arc(W / 2 + 60, VH + 40, 150 - i * 9, Math.PI * 1.08, Math.PI * 1.42);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.drawImage(im, Math.round(W / 2 + m.dx + bx), Math.round(VH + m.dy + by + sw + (frame === 'idle' ? 4 : 0)), im.width / ART_S, im.height / ART_S);
    } else if (idle && state !== 'dead') {
      const bw = idle.width / ART_S, bh = idle.height / ART_S;
      const bx = Math.sin(G.bob) * 5 * G.moving, by = Math.abs(Math.cos(G.bob)) * 5 * G.moving;
      const sw = G.wpSwitch > 0 ? (G.wpSwitch > 0.15 ? (0.3 - G.wpSwitch) : G.wpSwitch) / 0.15 * 90 : 0;
      const kick = G.wpFrame === 0 ? 4 : 0;
      const shx = G.shake > 0 ? (rnd() - 0.5) * G.shake * 6 : 0;
      let x = Math.round(W / 2 - bw / 2 + bx + shx + (META[base] ? META[base].cx * 40 : 0));
      let y = Math.round(VH - bh + 6 + by + sw + kick);
      if (frame === 'smoke' && META.pistolSmoke) { x += META.pistolSmoke.dx; y += META.pistolSmoke.dy; }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, x, y, im.width / ART_S, im.height / ART_S);
    }
    if (state !== 'dead') {
      ctx.fillStyle = 'rgba(140,255,150,.7)';
      ctx.fillRect(W / 2 - 1, VH / 2 - 4, 2, 3); ctx.fillRect(W / 2 - 1, VH / 2 + 2, 2, 3);
      ctx.fillRect(W / 2 - 5, VH / 2 - 1, 3, 2); ctx.fillRect(W / 2 + 3, VH / 2 - 1, 3, 2);
    }
    // с кино-эффектами ранение показывают красные края кадра, без них — красная вспышка
    if (G.flashHurt > 0 && !GL.postOn()) { ctx.fillStyle = 'rgba(200,0,0,' + Math.min(0.5, G.flashHurt) + ')'; ctx.fillRect(0, 0, W, VH); }
    if (G.flashPick > 0) { ctx.fillStyle = 'rgba(255,220,80,' + Math.min(0.3, G.flashPick) + ')'; ctx.fillRect(0, 0, W, VH); }
    if (state === 'dead') { ctx.fillStyle = 'rgba(120,0,0,' + Math.min(0.55, G.deadT * 0.5) + ')'; ctx.fillRect(0, 0, W, VH); }
    if (G.msgT > 0) {
      ctx.font = 'bold 10px Tahoma, Verdana, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const lines = [];
      let line = '';
      for (const word of G.msg.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (ctx.measureText(t).width > W - 10 && line) { lines.push(line); line = word; } else line = t;
      }
      lines.push(line);
      lines.forEach((s, i) => {
        ctx.fillStyle = '#000'; ctx.fillText(s, 5, 5 + i * 12);
        ctx.fillStyle = '#ffd95a'; ctx.fillText(s, 4, 4 + i * 12);
      });
    }
    drawHud();
  }

  function bevel(x, y, w, h, inset) {
    ctx.fillStyle = inset ? '#808080' : '#fff'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = inset ? '#fff' : '#808080'; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  }
  function field(x, w, label, value, color) {
    const y = VH + 4, h = HUDH - 8;
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    bevel(x, y, w, h, true);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = color || '#ff3030';
    ctx.fillText(value, x + w / 2, y + 3);
    ctx.font = '8px Tahoma, Verdana, sans-serif';
    ctx.fillStyle = '#c0c0c0';
    ctx.fillText(label, x + w / 2, y + h - 10);
  }
  function drawHud() {
    ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0, VH, W, HUDH);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, VH, W, 1);
    const p = G.p, w = WEAPONS[p.weapon];
    field(4, 54, 'ЗДОРОВЬЕ', Math.max(0, Math.ceil(p.hp)) + '%', p.hp > 30 ? '#ff3030' : '#ff9090');
    field(60, 48, 'БРОНЯ', Math.ceil(p.armor) + '%', '#7fb2ff');
    // лицо героя по центру панели
    const fx = 110, y = VH + 3, fs = HUDH - 6;
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(fx, y, fs + 2, fs); bevel(fx, y, fs + 2, fs, true);
    const fimg = faceImage();
    if (IMG[fimg]) {
      ctx.save();
      ctx.beginPath(); ctx.rect(fx + 1, y + 1, fs, fs - 2); ctx.clip();
      ctx.imageSmoothingEnabled = K > 1;
      ctx.drawImage(IMG[fimg], fx + 1, y + 1, fs, fs);
      faceBlood(fx + 1, y + 1, fs, p.hp, fimg);
      ctx.restore();
      ctx.imageSmoothingEnabled = false;
    }
    if (w.ammo) field(148, 64, 'ПАТРОНЫ ' + w.short, String(p[w.ammo]), '#ffd95a');
    else field(148, 64, 'ЛОМ', '—', '#ffd95a');
    const kx = 214, h = HUDH - 8, ky = VH + 4;
    ctx.fillStyle = '#000'; ctx.fillRect(kx, ky, 30, h); bevel(kx, ky, 30, h, true);
    if (p.key && IMG.keycard) ctx.drawImage(IMG.keycard, kx + 4, ky + 4, 22, 17);
    ctx.font = '8px Tahoma, Verdana, sans-serif'; ctx.fillStyle = '#c0c0c0'; ctx.textAlign = 'center';
    ctx.fillText('КАРТА', kx + 15, ky + h - 10);
    field(246, 70, 'МУТАНТЫ', G.kills + '/' + G.total, '#8dff96');
  }

  // =====================================================================
  //  эффекты: частицы, следы, свет
  // =====================================================================
  const MAX_PARTS = 900, MAX_DECALS = 480;
  const goreK = () => saved.gore === 2 ? 1 : saved.gore === 1 ? 0.35 : 0;

  function part(o) {
    if (G.parts.length >= MAX_PARTS) {
      const i = G.parts.findIndex(p => p.rest);
      G.parts.splice(i >= 0 ? i : 0, 1);
    }
    G.parts.push(Object.assign({ u0: 0, v0: 0, u1: 1, v1: 1, life: 3, rest: false, bounce: 0.3, grav: 9, kind: 'blood', c: [1, 1, 1, 0], tex: 'dot', s: 0.02 }, o));
  }
  function bloodColor() { const k = rr(0.42, 0.72); return [k, k * rr(0.02, 0.06), k * rr(0.02, 0.05), 0]; }

  // след на поверхности; ar — вытянутость по вертикали (для потёков на стенах), grow — растекается до размера
  function decal(x, y, z, n, size, texName, c, ar, grow) {
    if (G.decals.length >= MAX_DECALS) G.decals.shift();
    let t, b;
    if (n[1] !== 0) { t = [1, 0, 0]; b = [0, 0, 1]; }
    else { t = [-n[2], 0, n[0]]; b = [0, 1, 0]; }
    // на полу — любой поворот, на стене — почти прямо, чтобы потёки шли вниз
    const a = n[1] !== 0 ? rnd() * Math.PI * 2 : rr(-0.12, 0.12), ca = Math.cos(a), sa = Math.sin(a);
    const T = [t[0] * ca + b[0] * sa, t[1] * ca + b[1] * sa, t[2] * ca + b[2] * sa];
    const B = [-t[0] * sa + b[0] * ca, -t[1] * sa + b[1] * ca, -t[2] * sa + b[2] * ca];
    ar = ar || 1;
    // след на полу/потолке ложится на высоту этой клетки
    if (n[1] > 0) y = floorP(x, z); else if (n[1] < 0) y = ceilAt(Math.floor(x), Math.floor(z));
    // для вытянутого следа центр опускаем, чтобы пятно было в точке попадания, а потёки — ниже
    const yy = n[1] === 0 && ar > 1 ? y - size * (ar - 1) * 0.88 : y;
    G.decals.push({ x: x + n[0] * 0.004, y: yy + n[1] * 0.004, z: z + n[2] * 0.004, n, t: T, b: B, s: grow ? size * 0.25 : size, st: size, ar, tex: texName, c });
  }
  function bloodDecal(x, y, z, n, size, grow) {
    if (!goreK()) return;
    const c = bloodColor(); c[3] = rr(0.8, 0.97);
    if (n[1] === 0) {
      // на стене потёки; не ниже пола
      const ar = 2;
      if (y - size * 2.9 < floorP(x + n[0] * 0.1, z + n[2] * 0.1) + 0.01) decal(x, y, z, n, size, 'splat' + ((rnd() * 4) | 0), c);
      else decal(x, y, z, n, size, 'wsplat' + ((rnd() * 4) | 0), c, ar);
    } else decal(x, y, z, n, size, 'splat' + ((rnd() * 4) | 0), c, 1, grow);
  }
  function light(x, y, z, r, c, t) { G.lights.push({ x, y, z, r, c, t, t0: t }); }

  // брызги крови из точки попадания: часть летит назад к стрелку, часть — дальше, на стену за врагом
  function bloodBurst(x, y, z, dx, dy, n, power) {
    const k = goreK();
    const cnt = Math.round(n * k * 1.6);
    for (let i = 0; i < cnt; i++) {
      const through = rnd() < 0.62; // часть крови пролетает насквозь — до стены за врагом
      const sp = (through ? rr(3, 8) : -rr(0.6, 2.2)) * power;
      const big = rnd() < 0.25;
      part({ x, y, z, vx: dx * sp + rr(-1.2, 1.2), vy: through ? rr(-0.4, 1.4) : rr(0, 2.2), vz: dy * sp + rr(-1.2, 1.2),
        s: big ? rr(0.016, 0.026) : rr(0.006, 0.014), c: bloodColor(), kind: 'blood', tex: 'drop', blend: true, a: 1, life: 2.2, grav: 6.5 });
    }
    // кровавая дымка в точке попадания
    if (k) for (let i = 0; i < 2; i++) {
      const c = bloodColor(); c[0] *= 1.3;
      part({ x: x + rr(-0.05, 0.05), y: y + rr(-0.05, 0.05), z: z + rr(-0.05, 0.05), vx: dx * rr(0.3, 1) + rr(-0.3, 0.3), vy: rr(0, 0.4), vz: dy * rr(0.3, 1) + rr(-0.3, 0.3),
        s: rr(0.04, 0.07), grow: rr(0.25, 0.45), c, kind: 'mist', tex: 'mist', blend: true, a: 0.75, life: 0.45, life0: 0.45, grav: 0 });
    }
    // кристальная крошка
    for (let i = 0; i < Math.max(1, n / 6); i++) {
      part({ x, y, z, vx: rr(-1.5, 1.5) - dx, vy: rr(0.5, 2.5), vz: rr(-1.5, 1.5) - dy, s: rr(0.015, 0.03), c: [0.6, 1, 0.6, 1], tex: 'shard', kind: 'crystal', life: 6, bounce: 0.4 });
    }
  }

  // мутанта разрывает: куски его же картинки, кровь, кристаллы, вспышка
  function gib(e, dx, dy) {
    e.st = 'gone';
    faceMood('grin', 1.3);
    const name = e.def.name + '-walk', tt = TEX[name], hgt = tt.h * e.def.upp;
    const k = goreK();
    SFX.gib();
    light(e.x, e.z + 0.5, e.y, 3.5, [0.4, 1.4, 0.5], 0.35);
    G.shake = Math.max(G.shake, 0.35);
    const chunks = Math.round(18 * k);
    for (let i = 0; i < chunks; i++) {
      // куски одежды/тела этого мутанта и просто мясо — с рваными краями
      const tex = rnd() < 0.62 ? 'gib-' + e.def.name + '-' + ((rnd() * 8) | 0) : 'meat-' + ((rnd() * 6) | 0);
      const sp = rr(1.5, 5.5);
      part({ x: e.x, y: e.z + rr(0.15, hgt * 0.9), z: e.y, vx: dx * sp + rr(-2.2, 2.2), vy: rr(1, 4.2), vz: dy * sp + rr(-2.2, 2.2),
        s: rr(0.035, 0.075), tex, c: [1, 1, 1, 0], kind: 'gib', life: 40, bounce: 0.22 });
    }
    for (let i = 0; i < 10; i++) {
      part({ x: e.x, y: e.z + rr(0.2, hgt), z: e.y, vx: rr(-3, 3) + dx * 2, vy: rr(1, 4), vz: rr(-3, 3) + dy * 2, s: rr(0.02, 0.045), c: [0.7, 1, 0.7, 1], tex: 'shard', kind: 'crystal', life: 30, bounce: 0.45 });
    }
    bloodBurst(e.x, e.z + hgt * 0.5, e.y, dx, dy, 60, 1.3);
    if (k) { bloodDecal(e.x, 0, e.y, [0, 1, 0], rr(0.55, 0.75), true); bloodDecal(e.x + dx * 0.4, 0, e.y + dy * 0.4, [0, 1, 0], rr(0.3, 0.5), true); }
  }

  function ejectCasing(shell) {
    const rx = -G.dirY, rz = G.dirX;
    const x = G.px + G.dirX * 0.25 + rx * 0.12, z = G.py + G.dirY * 0.25 + rz * 0.12;
    part({ x, y: G.camZ + EYE - 0.12, z, vx: rx * rr(1.2, 2) + G.dirX * 0.3, vy: rr(1.2, 2), vz: rz * rr(1.2, 2) + G.dirY * 0.3,
      s: shell ? 0.022 : 0.014, tex: shell ? 'shell' : 'casing', c: [1, 1, 1, 0], kind: 'shell', life: 12, bounce: 0.45 });
  }

  function updateEffects(dt) {
    // лужи растекаются
    for (const d of G.decals) if (d.s < d.st) d.s = Math.min(d.st, d.s + dt * d.st * 0.45);
    const parts = G.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      if (p.kind === 'mist') {
        const k = p.life / p.life0;
        p.s += p.grow * dt; p.a = 0.75 * k;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        continue;
      }
      if (p.rest) continue;
      // летящий кусок оставляет капли
      if (p.kind === 'gib' && goreK() && rnd() < dt * 14) {
        part({ x: p.x, y: p.y, z: p.z, vx: p.vx * 0.3, vy: p.vy * 0.3, vz: p.vz * 0.3, s: rr(0.005, 0.01), c: bloodColor(), kind: 'blood', tex: 'drop', blend: true, a: 1, life: 1.5, grav: 7 });
      }
      const ox = p.x, oz = p.z;
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      // стена или край ступени/балкона на пути
      const ncx = Math.floor(p.x), ncz = Math.floor(p.z);
      const crossed = ncx !== Math.floor(ox) || ncz !== Math.floor(oz);
      const wallHit = solidAt(ncx, ncz) || (crossed && (p.y < floorAt(ncx, ncz) || p.y > ceilAt(ncx, ncz)));
      if (wallHit) {
        const hitX = Math.floor(ox) !== ncx, n = hitX ? [Math.sign(ox - p.x), 0, 0] : [0, 0, Math.sign(oz - p.z)];
        if (p.kind === 'blood') {
          // на двери след не оставляем (она уезжает)
          if (!(cellAt(ncx, ncz) === 2 || cellAt(ncx, ncz) === 3)) {
            const wx = hitX ? (p.vx > 0 ? ncx : ncx + 1) : p.x;
            const wz = hitX ? p.z : (p.vz > 0 ? ncz : ncz + 1);
            if (rnd() < (p.s > 0.015 ? 0.85 : 0.35)) bloodDecal(wx, p.y, wz, n, p.s > 0.015 ? rr(0.09, 0.17) : rr(0.05, 0.11));
          }
          parts.splice(i, 1);
          continue;
        }
        p.x = ox; p.z = oz;
        if (hitX) p.vx = -p.vx * 0.4; else p.vz = -p.vz * 0.4;
      }
      const pcx = Math.floor(p.x), pcz = Math.floor(p.z);
      const pf = floorAt(pcx, pcz), pc = ceilAt(pcx, pcz);
      // потолок
      if (p.y > pc - 0.01) { p.y = pc - 0.01; p.vy = -Math.abs(p.vy) * 0.3; }
      // пол
      if (p.y < pf + p.s * 0.6) {
        if (p.kind === 'blood') {
          if (rnd() < (p.s > 0.015 ? 0.7 : 0.25)) bloodDecal(p.x, pf, p.z, [0, 1, 0], p.s > 0.015 ? rr(0.08, 0.15) : rr(0.04, 0.09));
          parts.splice(i, 1);
          continue;
        }
        if (p.kind === 'spark') { parts.splice(i, 1); continue; }
        p.y = pf + p.s * 0.6;
        if (Math.abs(p.vy) > 0.6 && (p.kind === 'shell' || p.kind === 'crystal')) { const vol = Math.min(1, Math.abs(p.vy) / 3); atDist(p.x, p.z, () => { VS *= vol; SFX.tink(p.tex === 'shell'); }, 10); }
        if (Math.abs(p.vy) > 0.6 && p.kind === 'gib') atDist(p.x, p.z, () => SFX.splat(), 10);
        p.vy = -p.vy * p.bounce; p.vx *= 0.55; p.vz *= 0.55;
        if (Math.abs(p.vy) < 0.4) {
          p.rest = true; p.vy = 0;
          if (p.kind === 'gib' && goreK() && rnd() < 0.7) bloodDecal(p.x, 0, p.z, [0, 1, 0], rr(0.08, 0.18));
        }
      }
    }
    for (let i = G.lights.length - 1; i >= 0; i--) { G.lights[i].t -= dt; if (G.lights[i].t <= 0) G.lights.splice(i, 1); }
  }

  // =====================================================================
  //  игровая логика
  // =====================================================================
  const input = { keys: new Set(), turn: 0, look: 0, fire: false, joyX: 0, joyY: 0, use: false };

  function update(dt) {
    G.time += dt;
    const p = G.p;
    let turn = input.turn; input.turn = 0;
    if (input.keys.has('ArrowLeft')) turn -= 2.6 * dt;
    if (input.keys.has('ArrowRight')) turn += 2.6 * dt;
    if (turn) rotate(turn);
    if (input.keys.has('PageUp')) input.look += 1.5 * dt;
    if (input.keys.has('PageDown')) input.look -= 1.5 * dt;
    if (input.keys.has('End')) G.pitch = 0;
    G.pitch = Math.max(-0.95, Math.min(0.95, G.pitch + input.look)); input.look = 0;
    if (!gl3d) G.pitch = 0;
    let fwd = 0, str = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) fwd += 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) fwd -= 1;
    if (input.keys.has('KeyA')) str -= 1;
    if (input.keys.has('KeyD')) str += 1;
    fwd += -input.joyY; str += input.joyX;
    const len = Math.hypot(fwd, str);
    if (len > 1) { fwd /= len; str /= len; }
    const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') ? 1.6 : 1;
    const sp = 3.2 * run * dt;
    const mvx = (G.dirX * fwd + -G.dirY * str) * sp, mvy = (G.dirY * fwd + G.dirX * str) * sp;
    // лифты едут
    for (const l of G.lifts.values()) {
      if (!G.liftHint && Math.hypot(G.px - l.x - 0.5, G.py - l.y - 0.5) < 1.3) {
        G.liftHint = true;
        say(isTouch ? 'Лифт: встаньте на платформу и нажмите «Открыть»' : 'Лифт: встаньте на платформу и нажмите E', 3);
      }
      if (l.h === l.target) continue;
      const step = 0.9 * dt;
      l.h = l.h < l.target ? Math.min(l.target, l.h + step) : Math.max(l.target, l.h - step);
      if (l.h === l.target) atDist(l.x + 0.5, l.y + 0.5, () => SFX.liftStop(), 12);
    }
    const o = { x: G.px, y: G.py, z: G.pz, vz: G.vz };
    moveBody(o, mvx, mvy, 0.24);
    G.px = o.x; G.py = o.y;
    // ступени и падение
    const landV = settle(o, dt);
    G.pz = o.z; G.vz = o.vz;
    if (landV < -5) { hurt(Math.round((-landV - 5) * 10)); SFX.land(); G.shake = Math.max(G.shake, 0.5); }
    else if (landV < -2.5) { SFX.land(); G.shake = Math.max(G.shake, 0.2); }
    // камера догоняет плавно при шаге вверх, при падении — сразу
    G.camZ = G.vz < 0 || G.camZ > G.pz ? G.pz : G.camZ + (G.pz - G.camZ) * Math.min(1, dt * 14);
    G.moving = Math.min(1, Math.hypot(mvx, mvy) / (3.2 * dt) || 0);
    if (G.moving > 0.05) G.bob += dt * 9;

    for (const [i, d] of G.doors) {
      if (d.dir) {
        d.open = Math.max(0, Math.min(1, d.open + d.dir * dt * 1.6));
        if (d.open >= 1) { d.dir = 0; d.timer = 4; }
        if (d.open <= 0) d.dir = 0;
      } else if (d.open >= 1) {
        d.timer -= dt;
        if (d.timer <= 0) {
          const cx = i % G.MW, cy = (i / G.MW) | 0;
          const occupied = (Math.floor(G.px) === cx && Math.floor(G.py) === cy) ||
            G.enemies.some(e => alive(e) && Math.floor(e.x) === cx && Math.floor(e.y) === cy) ||
            Math.hypot(G.px - cx - 0.5, G.py - cy - 0.5) < 0.9;
          if (occupied) d.timer = 1; else { d.dir = -1; SFX.door(); }
        }
      }
    }

    for (let k = G.items.length - 1; k >= 0; k--) {
      const it = G.items[k];
      if (Math.hypot(it.x - G.px, it.y - G.py) > 0.55 || Math.abs(it.z - G.pz) > 0.6) continue;
      if (pickup(it.kind)) { G.items.splice(k, 1); G.found++; G.flashPick = 0.35; SFX.pickup(); }
    }

    if (G.wpSwitch > 0) {
      G.wpSwitch -= dt;
      if (G.wpSwitch <= 0.15 && G.wpNext >= 0) { p.weapon = G.wpNext; G.wpNext = -1; }
      if (G.wpSwitch < 0) G.wpSwitch = 0;
    }
    if (G.wpTimer > 0) G.wpTimer -= dt;
    if (G.wpFrame >= 0) {
      G.wpSeq -= dt;
      if (G.wpSeq <= 0) {
        G.wpFrame++;
        const fr = WEAPONS[p.weapon].frames;
        if (G.wpFrame >= fr.length) G.wpFrame = -1;
        else {
          G.wpSeq = fr[G.wpFrame][1];
          if (fr[G.wpFrame][0] === 'reload') { SFX.pump(); ejectCasing(true); }
          if (fr[G.wpFrame][0] === 'hit') melee();
        }
      }
    }
    if (input.fire || input.keys.has('Space') || input.keys.has('ControlLeft') || input.keys.has('ControlRight')) fire();
    if (input.use) { input.use = false; use(); }

    for (const e of G.enemies) updateEnemy(e, dt);
    for (let k = G.shots.length - 1; k >= 0; k--) {
      const s = G.shots[k];
      s.x += s.dx * dt; s.y += s.dy * dt; s.z += s.vz * dt; s.life -= dt;
      if (Math.hypot(s.x - G.px, s.y - G.py) < 0.35 && Math.abs(s.z - (G.pz + 0.45)) < 0.5) { hurt(s.dmg, s.x - s.dx, s.y - s.dy); G.shots.splice(k, 1); continue; }
      const scx = Math.floor(s.x), scy = Math.floor(s.y);
      if (s.life <= 0 || solidAt(scx, scy) || s.z < floorAt(scx, scy) || s.z > ceilAt(scx, scy)) {
        G.shots.splice(k, 1);
        const bx = s.x - s.dx * dt, by = s.y - s.dy * dt, bz = s.z - s.vz * dt;
        G.puffs.push({ x: bx, y: by, t: 0.25 });
        for (let i = 0; i < 6; i++) part({ x: bx, y: bz, z: by, vx: rr(-2, 2), vy: rr(0, 2), vz: rr(-2, 2), s: 0.02, tex: 'shard', c: [0.7, 1, 0.7, 1], kind: 'crystal', life: 4, bounce: 0.4 });
      }
    }
    for (let k = G.puffs.length - 1; k >= 0; k--) { G.puffs[k].t -= dt; if (G.puffs[k].t <= 0) G.puffs.splice(k, 1); }
    updateEffects(dt);

    G.flashHurt = Math.max(0, G.flashHurt - dt * 1.5);
    G.flashPick = Math.max(0, G.flashPick - dt * 1.5);
    G.muzzle = Math.max(0, G.muzzle - dt * 6);
    G.shake = Math.max(0, G.shake - dt * 2.2);
    if (G.finT > 0) G.finT = Math.max(0, G.finT - dt);
    updateFace(dt);
    G.msgT -= dt;
  }

  function rotate(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const dx = G.dirX, px = G.planeX;
    G.dirX = dx * c - G.dirY * s; G.dirY = dx * s + G.dirY * c;
    G.planeX = px * c - G.planeY * s; G.planeY = px * s + G.planeY * c;
  }

  function pickup(kind) {
    const p = G.p;
    if (kind === 'h') { if (p.hp >= 100) return false; p.hp = Math.min(100, p.hp + 25); say('Аптечка: +25 здоровья'); }
    else if (kind === 'b') { p.bullets = Math.min(200, p.bullets + 15); p.shells = Math.min(50, p.shells + 4); say('Ящик патронов: 15 патронов 10 мм и 4 заряда дроби'); }
    else if (kind === 'r') { if (p.armor >= 100) return false; p.armor = 100; say('Бронежилет: броня 100%'); }
    else if (kind === 'o') { if (p.hp >= 150) return false; p.hp = Math.min(150, p.hp + 20); say('Баллон кислорода: +20 здоровья (до 150)'); }
    else if (kind === 'k') { p.key = true; faceMood('grin', 1.2); say('Красная карта доступа! Теперь откроется красная дверь'); }
    return true;
  }

  function switchWeapon(n) {
    const p = G.p;
    if (n === undefined) n = (p.weapon + 1) % WEAPONS.length;
    if (n === p.weapon || G.wpSwitch > 0) return;
    G.wpNext = n; G.wpSwitch = 0.3; G.wpFrame = -1;
    SFX.weapon();
    say(WEAPONS[n].name, 1.5);
  }

  // враг прямо перед игроком, на расстоянии удара
  function enemyInFront(range, onlyStag) {
    let best = null, bd = range;
    for (const e of G.enemies) {
      if (!alive(e) || (onlyStag && !(e.stag > 0))) continue;
      const dx = e.x - G.px, dy = e.y - G.py, d = Math.hypot(dx, dy);
      if (d > bd || d < 0.01 || Math.abs(e.z - G.pz) > 0.7) continue;
      if ((dx * G.dirX + dy * G.dirY) / d < 0.78) continue;
      best = e; bd = d;
    }
    return best;
  }

  // удар ломом
  function melee() {
    const e = enemyInFront(1.4);
    if (e) {
      if (e.stag > 0) { finisher(e); return; }
      const tt = TEX[e.def.name + '-walk'];
      SFX.bash();
      G.shake = Math.max(G.shake, 0.35);
      bloodBurst(e.x - G.dirX * 0.2, e.z + tt.h * e.def.upp * 0.65, e.y - G.dirY * 0.2, G.dirX, G.dirY, 16, 0.9);
      damage(e, 24 + rnd() * 14, G.dirX * 1.6, G.dirY * 1.6, false);
      return;
    }
    // по стене — звон и искры
    const wall = castRay(G.px, G.py, G.dirX, G.dirY);
    if (wall.d < 1.25) {
      SFX.clang();
      G.shake = Math.max(G.shake, 0.2);
      const hx = G.px + G.dirX * wall.d, hz = G.py + G.dirY * wall.d, y = G.pz + EYE - 0.08;
      const n = [wall.nx, 0, wall.ny];
      if (!wall.door) decal(hx, y, hz, n, rr(0.05, 0.07), 'hole', [1, 1, 1, 0.8]);
      for (let i = 0; i < 9; i++) part({ x: hx + n[0] * 0.02, y, z: hz + n[2] * 0.02, vx: n[0] * rr(0.5, 2.5) + rr(-1.5, 1.5), vy: rr(0, 2.5), vz: n[2] * rr(0.5, 2.5) + rr(-1.5, 1.5), s: 0.012, c: [1, rr(0.6, 0.9), 0.3, 1], kind: 'spark', life: rr(0.2, 0.4), grav: 5 });
    }
  }

  // добивание оглушённого мутанта: замедление, хруст, разлёт, бонус к здоровью
  function finisher(e) {
    G.finT = Math.max(G.finT, 0.32);
    G.slowT = 0.7;
    G.shake = Math.max(G.shake, 0.7);
    SFX.bash(); SFX.finisher();
    light(e.x, e.z + 0.6, e.y, 3.5, [0.5, 1.6, 0.6], 0.5);
    const tt = TEX[e.def.name + '-walk'];
    bloodBurst(e.x, e.z + tt.h * e.def.upp * 0.7, e.y, G.dirX, G.dirY, 40, 1.4);
    damage(e, 999, G.dirX * 2, G.dirY * 2, true);
    G.p.hp = Math.min(Math.max(G.p.hp, 100), G.p.hp + 10);
    G.flashPick = 0.25;
    say('Добивание! +10 здоровья', 1.6);
  }

  function fire() {
    const p = G.p, w = WEAPONS[p.weapon];
    if (G.wpTimer > 0 || G.wpSwitch > 0 || G.finT > 0) return;
    if (w.melee) {
      G.wpTimer = w.cd; G.wpFrame = 0; G.wpSeq = w.frames[0][1];
      SFX.swing();
      return;
    }
    if (p[w.ammo] <= 0) {
      G.wpTimer = 0.4; SFX.empty();
      const other = WEAPONS.findIndex(x => x.ammo && p[x.ammo] > 0);
      if (other >= 0) switchWeapon(other); else { say('Патроны кончились! В ход идёт лом'); switchWeapon(0); }
      return;
    }
    p[w.ammo]--;
    G.wpTimer = w.cd; G.wpFrame = 0; G.wpSeq = w.frames[0][1];
    G.muzzle = 1;
    G.shake = Math.max(G.shake, w.kick);
    if (gl3d) G.pitch = Math.min(0.95, G.pitch + w.kick * 0.04);
    SFX[w.sfx]();
    const isShot = w.id === 'shotgun';
    light(G.px + G.dirX * 0.4, G.pz + EYE, G.py + G.dirY * 0.4, isShot ? 5.5 : 4, [2.2, 1.6, 0.9], 0.07);
    if (w.id === 'pistol') ejectCasing(false);
    const hits = new Map();
    const pellets = isShot ? 8 : 1;
    for (let i = 0; i < pellets; i++) {
      const spread = isShot ? 0.17 : 0.02;
      const dmg = isShot ? 6 + rnd() * 5 : 10 + rnd() * 9;
      shoot((rnd() - 0.5) * spread, (rnd() - 0.5) * spread * 0.5, dmg, hits);
    }
    hits.forEach((h, e) => damage(e, h.dmg, h.dx, h.dy, isShot && h.dist < 2.6));
    for (const e of G.enemies) if (e.st === 'idle' && Math.hypot(e.x - G.px, e.y - G.py) < 11) wake(e);
  }

  // выстрел одной пулей/дробиной: поиск врага на луче, иначе — след на стене, полу или потолке
  function shoot(off, voff, dmg, hits) {
    const c = Math.cos(off), s = Math.sin(off);
    const dx = G.dirX * c - G.dirY * s, dy = G.dirX * s + G.dirY * c;
    const oz = G.pz + EYE;
    let slope = Math.tan(G.pitch + voff);
    // на телефоне и в классическом движке — автоприцел по высоте (как в старых шутерах)
    const auto = isTouch || !gl3d;
    let best = null, bestT = Infinity;
    for (const e of G.enemies) {
      if (!alive(e)) continue;
      const ex = e.x - G.px, ey = e.y - G.py;
      const t = ex * dx + ey * dy;
      if (t < 0.15 || t >= bestT) continue;
      const perp = Math.abs(ex * dy - ey * dx);
      if (perp > 0.3 + (isTouch ? 0.08 : 0)) continue;
      const tt = TEX[e.def.name + '-walk'];
      const eh = tt.h * e.def.upp;
      let sl = slope;
      if (auto) sl = (e.z + eh * 0.55 - oz) / t + voff;
      const h = oz + t * sl;
      if (h < e.z - 0.05 || h > e.z + eh + 0.05) continue;
      // не заслоняет ли стена, пол или край балкона
      if (trace3D(G.px, G.py, oz, dx, dy, sl).d < t - 0.2) continue;
      best = e; bestT = t; if (auto) slope = sl;
    }
    const wall = trace3D(G.px, G.py, oz, dx, dy, slope);
    if (best && bestT > wall.d) best = null;
    if (best) {
      const tt = TEX[best.def.name + '-walk'];
      const eh = tt.h * best.def.upp;
      const h = Math.max(best.z + 0.12, Math.min(best.z + eh * 0.92, oz + bestT * slope));
      const hx = G.px + dx * bestT, hz = G.py + dy * bestT;
      const prev = hits.get(best);
      if (prev) prev.dmg += dmg; else hits.set(best, { dmg, dx, dy, dist: bestT });
      const sg = wid() === 'shotgun';
      bloodBurst(hx, h, hz, dx, dy, sg ? 7 : 14, sg ? 1.2 : 1);
      SFX.flesh();
      return;
    }
    // куда попала пуля: стена, ступень, пол или потолок
    const t = wall.d, nrm = wall.n, y = wall.y;
    if (t > 30) return;
    const hx = G.px + dx * t, hz = G.py + dy * t;
    G.puffs.push({ x: hx - dx * 0.05, y: hz - dy * 0.05, t: 0.25 });
    if (!(wall.door && nrm[1] === 0)) decal(hx, y, hz, nrm, rr(0.05, 0.07), 'hole', [1, 1, 1, 1]);
    for (let i = 0; i < 5; i++) {
      part({ x: hx + nrm[0] * 0.02, y: y + nrm[1] * 0.02, z: hz + nrm[2] * 0.02,
        vx: nrm[0] * rr(0.5, 2.5) + rr(-1, 1), vy: nrm[1] * rr(0.5, 2) + rr(0, 1.8), vz: nrm[2] * rr(0.5, 2.5) + rr(-1, 1),
        s: 0.012, c: [1, rr(0.6, 0.9), 0.3, 1], kind: 'spark', life: rr(0.15, 0.35), grav: 4 });
    }
    if (rnd() < 0.25) SFX.ricochet();
  }

  function wake(e) {
    if (e.st !== 'idle') return;
    e.st = 'chase'; e.cd = 0.6 + rnd() * 0.8;
    atDist(e.x, e.y, () => SFX[e.def.alert](), 16);
  }

  function damage(e, dmg, dx, dy, close) {
    if (!alive(e)) return;
    e.hp -= dmg; e.flash = 0.09;
    const push = Math.min(6, dmg * 0.09);
    e.kx += dx * push; e.ky += dy * push;
    // иногда «последнее» попадание не убивает, а оглушает — можно добить (кроме мощных выстрелов в упор)
    if (e.hp <= 0 && !e.stagDone && dmg < 40 && !close && rnd() < 0.35) e.hp = 1;
    if (e.hp <= 0) {
      G.kills++;
      // сильное попадание разрывает мутанта
      const overkill = -e.hp;
      if (saved.gore === 2 && (overkill >= 22 || (close && dmg >= 30))) gib(e, dx, dy);
      else {
        e.st = 'dying'; e.t = 0.45;
        SFX.die(); SFX.shatter();
        const tt = TEX[e.def.name + '-walk'];
        bloodBurst(e.x, e.z + tt.h * e.def.upp * 0.5, e.y, dx, dy, 20, 1);
        if (goreK()) setTimeout(() => { if (G && e.st !== 'gone') bloodDecal(e.x, 0, e.y, [0, 1, 0], rr(0.5, 0.72), true); }, 450);
      }
      if (G.kills === G.total) say('Все мутанты на уровне уничтожены!', 3);
    } else {
      if (e.st === 'idle') wake(e);
      e.stun = 0.18;
      e.pain = 0.28; e.painDir = rnd() < 0.5 ? -1 : 1;
      if (e.wind > 0 && rnd() < 0.6) e.wind = 0; // боль сбивает замах
      SFX.pain();
      // тяжело ранен — шатается, оглушён: можно добить
      if (!e.stagDone && e.hp <= e.def.hp * 0.42) {
        e.stagDone = true;
        e.stag = 3.2;
        atDist(e.x, e.y, () => SFX.stun());
        if (!G.stagHint) { G.stagHint = true; say(isTouch ? 'Мутант оглушён! Подойдите и нажмите «Открыть» — добивание' : 'Мутант оглушён! Подойдите и ударьте ломом или нажмите E — добивание', 3.5); }
      }
    }
  }

  function hurt(dmg, sx, sy) {
    const p = G.p;
    if (p.armor > 0) { const a = Math.min(p.armor, dmg / 3); p.armor -= a; dmg -= a; }
    p.hp -= dmg;
    G.flashHurt = Math.min(0.8, G.flashHurt + 0.35 + dmg / 60);
    G.shake = Math.max(G.shake, 0.3 + dmg / 40);
    SFX.hurt();
    // лицо: морщится и смотрит, откуда ударили
    faceMood('pain', 0.55);
    if (sx !== undefined) {
      const dx = sx - G.px, dy = sy - G.py, d = Math.hypot(dx, dy) || 1;
      const side = (-G.dirY * dx + G.dirX * dy) / d;
      G.face.look = side > 0.35 ? 1 : side < -0.35 ? -1 : 0;
      G.face.lookT = 1.4;
    }
    if (p.hp <= 0) { p.hp = 0; die(); }
  }

  // ---------- лицо героя ----------
  function faceMood(m, t) {
    const f = G.face;
    // боль важнее ухмылки, ухмылка важнее ярости
    const prio = { pain: 3, grin: 2, angry: 1 };
    if (f.modeT > 0 && (prio[f.mode] || 0) > (prio[m] || 0)) return;
    f.mode = m; f.modeT = t;
  }
  function updateFace(dt) {
    const f = G.face;
    if (f.modeT > 0) { f.modeT -= dt; if (f.modeT <= 0) f.mode = ''; }
    f.lookT -= dt;
    if (f.lookT <= 0) {
      const r = rnd();
      f.look = r < 0.25 ? -1 : r < 0.5 ? 1 : 0;
      f.lookT = rr(0.9, 2.4);
      f.calm = G.enemies.every(e => e.st !== 'chase') && rnd() < 0.5;
    }
    // долгая стрельба — ярость
    const firing = input.fire || input.keys.has('Space') || input.keys.has('ControlLeft') || input.keys.has('ControlRight');
    f.hold = firing && !WEAPONS[G.p.weapon].melee ? f.hold + dt : 0;
    if (f.hold > 1.1) faceMood('angry', 0.3);
  }
  function faceImage() {
    const f = G.face, hp = G.p.hp;
    if (state === 'dead' || hp <= 0) return 'face-dead';
    if (f.modeT > 0 && f.mode) return 'face-' + f.mode;
    if (hp < 25) return 'face-bloody';
    if (f.look) return f.look < 0 ? 'face-left' : 'face-right';
    return f.calm && hp > 70 ? 'face-calm' : 'face-center';
  }
  // кровь поверх лица: чем меньше здоровья, тем больше (рисунок в долях квадрата лица)
  function faceBlood(x, y, s, hp, img) {
    if (img === 'face-dead' || img === 'face-bloody') return;
    const tier = hp >= 80 ? 0 : hp >= 60 ? 1 : hp >= 42 ? 2 : 3;
    if (!tier) return;
    const L = (pts, w, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = w * s / 64 * 0.75; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + px * s, y + py * s)); ctx.stroke();
    };
    const D = (px, py, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + px * s, y + py * s, r * s / 64, 0, 6.283); ctx.fill(); };
    const red = 'rgba(150,6,8,0.9)', dark = 'rgba(95,0,4,0.85)';
    // 1: кровь из старого шрама на брови
    L([[0.655, 0.27], [0.668, 0.38], [0.672, 0.47], [0.67, 0.53]], 2.2, red); D(0.67, 0.54, 1.6, red);
    if (tier >= 2) {
      // 2: кровь из носа, синяк на скуле
      D(0.3, 0.5, 7, 'rgba(90,30,70,0.35)');
      L([[0.47, 0.565], [0.468, 0.63], [0.47, 0.7]], 2.2, red);
      L([[0.535, 0.565], [0.54, 0.64], [0.535, 0.72]], 2.4, red); D(0.535, 0.73, 1.6, red);
    }
    if (tier >= 3) {
      // 3: рассечён лоб, кровь по щекам и из угла рта
      L([[0.36, 0.2], [0.42, 0.24]], 2, dark);
      L([[0.39, 0.23], [0.38, 0.32], [0.385, 0.44]], 1.8, red);
      L([[0.3, 0.42], [0.31, 0.55], [0.33, 0.66]], 1.8, red);
      L([[0.73, 0.5], [0.72, 0.62], [0.7, 0.72]], 2, red);
      L([[0.42, 0.66], [0.41, 0.74], [0.415, 0.8]], 1.8, red); D(0.415, 0.81, 1.5, red);
    }
  }

  function updateEnemy(e, dt) {
    if (e.flash > 0) e.flash -= dt;
    if (e.st !== 'gone') settle(e, dt);   // стоит на полу, падает в ямы, едет на лифте
    if (e.st === 'gone' || e.st === 'dead') {
      if (e.st === 'dead' && (e.kx || e.ky)) slide(e, dt);
      return;
    }
    if (e.kx || e.ky) slide(e, dt);
    if (e.st === 'dying') { e.t -= dt; if (e.t <= 0) e.st = 'dead'; return; }
    const dx = G.px - e.x, dy = G.py - e.y, dist = Math.hypot(dx, dy);
    e.seeT -= dt;
    if (e.seeT <= 0) { e.see = dist < 16 && sight(e.x, e.y, G.px, G.py, e.z + 0.6, G.pz + EYE); e.seeT = 0.2; }
    const dz = Math.abs(e.z - G.pz);
    if (e.atk > 0) e.atk = Math.max(0, e.atk - dt);
    if (e.pain > 0) e.pain = Math.max(0, e.pain - dt);
    e.mv = Math.max(0, e.mv - dt * 3);
    // оглушён: шатается на месте, не нападает
    if (e.stag > 0) {
      e.stag -= dt; e.anim += dt;
      if (e.stag <= 0) { e.stag = 0; e.cd = 0.8; }
      return;
    }
    if (e.st === 'idle') { if (e.see && dist < 13) wake(e); return; }
    e.anim += dt;
    e.cd -= dt;
    const isTech = e.kind === 't';
    // рычание время от времени
    e.growlT -= dt;
    if (e.growlT <= 0 && dist < 11) { e.growlT = 4 + rnd() * 6; atDist(e.x, e.y, () => (isTech ? SFX.growlTech() : SFX.growlAstro())); }
    if (e.stun > 0) { e.stun -= dt; return; }
    // замах: видно, что сейчас ударит или плюнет — и есть миг, чтобы отскочить
    if (e.wind > 0) {
      e.wind -= dt;
      if (e.wind > 0) return;
      if (e.windKind === 'melee') {
        if (dist < (isTech ? 1.25 : 1.5) && dz < 0.65) { hurt(isTech ? 7 + rnd() * 4 : 14 + rnd() * 8, e.x, e.y); SFX.claw(); }
        else atDist(e.x, e.y, () => SFX.swing());   // промахнулся — свист клинка
        e.atk = 0.22;
      } else {
        const sp = 5;
        const a = (rnd() - 0.5) * 0.12;
        const ux = dx / dist, uy = dy / dist;
        const vx = ux * Math.cos(a) - uy * Math.sin(a), vy = ux * Math.sin(a) + uy * Math.cos(a);
        // плевок летит туда, где у игрока голова, — сверху вниз или снизу вверх
        const sz = e.z + 0.55, vz = (G.pz + 0.45 - sz) / Math.max(0.5, dist) * sp;
        G.shots.push({ x: e.x + vx * 0.4, y: e.y + vy * 0.4, z: sz, dx: vx * sp, dy: vy * sp, vz, dmg: 6 + rnd() * 5, life: 4 });
        light(e.x, e.z + 0.5, e.y, 2.5, [0.3, 1.2, 0.4], 0.2);
        atDist(e.x, e.y, () => SFX.spit());
        e.stun = 0.25; e.atk = 0.2;
      }
      return;
    }
    if (dist < (isTech ? 0.95 : 1.15) && dz < 0.6 && e.cd <= 0) {
      e.wind = isTech ? 0.22 : 0.34; e.windKind = 'melee';
      e.cd = isTech ? 1.1 : 1.05;
      if (!isTech) atDist(e.x, e.y, () => SFX.growlAstro());
      return;
    }
    // техник иногда замирает, покачиваясь, — как будто прислушивается
    if (e.pauseT > 0) { e.pauseT -= dt; return; }
    if (isTech && dist > 3 && rnd() < dt * 0.15) { e.pauseT = 0.4 + rnd() * 0.8; return; }
    // плюётся издалека или если игрок недосягаем (выше или ниже)
    if (isTech && e.see && (dist > 1.8 || dz > 0.6) && dist < 9 && e.cd <= 0) {
      e.wind = 0.32; e.windKind = 'spit';
      e.cd = 1.7 + rnd() * 1.2;
      return;
    }
    if (dist > 0.8) {
      // походка: шаг за шагом, скорость меняется в такт шагам
      const prevS = Math.sin(e.phase);
      if (isTech) {
        e.phase += dt * 5.2 * (1 + 0.55 * Math.sin(e.phase)); // хромает рывками
      } else {
        e.phase += dt * 6.8; // тяжёлый ровный шаг
      }
      const s = Math.sin(e.phase);
      const gait = isTech ? 0.35 + 1.0 * Math.abs(s) : 0.7 + 0.45 * Math.abs(s);
      const step = e.def.speed * gait * dt;
      // не прямо в лоб — петляет, пока далеко
      const weave = dist > 2 ? Math.sin(G.time * (isTech ? 0.9 : 1.4) + e.seed) * (isTech ? 0.35 : 0.5) : 0;
      const cw = Math.cos(weave), sw = Math.sin(weave);
      const ux = dx / dist, uy = dy / dist;
      const mx = ux * cw - uy * sw, my = ux * sw + uy * cw;
      const ox = e.x, oy = e.y;
      moveBody(e, mx * step, my * step, 0.28);
      e.mv = 1;
      // шаг: нога коснулась пола
      if ((prevS < 0) !== (s < 0)) {
        atDist(e.x, e.y, () => (isTech ? SFX.stepTech() : SFX.stepAstro()), isTech ? 7 : 11);
        if (!isTech && dist < 3) G.shake = Math.max(G.shake, 0.12);
      }
      if (Math.abs(e.x - ox) + Math.abs(e.y - oy) < step * 0.3) {
        const fx = Math.floor(e.x + Math.sign(dx) * 0.6), fy = Math.floor(e.y + Math.sign(dy) * 0.6);
        for (const [cx, cy] of [[fx, Math.floor(e.y)], [Math.floor(e.x), fy]]) {
          if (cellAt(cx, cy) === 2) openDoor(cx, cy, true);
        }
      }
      for (const o of G.enemies) {
        if (o === e || !alive(o)) continue;
        const ddx = e.x - o.x, ddy = e.y - o.y, dd = Math.hypot(ddx, ddy);
        if (dd > 0 && dd < 0.5) moveBody(e, ddx / dd * 0.5 * dt, ddy / dd * 0.5 * dt, 0.28);
      }
    }
  }
  // отброс от попадания
  function slide(e, dt) {
    moveBody(e, e.kx * dt, e.ky * dt, 0.28);
    const f = Math.exp(-6 * dt);
    e.kx *= f; e.ky *= f;
    if (Math.abs(e.kx) + Math.abs(e.ky) < 0.05) { e.kx = 0; e.ky = 0; }
  }

  function openDoor(cx, cy, quiet) {
    const d = G.doors.get(cy * G.MW + cx);
    if (!d || d.dir === 1 || d.open >= 1) { if (d) d.timer = 4; return; }
    d.dir = 1;
    if (!quiet || Math.hypot(G.px - cx, G.py - cy) < 8) SFX.door();
  }

  function use() {
    // оглушённый мутант рядом — добивание (лом сам оказывается в руке)
    const st = enemyInFront(1.5, true);
    if (st && !(G.finT > 0)) { SFX.swing(); finisher(st); return; }
    // лифт под ногами или прямо впереди — поехали
    for (const r of [0, 0.7, 1.2]) {
      const l = G.lifts.get(Math.floor(G.py + G.dirY * r) * G.MW + Math.floor(G.px + G.dirX * r));
      if (!l) continue;
      if (l.h !== l.target) return;
      l.target = l.h > (l.lo + l.hi) / 2 ? l.lo : l.hi;
      atDist(l.x + 0.5, l.y + 0.5, () => SFX.lift(), 14);
      return;
    }
    for (const r of [0.6, 1.1, 1.5]) {
      const cx = Math.floor(G.px + G.dirX * r), cy = Math.floor(G.py + G.dirY * r);
      const c = cellAt(cx, cy);
      if (c === 2) { openDoor(cx, cy); return; }
      if (c === 3) {
        if (G.p.key) openDoor(cx, cy);
        else { SFX.locked(); say('Заперто. Нужна красная карта доступа'); }
        return;
      }
      if (c === 4) { levelDone(); return; }
      if (c === 1) return;
    }
  }

  // =====================================================================
  //  экраны
  // =====================================================================
  function showMenu(html) {
    menu.innerHTML = html;
    menu.classList.add('show');
    input.keys.clear(); input.fire = false; input.use = false; input.joyX = input.joyY = 0;
    touches.forEach(t => { if (t.btn) t.btn.classList.remove('on'); });
    touches.clear();
    stick.style.display = 'none';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function hideMenu() { menu.classList.remove('show'); }

  function titleScreen() {
    state = 'title';
    const cont = saved.level > 1 ? `<button class="win95-button" data-m="cont">Продолжить: уровень ${saved.level}</button>` : '';
    showMenu(`
      <h1>ЛУННАЯ ТРЕВОГА</h1>
      <p>Станция «Селена-7». На ней добывали неизвестный зелёный кристалл — и он начал менять людей. Вы — инженер охраны. Пробейтесь к эвакуационному шаттлу.</p>
      <button class="win95-button" data-m="new">Новая игра</button>
      ${cont}
      <button class="win95-button" data-m="opts">Настройки</button>
      <button class="win95-button" data-m="help">Управление</button>
      <button class="win95-button" data-m="quit">Выход</button>`);
  }

  let optsBack = 'back';
  function optsScreen(back) {
    optsBack = back || optsBack;
    const gore = ['выкл', 'мало', 'много'][saved.gore];
    const q = ['', 'ретро (320×200)', 'обычная (640×400)', 'высокая (960×600)'][saved.q];
    const eng = GL.ok() ? (saved.gl ? '3D (видеокарта)' : 'классический (процессор)') : 'классический — 3D недоступно';
    showMenu(`
      <h2>Настройки</h2>
      <button class="win95-button" data-m="sGore">Кровь: ${gore}</button>
      <button class="win95-button" data-m="sQ"${saved.gl && GL.ok() ? '' : ' disabled'}>Чёткость: ${q}</button>
      <button class="win95-button" data-m="sGL"${GL.ok() ? '' : ' disabled'}>Движок: ${eng}</button>
      <button class="win95-button" data-m="sPost"${saved.gl && GL.ok() ? '' : ' disabled'}>Кино-эффекты: ${saved.post ? 'вкл' : 'выкл'}</button>
      <p class="ln-small">«Много» — брызги на стенах и разрывающиеся мутанты. «Мало» — немного крови без разрывов. Если игра тормозит, уменьшите чёткость.</p>
      <button class="win95-button" data-m="${optsBack}">Назад</button>`);
  }

  function helpScreen(back) {
    showMenu(`
      <h2>Управление</h2>
      <p><b>Компьютер:</b> щёлкните по экрану игры, чтобы управлять мышью. W A S D или стрелки — ходить, мышь — обзор,
      левая кнопка, Пробел или Ctrl — огонь, E или Enter — открыть дверь, 1 — лом, 2 — пистолет, 3 — дробовик (Q — следующее), Shift — бег, Esc — пауза.
      Без мыши: PageUp / PageDown — смотреть вверх-вниз, End — прямо.</p>
      <p><b>Телефон:</b> левая половина — джойстик (ходить), правая — ведите пальцем, чтобы осмотреться.
      Кнопки: ОГОНЬ, Открыть (двери и шлюз), Оружие. Удобнее держать телефон горизонтально.</p>
      <p><b>Добивание:</b> тяжело раненый мутант шатается и мерцает. Подойдите вплотную и ударьте ломом (или нажмите E / «Открыть») — расправа и +10 здоровья.</p>
      <p>Красную дверь открывает красная карта доступа. Уровень заканчивается у зелёной двери шлюза.</p>
      <button class="win95-button" data-m="${back}">Назад</button>`);
  }

  function pauseScreen() {
    if (state !== 'play') return;
    state = 'pause';
    showMenu(`
      <h2>Пауза</h2>
      <button class="win95-button" data-m="resume">Продолжить</button>
      <button class="win95-button" data-m="restart">Начать уровень заново</button>
      <button class="win95-button" data-m="popts">Настройки</button>
      <button class="win95-button" data-m="phelp">Управление</button>
      <button class="win95-button" data-m="title">Главное меню</button>`);
  }

  function die() {
    state = 'dead';
    G.deadT = 0;
    SFX.die();
    setTimeout(() => {
      if (state !== 'dead') return;
      showMenu(`
        <h2 style="color:#ff5050">Вы погибли</h2>
        <p>Кристалл забрал ещё одного. Но можно попробовать снова.</p>
        <button class="win95-button" data-m="restart">Начать уровень заново</button>
        <button class="win95-button" data-m="title">Главное меню</button>`);
    }, 1400);
  }

  let levelStart = null;

  function levelDone() {
    state = 'done';
    SFX.exit();
    const t = Math.round(G.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    const last = G.n === LEVELS.length - 1;
    if (!last) saveProgress(G.n + 2);
    const stats = `<p>Мутанты: ${G.kills} из ${G.total} · Находки: ${G.found} из ${G.totalItems} · Время: ${mm}:${ss}</p>`;
    if (last) {
      state = 'win';
      showMenu(`
        <h1>СПАСЕНИЕ</h1>
        <p>Шлюз закрывается за спиной, шаттл отстыковывается. Внизу медленно уплывает «Селена-7» с её зелёным светом в шахтах. Впереди — Земля.</p>
        ${stats}
        <button class="win95-button" data-m="title">Главное меню</button>`);
    } else {
      showMenu(`
        <h2>Уровень ${G.n + 1} пройден: ${LEVELS[G.n].name}</h2>
        ${stats}
        <button class="win95-button" data-m="next">Дальше: ${LEVELS[G.n + 1].name}</button>
        <button class="win95-button" data-m="title">Главное меню</button>`);
    }
  }

  function begin(n, player) {
    levelStart = player ? JSON.parse(JSON.stringify(player)) : newPlayer();
    startLevel(n, JSON.parse(JSON.stringify(levelStart)));
    showMenu(`
      <h2>Уровень ${n + 1}: ${LEVELS[n].name}</h2>
      <p>${LEVELS[n].intro}</p>
      <button class="win95-button" data-m="go">Вперёд</button>`);
    state = 'intro';
  }

  function play() {
    hideMenu();
    state = 'play';
    lastT = performance.now();
    if (!isTouch) lockPointer();
  }

  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    const m = b.dataset.m;
    audio();
    if (m === 'new') { saved.level = 1; store(); begin(0); }
    else if (m === 'cont') begin(saved.level - 1);
    else if (m === 'help') helpScreen('back');
    else if (m === 'phelp') helpScreen('pback');
    else if (m === 'opts') optsScreen('back');
    else if (m === 'popts') optsScreen('pback');
    else if (m === 'back') titleScreen();
    else if (m === 'pback') { state = 'play'; pauseScreen(); }
    else if (m === 'sGore') { saved.gore = (saved.gore + 2) % 3; store(); optsScreen(); }
    else if (m === 'sQ') { saved.q = saved.q % 3 + 1; store(); applyQuality(); optsScreen(); }
    else if (m === 'sGL') { saved.gl = !saved.gl; store(); applyQuality(); optsScreen(); }
    else if (m === 'sPost') { saved.post = !saved.post; store(); optsScreen(); }
    else if (m === 'quit') close();
    else if (m === 'go' || m === 'resume') play();
    else if (m === 'restart') { startLevel(G.n, JSON.parse(JSON.stringify(levelStart))); play(); }
    else if (m === 'next') begin(G.n + 1, Object.assign({}, G.p, { hp: Math.max(G.p.hp, 50), key: false }));
    else if (m === 'title') titleScreen();
  });

  // ---------- управление: клавиатура и мышь ----------
  const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'KeyE', 'Enter', 'KeyQ', 'Digit1', 'Digit2', 'Digit3', 'Escape', 'PageUp', 'PageDown', 'End']);
  window.addEventListener('keydown', e => {
    if (!open) return;
    if (state !== 'play') { if (e.code === 'Escape' && state === 'pause') { e.preventDefault(); play(); } return; }
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape') { pauseScreen(); return; }
    if (e.code === 'KeyE' || e.code === 'Enter') input.use = true;
    else if (e.code === 'Digit1') switchWeapon(0);
    else if (e.code === 'Digit2') switchWeapon(1);
    else if (e.code === 'Digit3') switchWeapon(2);
    else if (e.code === 'KeyQ') switchWeapon();
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', e => { input.keys.delete(e.code); });
  window.addEventListener('blur', () => { input.keys.clear(); input.fire = false; });

  function lockPointer() {
    try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  }
  let mouseDrag = null, lockedOnce = false;
  canvas.addEventListener('mousedown', e => {
    if (isTouch || state !== 'play') return;
    if (document.pointerLockElement !== canvas) { lockPointer(); mouseDrag = [e.clientX, e.clientY]; }
    if (e.button === 0) input.fire = true;
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) input.fire = false; mouseDrag = null; });
  window.addEventListener('mousemove', e => {
    if (!open || state !== 'play') return;
    if (document.pointerLockElement === canvas) { input.turn += e.movementX * 0.0032; input.look -= e.movementY * 0.0028; }
    else if (mouseDrag) {
      input.turn += (e.clientX - mouseDrag[0]) * 0.006; input.look -= (e.clientY - mouseDrag[1]) * 0.005;
      mouseDrag = [e.clientX, e.clientY];
    }
  });
  document.addEventListener('pointerlockchange', () => {
    if (open && state === 'play' && !document.pointerLockElement && !isTouch && lockedOnce) pauseScreen();
    if (document.pointerLockElement === canvas) lockedOnce = true;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- управление: сенсорный экран ----------
  const touches = new Map();
  touchEl.addEventListener('pointerdown', e => {
    if (state !== 'play') return;
    e.preventDefault();
    const btn = e.target.closest('.ln-btn');
    if (btn) {
      const b = btn.dataset.b;
      btn.classList.add('on');
      if (b === 'fire') { input.fire = true; touches.set(e.pointerId, { kind: 'fire', btn }); }
      else if (b === 'use') { input.use = true; touches.set(e.pointerId, { kind: 'btn', btn }); }
      else if (b === 'weap') { switchWeapon(); touches.set(e.pointerId, { kind: 'btn', btn }); }
      else if (b === 'pause') { touches.set(e.pointerId, { kind: 'btn', btn }); pauseScreen(); }
      try { touchEl.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    const r = touchEl.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    if (lx < r.width / 2) {
      touches.set(e.pointerId, { kind: 'joy', ox: lx, oy: ly });
      stick.style.display = 'block'; stick.style.left = lx + 'px'; stick.style.top = ly + 'px';
      knob.style.transform = '';
    } else {
      touches.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY });
    }
    try { touchEl.setPointerCapture(e.pointerId); } catch (err) {}
  });
  touchEl.addEventListener('pointermove', e => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    e.preventDefault();
    if (t.kind === 'joy') {
      const r = touchEl.getBoundingClientRect();
      let dx = e.clientX - r.left - t.ox, dy = e.clientY - r.top - t.oy;
      const m = Math.hypot(dx, dy), R = 45;
      if (m > R) { dx = dx / m * R; dy = dy / m * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      input.joyX = Math.abs(dx) < 8 ? 0 : dx / R;
      input.joyY = Math.abs(dy) < 8 ? 0 : dy / R;
    } else if (t.kind === 'look') {
      input.turn += (e.clientX - t.x) * 0.009;
      input.look -= (e.clientY - t.y) * 0.006;
      t.x = e.clientX; t.y = e.clientY;
    }
  });
  function endTouch(e) {
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (t.btn) t.btn.classList.remove('on');
    if (t.kind === 'fire') input.fire = false;
    if (t.kind === 'joy') { input.joyX = 0; input.joyY = 0; stick.style.display = 'none'; }
  }
  touchEl.addEventListener('pointerup', endTouch);
  touchEl.addEventListener('pointercancel', endTouch);
  touchEl.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- размер экрана ----------
  function fit() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const portrait = isTouch && r.height > r.width * 1.05;
    stage.classList.toggle('portrait', portrait);
    const availH = portrait ? Math.min(r.height * 0.6, r.width * H / W) : r.height;
    let s = Math.min(r.width / W, availH / H);
    if (s >= 2 && !portrait) s = Math.floor(s * 2) / 2;
    canvas.style.width = Math.floor(W * s) + 'px';
    canvas.style.height = Math.floor(H * s) + 'px';
  }
  window.addEventListener('resize', () => { if (open) fit(); });

  // ---------- главный цикл ----------
  function camera() {
    const sh = G.shake;
    let ey = G.camZ + EYE + Math.abs(Math.cos(G.bob)) * 0.015 * G.moving, pitch = G.pitch;
    if (state === 'dead') { const k = Math.min(1, G.deadT / 0.8); ey = G.camZ + EYE - k * 0.38; pitch = G.pitch * (1 - k) + k * 0.25; }
    const jx = sh ? (rnd() - 0.5) * sh * 0.05 : 0, jy = sh ? (rnd() - 0.5) * sh * 0.04 : 0;
    return { eye: [G.px - G.dirY * jx, ey + jy, G.py + G.dirX * jx], pitch: pitch + (sh ? (rnd() - 0.5) * sh * 0.02 : 0) };
  }

  function frame(t) {
    raf = null;
    if (!open) return;
    const dt = Math.max(0, Math.min(0.05, (t - lastT) / 1000 || 0));
    lastT = t;
    step(dt);
    raf = requestAnimationFrame(frame);
  }

  function step(dt) {
    ctx.setTransform(K, 0, 0, K, 0, 0);
    if (G && artReady) {
      // замедление времени при добивании
      if (G.slowT > 0) { G.slowT -= dt; dt *= 0.3; }
      if (state === 'play') update(dt);
      else if (state === 'dead') { G.deadT += dt; G.time += dt; updateEffects(dt); G.shake = Math.max(0, G.shake - dt * 2); G.flashHurt = Math.max(0, G.flashHurt - dt); }
      if (gl3d) {
        GL.draw(G, camera());
        ctx.drawImage(GL.canvas, 0, 0, W, VH);
      } else {
        renderSoft();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.putImageData(img, 0, 0);
      }
      drawOverlay();
    } else if (artReady) {
      drawTitleBack();
    }
  }

  function drawTitleBack() {
    const t = IMG['wall-window'];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (t) { ctx.imageSmoothingEnabled = false; ctx.drawImage(t, (W - H) / 2, 0, H, H); }
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden && open) { input.keys.clear(); input.fire = false; pauseScreen(); } });
  document.getElementById('lnX').addEventListener('click', close);

  // ---------- загрузка в стиле DOS: строки журнала, бегущие точки, мигающий курсор ----------
  const dosEl = document.getElementById('lnDos');
  const dosText = document.getElementById('lnDosText');
  let dosSkip = false;
  dosEl.addEventListener('pointerdown', () => { dosSkip = true; });
  window.addEventListener('keydown', () => { if (dosEl.classList.contains('show')) dosSkip = true; });

  function dosBoot(art) {
    dosSkip = false;
    dosText.textContent = '';
    dosEl.classList.add('show');
    const wait = ms => new Promise(r => setTimeout(r, dosSkip ? 0 : ms));
    const span = (text, cls) => { const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = text; dosText.appendChild(s); return s; };
    const disk = () => { noise(0.015, 'highpass', 3500, 0.12); if (rnd() < 0.5) noise(0.012, 'highpass', 2800, 0.08, 0.03); };
    const W0 = 34; // ширина колонки с точками
    // [надпись, результат (строка или функция), класс результата]
    const lines = [
      ['MEM_Init: проверка памяти', '640K OK', 'ok'],
      ['TEX_Load: текстуры станции', () => art.then(() => Object.keys(TEX).length + ' шт.'), 'ok'],
      ['GFX_Init: видеоадаптер', () => art.then(() => (gl3d ? 'WebGL, 3D' : 'VGA, 2D')), 'ok'],
      ['SPR_Load: мутанты', '2 вида', 'ok'],
      ['SND_Init: синтезатор звука', () => (soundOn() ? 'OK' : 'выключен'), 'ok'],
      ['MAP_Load: карты уровней', String(LEVELS.length), 'ok'],
      ['CRY_Scan: заражение кристаллом', '97% (!)', 'warn'],
      ['NET_Init: связь с Землёй', 'НЕТ СИГНАЛА', 'warn'],
      ['AI_Init: пробуждение мутантов', 'ОНИ ПРОСНУЛИСЬ', 'warn'],
      ['ST_Init: панель состояния', 'OK', 'ok']
    ];
    return (async () => {
      span('Станция «Селена-7», терминал службы охраны\n', 'hi');
      span('Своя разработка. Только для себя.\n\n');
      await wait(350);
      for (const [label, res, cls] of lines) {
        span(label + ' ');
        disk();
        const dots = span('');
        const n = Math.max(3, W0 - label.length);
        for (let i = 0; i < n; i += 3) { dots.textContent += '...'.slice(0, Math.min(3, n - i)); await wait(14); }
        let r = typeof res === 'function' ? res() : res;
        if (r && r.then) r = await r;
        span(' ' + r + '\n', cls);
        await wait(110 + rnd() * 160);
      }
      await art;
      span('\nЗапуск');
      for (let i = 0; i < 3; i++) { await wait(180); span('.'); }
      span('\n');
      span('_', 'cur');
      await wait(650);
      dosEl.classList.remove('show');
    })();
  }

  let ready = null;
  function openGame() {
    open = true;
    win.classList.add('show');
    fit();
    if (!ready) {
      const art = loadArt().then(() => { GL.init(); applyQuality(); });
      ready = dosBoot(art).then(() => art);
    }
    ready.then(() => {
      if (!open) return;
      if (!G || state === 'title') titleScreen();
      else if (state === 'play') pauseScreen();
      lastT = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    });
  }

  function close() {
    if (state === 'play') pauseScreen();
    open = false;
    win.classList.remove('show');
    input.keys.clear(); input.fire = false; input.joyX = input.joyY = 0;
    if (document.pointerLockElement) document.exitPointerLock();
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function back() {
    if (state === 'play') pauseScreen();
    else if (state === 'pause') play();
    else close();
  }

  window.LunarGame = { open: openGame, close, back, isOpen: () => open, _debug: () => ({ G, state, LEVELS, input, saved, gl3d, K, step }) };
})();
