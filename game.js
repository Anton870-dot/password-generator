// ---------- Игра «Лунная тревога» ----------
// Ретро-шутер от первого лица в духе игр 90-х. Свой движок (лучевой рендер),
// свои уровни, звуки синтезируются. Картинки — из game-art.js.
// Загружается только при запуске игры. Math.random не используется.
(function () {
  'use strict';

  const ART = window.GAME_ART || {};
  const META = window.GAME_ART_META || {};

  // ---------- случайные числа (crypto) ----------
  const rbuf = new Uint32Array(256);
  let rpos = 256;
  function rnd() {
    if (rpos >= 256) { crypto.getRandomValues(rbuf); rpos = 0; }
    return rbuf[rpos++] / 4294967296;
  }

  // ---------- размеры экрана ----------
  const W = 320, VH = 200, HUDH = 40, H = VH + HUDH;
  const PLANE = 0.66; // ширина поля зрения (~66°)

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
.ln-stage.portrait .ln-pause { top: 10px; }
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
.ln-menu .win95-button { min-width: 220px; }
.ln-menu .ln-small { font-size: 11px; color: #aaa; }
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
        <div class="ln-zone r">поворот — ведите пальцем</div>
        <div class="ln-stick" id="lnStick"><div class="ln-knob" id="lnKnob"></div></div>
        <div class="ln-btn ln-fire" data-b="fire">ОГОНЬ</div>
        <div class="ln-btn ln-use" data-b="use">Открыть</div>
        <div class="ln-btn ln-weap" data-b="weap">Оружие</div>
        <div class="ln-btn ln-pause" data-b="pause">II</div>
      </div>
      <div class="ln-menu" id="lnMenu"></div>
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

  const img = ctx.createImageData(W, VH);
  const buf = new Uint32Array(img.data.buffer);
  const zbuf = new Float32Array(W);

  // ---------- картинки ----------
  const TEX = {};   // {w, h, px: Uint32Array}
  const IMG = {};   // HTMLImageElement / canvas для drawImage
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
      // производные текстуры: потолок, запертая дверь (красная), шлюз-выход (зелёный)
      if (TEX.floor) TEX.ceil = recolor(TEX.floor, (r, g, b) => { const v = (r + g + b) / 3; return [v * 0.55 + 6, v * 0.6 + 8, v * 0.7 + 14]; });
      if (TEX.door) {
        TEX.locked = recolor(TEX.door, (r, g, b) => [Math.min(255, r * 1.15 + 30), g * 0.7, b * 0.7]);
        TEX.exit = recolor(TEX.door, (r, g, b) => [r * 0.6, Math.min(255, g * 1.1 + 40), b * 0.7]);
      }
      TEX.shard = makeShard();
      TEX.puff = makePuff();
      artReady = true;
    });
  }

  function recolor(t, fn) {
    const px = new Uint32Array(t.px.length);
    for (let i = 0; i < px.length; i++) {
      const c = t.px[i];
      const [r, g, b] = fn(c & 255, (c >> 8) & 255, (c >> 16) & 255);
      px[i] = (c & 0xff000000) | (Math.max(0, Math.min(255, b | 0)) << 16) | (Math.max(0, Math.min(255, g | 0)) << 8) | Math.max(0, Math.min(255, r | 0));
    }
    return { w: t.w, h: t.h, px };
  }

  // кристальный осколок, которым плюются заражённые техники
  function makeShard() {
    const n = 12, px = new Uint32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.abs(x - 5.5) / 3.2 + Math.abs(y - 5.5) / 5.5;
      if (d > 1) continue;
      const k = 1 - d;
      const r = 60 + 150 * k * k, g = 200 + 55 * k, b = 70 + 140 * k * k;
      px[y * n + x] = 0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
    }
    return { w: n, h: n, px };
  }

  // искры от попадания в стену
  function makePuff() {
    const n = 8, px = new Uint32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - 3.5, y - 3.5) / 3.8;
      if (d > 1) continue;
      const k = 1 - d;
      px[y * n + x] = 0xff000000 | ((40 + 80 * k) << 16) | ((150 + 100 * k) << 8) | (255 * Math.min(1, 0.6 + k)) ;
    }
    return { w: n, h: n, px };
  }

  // ---------- звуки (синтез) ----------
  let actx = null, noiseBuf = null, master = null;
  function audio() {
    if (!(window.Sound && Sound.isOn())) return null;
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
  const SFX = {
    pistol() { noise(0.16, 'bandpass', 1900, 0.9, 0, 0.7); tone('sine', 160, 45, 0.16, 0.6); },
    shotgun() { noise(0.42, 'lowpass', 1600, 1.1); tone('sine', 110, 35, 0.3, 0.8); noise(0.06, 'highpass', 3000, 0.25, 0.32); noise(0.06, 'highpass', 2500, 0.25, 0.42); },
    empty() { noise(0.03, 'highpass', 4000, 0.3); },
    techAlert() { tone('sawtooth', 120, 70, 0.5, 0.18); tone('sawtooth', 126, 64, 0.5, 0.12); },
    astroAlert() { tone('sawtooth', 70, 45, 0.7, 0.2); tone('square', 900, 300, 0.4, 0.04, 0.05); },
    pain() { tone('square', 260, 120, 0.12, 0.12); },
    die() { tone('sawtooth', 220, 40, 0.7, 0.2); noise(0.5, 'lowpass', 900, 0.4); },
    shatter() { for (let i = 0; i < 5; i++) tone('sine', 1800 + rnd() * 1800, 900, 0.18, 0.06, i * 0.04); },
    spit() { noise(0.25, 'bandpass', 1200, 0.35, 0, 2); tone('sine', 700, 300, 0.2, 0.06); },
    claw() { noise(0.12, 'highpass', 2200, 0.5); },
    hurt() { tone('square', 150, 80, 0.22, 0.2); noise(0.1, 'lowpass', 600, 0.4); },
    pickup() { tone('sine', 660, 660, 0.08, 0.15); tone('sine', 990, 990, 0.12, 0.15, 0.07); },
    weapon() { noise(0.05, 'highpass', 2500, 0.3); noise(0.05, 'highpass', 2000, 0.3, 0.12); },
    door() { tone('sawtooth', 55, 70, 0.7, 0.12); noise(0.6, 'lowpass', 400, 0.25); },
    locked() { tone('square', 200, 200, 0.12, 0.12); tone('square', 150, 150, 0.2, 0.12, 0.13); },
    exit() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.35, 0.18, i * 0.12)); },
    puff() { noise(0.05, 'highpass', 3000, 0.15); }
  };

  // ---------- уровни ----------
  // # стена станции, R скала, W окно, D дверь, L красная дверь (нужна карта), X шлюз-выход
  // P игрок (смотрит вправо), t техник, a космонавт, h аптечка, b патроны, r броня, o кислород, k карта
  const LEVELS = [
    {
      name: 'Жилой модуль',
      intro: 'Станция «Селена-7» не отвечает уже трое суток. Найдите красную карту доступа и доберитесь до шлюза (зелёная дверь).',
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
    t: { name: 'tech', hp: 30, speed: 1.05, upp: 0.8 / 112, alert: 'techAlert' },
    a: { name: 'astro', hp: 85, speed: 1.65, upp: 0.92 / 120, alert: 'astroAlert' }
  };
  const ITEM = {
    h: { tex: 'medkit', upp: 0.009 },
    b: { tex: 'ammo', upp: 0.009 },
    r: { tex: 'armor', upp: 0.009 },
    o: { tex: 'oxygen', upp: 0.009 },
    k: { tex: 'keycard', upp: 0.009 }
  };
  const WEAPONS = [
    { name: 'Пистолет Самойлова, 10 мм', short: '10 мм', ammo: 'bullets', cd: 0.34, frames: [['fire', 0.07], ['smoke', 0.22]], sfx: 'pistol' },
    { name: 'Гвардейский дробовик', short: 'дробь', ammo: 'shells', cd: 0.9, frames: [['fire', 0.1], ['idle', 0.14], ['reload', 0.36]], sfx: 'shotgun' }
  ];

  // ---------- состояние ----------
  let G = null;            // текущая игра
  let state = 'title';     // title | play | pause | dead | done | win
  let open = false, raf = null, lastT = 0;
  let saved = { level: 1 };
  try { const s = JSON.parse(localStorage.getItem('pg95-lunar') || 'null'); if (s && Number.isInteger(s.level)) saved.level = Math.max(1, Math.min(LEVELS.length, s.level)); } catch (e) {}
  function saveProgress(level) {
    saved.level = Math.max(saved.level, Math.min(LEVELS.length, level));
    try { localStorage.setItem('pg95-lunar', JSON.stringify(saved)); } catch (e) {}
  }

  function newPlayer() {
    return { hp: 100, armor: 0, bullets: 40, shells: 10, weapon: 0, key: false };
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
          enemies.push({ kind: ch, def: e, x: x + 0.5, y: y + 0.5, hp: e.hp, st: 'idle', t: 0, cd: 1 + rnd(), flash: 0, anim: rnd() * 6, see: 0, seeT: 0 });
        } else if (ITEM[ch]) items.push({ kind: ch, x: x + 0.5, y: y + 0.5 });
      }
    }
    G = {
      n, MW, MH, cells, wtex, doors, enemies, items, shots: [], puffs: [],
      px, py, dirX: 1, dirY: 0, planeX: 0, planeY: PLANE,
      p: player || newPlayer(),
      wpTimer: 0, wpFrame: -1, wpSeq: 0, wpSwitch: 0, wpNext: -1,
      bob: 0, moving: 0, flashHurt: 0, flashPick: 0, muzzle: 0,
      msg: '', msgT: 0, time: 0, kills: 0, total: enemies.length, found: 0, totalItems: items.length,
      noise: 0
    };
    G.p.key = false;
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
  function blocked(x, y, r) {
    return solidAt(Math.floor(x - r), Math.floor(y - r)) || solidAt(Math.floor(x + r), Math.floor(y - r)) ||
      solidAt(Math.floor(x - r), Math.floor(y + r)) || solidAt(Math.floor(x + r), Math.floor(y + r));
  }
  function moveBody(o, dx, dy, r) {
    if (!blocked(o.x + dx, o.y, r)) o.x += dx;
    if (!blocked(o.x, o.y + dy, r)) o.y += dy;
  }
  // видно ли точку b из точки a (стены и закрытые двери загораживают)
  function sight(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 0.1);
    for (let i = 1; i < n; i++) {
      const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
      if (solidAt(Math.floor(x), Math.floor(y))) return false;
    }
    return true;
  }

  // ---------- рендер ----------
  function fog(d) {
    const f = 1.25 - d * 0.085 + G.muzzle * 0.35;
    return (Math.max(0.16, Math.min(1, f)) * 256) | 0;
  }
  function shade(c, f) {
    const r = ((c & 255) * f) >> 8, g = (((c >> 8) & 255) * f) >> 8, b = (((c >> 16) & 255) * f) >> 8;
    return 0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
  }

  function render() {
    const { px, py, dirX, dirY, planeX, planeY } = G;
    // пол и потолок
    const fl = TEX.floor, ce = TEX.ceil;
    const rdx0 = dirX - planeX, rdy0 = dirY - planeY, rdx1 = dirX + planeX, rdy1 = dirY + planeY;
    const half = VH / 2;
    for (let y = half + 1; y < VH; y++) {
      const rowDist = half / (y - half);
      const sx = rowDist * (rdx1 - rdx0) / W, sy = rowDist * (rdy1 - rdy0) / W;
      let fx = px + rowDist * rdx0, fy = py + rowDist * rdy0;
      const f = fog(rowDist), fc = (f * 0.8) | 0;
      const ro = y * W, rc = (VH - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const tx = ((fx - Math.floor(fx)) * 64) & 63, ty = ((fy - Math.floor(fy)) * 64) & 63;
        const k = ty * 64 + tx;
        buf[ro + x] = shade(fl.px[k], f);
        buf[rc + x] = shade(ce.px[k], fc);
        fx += sx; fy += sy;
      }
    }
    buf.fill(0xff000000, (half - 1) * W, (half + 1) * W);

    // стены
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
          // дверь — посередине клетки, уезжает в сторону
          const dr = G.doors.get(my * G.MW + mx);
          let d, w;
          if (side === 0) { d = (mx - px + (1 - stx) / 2 + stx * 0.5) / rdx; w = py + d * rdy - my; }
          else { d = (my - py + (1 - sty) / 2 + sty * 0.5) / rdy; w = px + d * rdx - mx; }
          if (w < 0 || w >= 1) continue;
          if (w < dr.open) continue;
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

    // спрайты: враги, предметы, осколки, искры — от дальних к ближним
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
      const fr = e.st === 'dead' ? 'dead' : e.st === 'dying' ? 'dying' : 'walk';
      const t = TEX[e.def.name + '-' + fr];
      if (!t) continue;
      let bob = 0, sq = 1;
      if (fr === 'walk' && (e.st === 'chase')) { bob = Math.abs(Math.sin(e.anim * 5)) * 0.03; sq = 1 + Math.sin(e.anim * 10) * 0.02; }
      add(e.x, e.y, t, t.h * e.def.upp * sq, { flash: e.flash, lift: bob, mirror: fr === 'walk' && e.def.name === 'tech' && Math.sin(e.anim * 5) < 0 && e.st === 'chase' });
    }
    for (const s of G.shots) add(s.x, s.y, TEX.shard, 0.16, { lift: 0.32, glow: true });
    for (const p of G.puffs) add(p.x, p.y, TEX.puff, 0.08 * (1 + (0.25 - p.t) * 4), { lift: 0.42, glow: true });
    list.sort((a, b) => b.ty - a.ty);
    for (const s of list) drawSprite(s);
  }

  function drawSprite(s) {
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
    let f = o.glow ? 256 : fog(ty);
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

  // оружие, вспышки, панель
  function drawOverlay() {
    const w = WEAPONS[G.p.weapon];
    const base = G.p.weapon === 0 ? 'pistol' : 'shotgun';
    let frame = 'idle';
    if (G.wpFrame >= 0) frame = w.frames[G.wpFrame][0];
    let im = IMG[base + '-' + frame] || IMG[base + '-idle'];
    const idle = IMG[base + '-idle'];
    if (idle) {
      const k = 1.0;
      const bw = idle.width * k, bh = idle.height * k;
      const bx = Math.sin(G.bob) * 5 * G.moving, by = Math.abs(Math.cos(G.bob)) * 5 * G.moving;
      const sw = G.wpSwitch > 0 ? (G.wpSwitch > 0.15 ? (0.3 - G.wpSwitch) : G.wpSwitch) / 0.15 * 90 : 0;
      let x = Math.round(W / 2 - bw / 2 + bx + (META[base] ? META[base].cx * 40 : 0));
      let y = Math.round(VH - bh + 6 + by + sw);
      if (frame === 'smoke' && META.pistolSmoke) { x += META.pistolSmoke.dx; y += META.pistolSmoke.dy; }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, x, y, im.width * k, im.height * k);
    }
    // прицел
    ctx.fillStyle = 'rgba(140,255,150,.7)';
    ctx.fillRect(W / 2 - 1, VH / 2 - 4, 2, 3); ctx.fillRect(W / 2 - 1, VH / 2 + 2, 2, 3);
    ctx.fillRect(W / 2 - 5, VH / 2 - 1, 3, 2); ctx.fillRect(W / 2 + 3, VH / 2 - 1, 3, 2);
    // вспышки урона / подбора
    if (G.flashHurt > 0) { ctx.fillStyle = 'rgba(200,0,0,' + Math.min(0.5, G.flashHurt) + ')'; ctx.fillRect(0, 0, W, VH); }
    if (G.flashPick > 0) { ctx.fillStyle = 'rgba(255,220,80,' + Math.min(0.3, G.flashPick) + ')'; ctx.fillRect(0, 0, W, VH); }
    // сообщение
    if (G.msgT > 0) {
      ctx.font = 'bold 10px Tahoma, Verdana, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      // перенос длинного сообщения по словам
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
    field(4, 58, 'ЗДОРОВЬЕ', Math.max(0, Math.ceil(p.hp)) + '%', p.hp > 30 ? '#ff3030' : '#ff9090');
    field(66, 58, 'БРОНЯ', Math.ceil(p.armor) + '%', '#7fb2ff');
    field(128, 70, 'ПАТРОНЫ ' + w.short, String(p[w.ammo]), '#ffd95a');
    // карта доступа
    const kx = 202, y = VH + 4, h = HUDH - 8;
    ctx.fillStyle = '#000'; ctx.fillRect(kx, y, 34, h); bevel(kx, y, 34, h, true);
    if (p.key && IMG.keycard) ctx.drawImage(IMG.keycard, kx + 4, y + 3, 26, 20);
    ctx.font = '8px Tahoma, Verdana, sans-serif'; ctx.fillStyle = '#c0c0c0'; ctx.textAlign = 'center';
    ctx.fillText('КАРТА', kx + 17, y + h - 10);
    field(240, 76, 'МУТАНТЫ', G.kills + '/' + G.total, '#8dff96');
  }

  // ---------- игровая логика ----------
  const input = { keys: new Set(), turn: 0, fire: false, joyX: 0, joyY: 0, use: false };

  function update(dt) {
    G.time += dt;
    const p = G.p;
    // поворот
    let turn = input.turn; input.turn = 0;
    if (input.keys.has('ArrowLeft')) turn -= 2.6 * dt;
    if (input.keys.has('ArrowRight')) turn += 2.6 * dt;
    if (turn) rotate(turn);
    // движение
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
    const o = { x: G.px, y: G.py };
    moveBody(o, mvx, mvy, 0.24);
    G.px = o.x; G.py = o.y;
    G.moving = Math.min(1, Math.hypot(mvx, mvy) / (3.2 * dt) || 0);
    if (G.moving > 0.05) G.bob += dt * 9;

    // двери
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
            G.enemies.some(e => e.st !== 'dead' && e.st !== 'dying' && Math.floor(e.x) === cx && Math.floor(e.y) === cy) ||
            Math.hypot(G.px - cx - 0.5, G.py - cy - 0.5) < 0.9;
          if (occupied) d.timer = 1; else { d.dir = -1; SFX.door(); }
        }
      }
    }

    // предметы
    for (let k = G.items.length - 1; k >= 0; k--) {
      const it = G.items[k];
      if (Math.hypot(it.x - G.px, it.y - G.py) > 0.55) continue;
      if (pickup(it.kind)) { G.items.splice(k, 1); G.found++; G.flashPick = 0.35; SFX.pickup(); }
    }

    // оружие
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
        else { G.wpSeq = fr[G.wpFrame][1]; if (fr[G.wpFrame][0] === 'reload') SFX.weapon(); }
      }
    }
    if (input.fire || input.keys.has('Space') || input.keys.has('ControlLeft') || input.keys.has('ControlRight')) fire();
    if (input.use) { input.use = false; use(); }

    // враги
    for (const e of G.enemies) updateEnemy(e, dt);
    // осколки
    for (let k = G.shots.length - 1; k >= 0; k--) {
      const s = G.shots[k];
      s.x += s.dx * dt; s.y += s.dy * dt; s.life -= dt;
      if (Math.hypot(s.x - G.px, s.y - G.py) < 0.35) { hurt(s.dmg); G.shots.splice(k, 1); continue; }
      if (s.life <= 0 || solidAt(Math.floor(s.x), Math.floor(s.y))) { G.shots.splice(k, 1); G.puffs.push({ x: s.x - s.dx * dt, y: s.y - s.dy * dt, t: 0.25 }); }
    }
    for (let k = G.puffs.length - 1; k >= 0; k--) { G.puffs[k].t -= dt; if (G.puffs[k].t <= 0) G.puffs.splice(k, 1); }

    G.flashHurt = Math.max(0, G.flashHurt - dt * 1.5);
    G.flashPick = Math.max(0, G.flashPick - dt * 1.5);
    G.muzzle = Math.max(0, G.muzzle - dt * 6);
    G.msgT -= dt;
    G.noise = Math.max(0, G.noise - dt);
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
    else if (kind === 'k') { p.key = true; say('Красная карта доступа! Теперь откроется красная дверь'); }
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

  function fire() {
    const p = G.p, w = WEAPONS[p.weapon];
    if (G.wpTimer > 0 || G.wpSwitch > 0) return;
    if (p[w.ammo] <= 0) {
      G.wpTimer = 0.4; SFX.empty();
      const other = WEAPONS.findIndex(x => p[x.ammo] > 0);
      if (other >= 0) switchWeapon(other); else say('Патроны кончились!');
      return;
    }
    p[w.ammo]--;
    G.wpTimer = w.cd; G.wpFrame = 0; G.wpSeq = w.frames[0][1];
    G.muzzle = 1; G.noise = 0.6;
    SFX[w.sfx]();
    if (p.weapon === 0) shoot((rnd() - 0.5) * 0.02, 10 + rnd() * 9);
    else for (let i = 0; i < 7; i++) shoot((rnd() - 0.5) * 0.17, 6 + rnd() * 5);
    // выстрел будит врагов поблизости
    for (const e of G.enemies) if (e.st === 'idle' && Math.hypot(e.x - G.px, e.y - G.py) < 11) wake(e);
  }

  function shoot(off, dmg) {
    const col = Math.max(0, Math.min(W - 1, Math.round(W / 2 + (W / 2) * Math.tan(off) / PLANE)));
    const invDet = 1 / (G.planeX * G.dirY - G.dirX * G.planeY);
    let best = null, bestD = zbuf[col];
    for (const e of G.enemies) {
      if (e.st === 'dead' || e.st === 'dying') continue;
      const dx = e.x - G.px, dy = e.y - G.py;
      const ty = invDet * (-G.planeY * dx + G.planeX * dy);
      if (ty <= 0.15 || ty >= bestD) continue;
      const tx = invDet * (G.dirY * dx - G.dirX * dy);
      const sx = (W / 2) * (1 + tx / ty);
      const t = TEX[e.def.name + '-walk'];
      const hPx = t.h * e.def.upp * VH / ty, wPx = hPx * t.w / t.h;
      const halfW = wPx * 0.3 + (isTouch ? 3 : 1);
      if (Math.abs(sx - col) < halfW) { best = e; bestD = ty; }
    }
    if (best) damage(best, dmg);
    else {
      // искры у стены
      const cam = 2 * col / W - 1, d = zbuf[col] - 0.05;
      if (d < 20) G.puffs.push({ x: G.px + (G.dirX + G.planeX * cam) * d, y: G.py + (G.dirY + G.planeY * cam) * d, t: 0.25 });
    }
  }

  function wake(e) {
    if (e.st !== 'idle') return;
    e.st = 'chase'; e.cd = 0.6 + rnd() * 0.8;
    SFX[e.def.alert]();
  }

  function damage(e, dmg) {
    e.hp -= dmg; e.flash = 0.09;
    if (e.hp <= 0) {
      e.st = 'dying'; e.t = 0.45; G.kills++;
      SFX.die(); SFX.shatter();
      if (G.kills === G.total) say('Все мутанты на уровне уничтожены!', 3);
    } else {
      if (e.st === 'idle') wake(e);
      e.stun = 0.18;
      SFX.pain();
    }
  }

  function hurt(dmg) {
    const p = G.p;
    if (p.armor > 0) { const a = Math.min(p.armor, dmg / 3); p.armor -= a; dmg -= a; }
    p.hp -= dmg;
    G.flashHurt = Math.min(0.8, G.flashHurt + 0.35 + dmg / 60);
    SFX.hurt();
    if (p.hp <= 0) { p.hp = 0; die(); }
  }

  function updateEnemy(e, dt) {
    if (e.flash > 0) e.flash -= dt;
    if (e.st === 'dead') return;
    if (e.st === 'dying') { e.t -= dt; if (e.t <= 0) e.st = 'dead'; return; }
    const dx = G.px - e.x, dy = G.py - e.y, dist = Math.hypot(dx, dy);
    e.seeT -= dt;
    if (e.seeT <= 0) { e.see = dist < 16 && sight(e.x, e.y, G.px, G.py); e.seeT = 0.2; }
    if (e.st === 'idle') { if (e.see && dist < 13) wake(e); return; }
    e.anim += dt;
    e.cd -= dt;
    if (e.stun > 0) { e.stun -= dt; return; }
    const isTech = e.kind === 't';
    if (dist < (isTech ? 0.95 : 1.15) && e.cd <= 0) {
      hurt(isTech ? 7 + rnd() * 4 : 14 + rnd() * 8);
      SFX.claw(); e.cd = isTech ? 1.1 : 1.0;
      return;
    }
    if (isTech && e.see && dist > 1.8 && dist < 9 && e.cd <= 0) {
      const sp = 5;
      const a = (rnd() - 0.5) * 0.12;
      const ux = dx / dist, uy = dy / dist;
      const vx = ux * Math.cos(a) - uy * Math.sin(a), vy = ux * Math.sin(a) + uy * Math.cos(a);
      G.shots.push({ x: e.x + vx * 0.4, y: e.y + vy * 0.4, dx: vx * sp, dy: vy * sp, dmg: 6 + rnd() * 5, life: 4 });
      SFX.spit();
      e.cd = 1.7 + rnd() * 1.2;
      e.stun = 0.25;
      return;
    }
    if (dist > 0.8) {
      // идём к игроку; если упёрлись в дверь — открываем
      const step = e.def.speed * dt;
      const ox = e.x, oy = e.y;
      moveBody(e, dx / dist * step, dy / dist * step, 0.28);
      if (Math.abs(e.x - ox) + Math.abs(e.y - oy) < step * 0.3) {
        const fx = Math.floor(e.x + Math.sign(dx) * 0.6), fy = Math.floor(e.y + Math.sign(dy) * 0.6);
        for (const [cx, cy] of [[fx, Math.floor(e.y)], [Math.floor(e.x), fy]]) {
          if (cellAt(cx, cy) === 2) openDoor(cx, cy, true);
        }
      }
      // не толпиться в одной точке
      for (const o of G.enemies) {
        if (o === e || o.st === 'dead' || o.st === 'dying') continue;
        const ddx = e.x - o.x, ddy = e.y - o.y, dd = Math.hypot(ddx, ddy);
        if (dd > 0 && dd < 0.5) moveBody(e, ddx / dd * 0.5 * dt, ddy / dd * 0.5 * dt, 0.28);
      }
    }
  }

  function openDoor(cx, cy, quiet) {
    const d = G.doors.get(cy * G.MW + cx);
    if (!d || d.dir === 1 || d.open >= 1) { if (d) d.timer = 4; return; }
    d.dir = 1;
    if (!quiet || Math.hypot(G.px - cx, G.py - cy) < 8) SFX.door();
  }

  function use() {
    // клетка перед игроком
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

  // ---------- экраны ----------
  function showMenu(html) {
    menu.innerHTML = html;
    menu.classList.add('show');
    // отпускаем всё, что было зажато
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
      <button class="win95-button" data-m="help">Управление</button>
      <button class="win95-button" data-m="quit">Выход</button>`);
  }

  function helpScreen(back) {
    showMenu(`
      <h2>Управление</h2>
      <p><b>Компьютер:</b> щёлкните по экрану игры, чтобы управлять мышью. W A S D или стрелки — ходить, мышь — поворот,
      левая кнопка, Пробел или Ctrl — огонь, E или Enter — открыть дверь, 1 и 2 (или Q) — оружие, Shift — бег, Esc — пауза.</p>
      <p><b>Телефон:</b> левая половина — джойстик (ходить), правая — ведите пальцем для поворота.
      Кнопки: ОГОНЬ, Открыть (двери и шлюз), Оружие. Удобнее держать телефон горизонтально.</p>
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
      <button class="win95-button" data-m="phelp">Управление</button>
      <button class="win95-button" data-m="title">Главное меню</button>`);
  }

  function die() {
    state = 'dead';
    SFX.die();
    setTimeout(() => {
      if (state !== 'dead') return;
      showMenu(`
        <h2 style="color:#ff5050">Вы погибли</h2>
        <p>Кристалл забрал ещё одного. Но можно попробовать снова.</p>
        <button class="win95-button" data-m="restart">Начать уровень заново</button>
        <button class="win95-button" data-m="title">Главное меню</button>`);
    }, 900);
  }

  let levelStart = null; // запас игрока на начало уровня (для перезапуска)

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
    if (m === 'new') { saveProgress(1); begin(0); }
    else if (m === 'cont') begin(saved.level - 1);
    else if (m === 'help') helpScreen('back');
    else if (m === 'phelp') helpScreen('pback');
    else if (m === 'back') titleScreen();
    else if (m === 'pback') { state = 'play'; pauseScreen(); }
    else if (m === 'quit') close();
    else if (m === 'go' || m === 'resume') play();
    else if (m === 'restart') { startLevel(G.n, JSON.parse(JSON.stringify(levelStart))); play(); }
    else if (m === 'next') begin(G.n + 1, Object.assign({}, G.p, { hp: Math.max(G.p.hp, 50), key: false }));
    else if (m === 'title') titleScreen();
  });

  // ---------- управление: клавиатура и мышь ----------
  const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'KeyE', 'Enter', 'KeyQ', 'Digit1', 'Digit2', 'Escape']);
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
    else if (e.code === 'KeyQ') switchWeapon();
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', e => { input.keys.delete(e.code); });
  window.addEventListener('blur', () => { input.keys.clear(); input.fire = false; });

  function lockPointer() {
    try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  }
  let mouseDrag = null;
  canvas.addEventListener('mousedown', e => {
    if (isTouch || state !== 'play') return;
    if (document.pointerLockElement !== canvas) { lockPointer(); mouseDrag = e.clientX; }
    if (e.button === 0) input.fire = true;
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) input.fire = false; mouseDrag = null; });
  window.addEventListener('mousemove', e => {
    if (!open || state !== 'play') return;
    if (document.pointerLockElement === canvas) input.turn += e.movementX * 0.0032;
    else if (mouseDrag !== null) { input.turn += (e.clientX - mouseDrag) * 0.006; mouseDrag = e.clientX; }
  });
  document.addEventListener('pointerlockchange', () => {
    if (open && state === 'play' && !document.pointerLockElement && !isTouch && lockedOnce) pauseScreen();
    if (document.pointerLockElement === canvas) lockedOnce = true;
  });
  let lockedOnce = false;
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- управление: сенсорный экран ----------
  const touches = new Map(); // pointerId -> {kind, ...}
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
      touches.set(e.pointerId, { kind: 'look', x: e.clientX });
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
      t.x = e.clientX;
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
  function frame(t) {
    raf = null;
    if (!open) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
    lastT = t;
    if (G && artReady) {
      if (state === 'play') update(dt);
      render();
      ctx.putImageData(img, 0, 0);
      drawOverlay();
    } else if (artReady) {
      drawTitleBack();
    }
    raf = requestAnimationFrame(frame);
  }

  // фон меню — вид из окна станции
  function drawTitleBack() {
    const t = IMG['wall-window'];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (t) { ctx.imageSmoothingEnabled = false; ctx.drawImage(t, (W - H) / 2, 0, H, H); }
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden && open) { input.keys.clear(); input.fire = false; pauseScreen(); } });
  document.getElementById('lnX').addEventListener('click', close);

  let ready = null;
  function openGame() {
    open = true;
    win.classList.add('show');
    fit();
    if (!ready) ready = loadArt();
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

  // кнопка «Назад» на телефоне: в игре — пауза, в меню — выход
  function back() {
    if (state === 'play') pauseScreen();
    else if (state === 'pause') play();
    else close();
  }

  window.LunarGame = { open: openGame, close, back, isOpen: () => open, _debug: () => ({ G, state, LEVELS, input, update, render }) };
})();
