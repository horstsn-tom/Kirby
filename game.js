const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

// ─── Palette ───────────────────────────────────────────────────────────────
const COLOR = {
  sky:        '#0f3460',
  skyFar:     '#16213e',
  platform:   '#533483',
  platTop:    '#8b5cf6',
  platShadow: '#2d1b69',
  spike:      '#e94560',
  spikeGlow:  '#ff6b8a',
  player:     '#22c55e',
  playerEye:  '#ffffff',
  playerFeet: '#15803d',
  playerDark: '#16a34a',
  playerGlow: '#4ade80',
  enemy:      '#f59e0b',
  enemyEye:   '#1a1a2e',
  star:       '#ffffff',
  coin:       '#ffd700',
  coinGlow:   '#ffec80',
  text:       '#ffffff',
  textShadow: '#e94560',
  ground:     '#1a0a2e',
};

// ─── Input ──────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true;  initAudio(); });
window.addEventListener('keyup',   e => { keys[e.code] = false; });

canvas.addEventListener('click', e => {
  initAudio();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const my = (e.clientY - rect.top)  * (H / rect.height);
  if (gamePhase !== 'menu') return;
  // Start button
  if (mx >= W/2 - 90 && mx <= W/2 + 90 && my >= H/2 + 58 && my <= H/2 + 104) {
    gamePhase = 'playing';
  }
  // Skin arrows
  if (my >= H/2 + 128 && my <= H/2 + 162) {
    if (mx >= W/2 - 110 && mx <= W/2 - 66) cycleSkin(-1);
    if (mx >= W/2 +  66 && mx <= W/2 + 110) cycleSkin(1);
  }
  // Mini-game button
  if (mx >= W/2 - 80 && mx <= W/2 + 80 && my >= H/2 + 188 && my <= H/2 + 226) {
    initMiniGame();
    gamePhase = 'minigame';
  }
});

function pressing(...codes) {
  return codes.some(c => keys[c]);
}

// ─── Audio ───────────────────────────────────────────────────────────────────
const AUDIO = { ctx: null, mGain: null, sGain: null, sched: null, track: null, pos: 0, t: 0 };

function initAudio() {
  if (AUDIO.ctx) { AUDIO.ctx.resume(); return; }
  AUDIO.ctx   = new (window.AudioContext || window.webkitAudioContext)();
  AUDIO.mGain = AUDIO.ctx.createGain(); AUDIO.mGain.gain.value = 0.22; AUDIO.mGain.connect(AUDIO.ctx.destination);
  AUDIO.sGain = AUDIO.ctx.createGain(); AUDIO.sGain.gain.value = 0.5;  AUDIO.sGain.connect(AUDIO.ctx.destination);
}

function _osc(freq, dur, vol, type, dest, t0) {
  if (!AUDIO.ctx || freq <= 0) return;
  const o = AUDIO.ctx.createOscillator(), g = AUDIO.ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.88);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur);
}

function sfx(freq, endFreq, dur, vol, type) {
  if (!AUDIO.ctx) return;
  const t = AUDIO.ctx.currentTime + 0.01;
  const o = AUDIO.ctx.createOscillator(), g = AUDIO.ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), t + dur);
  g.gain.setValueAtTime(vol || 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(AUDIO.sGain); o.start(t); o.stop(t + dur + 0.05);
}

const SFX = {
  jump:       () => sfx(320, 640, 0.14, 0.35, 'square'),
  stomp:      () => { sfx(380, 120, 0.12, 0.4, 'square'); sfx(200, 60, 0.09, 0.28, 'sawtooth'); },
  coin:       () => sfx(880, 1320, 0.16, 0.28, 'sine'),
  powerup:    () => sfx(440, 1320, 0.38, 0.35, 'square'),
  checkpoint: () => { sfx(660, 880, 0.14, 0.28, 'sine'); setTimeout(() => sfx(880, 1100, 0.14, 0.28, 'sine'), 190); },
  death:      () => sfx(440, 80,  0.55, 0.5,  'sawtooth'),
  bosshit:    () => sfx(300, 90,  0.22, 0.5,  'sawtooth'),
  bossdie:    () => { [523,659,784,1047].forEach((f,i) => setTimeout(() => sfx(f,f,0.4,0.3,'sine'), i*160)); },
  win:        () => { [523,659,784,1047,1319].forEach((f,i) => setTimeout(() => sfx(f,f*1.5,0.35,0.3,'triangle'), i*150)); },
  unlock:     () => sfx(880, 1760, 0.6, 0.3, 'triangle'),
};

// Note durations at 139 BPM, 95 BPM, 160 BPM
const _e=0.216, _q=0.432, _h=0.864;
const _em=0.316, _qm=0.632;
const _eb=0.188, _qb=0.375;

const TRACK_MENU = [
  [523,_qm,0.16,'triangle'],[659,_qm,0.16,'triangle'],[784,_qm,0.18,'triangle'],[659,_qm,0.16,'triangle'],
  [880,_qm,0.16,'triangle'],[784,_qm,0.16,'triangle'],[659,_qm,0.16,'triangle'],[523,_qm*1.5,0.19,'triangle'],
  [587,_qm,0.16,'triangle'],[698,_qm,0.16,'triangle'],[880,_qm,0.18,'triangle'],[698,_qm,0.16,'triangle'],
  [784,_qm,0.16,'triangle'],[659,_qm,0.16,'triangle'],[523,_qm*1.5,0.20,'triangle'],[0,_qm*0.5,0,'triangle'],
];
const TRACK_GAME = [
  [784,_e,0.14,'square'],[784,_e,0.14,'square'],[880,_q,0.14,'square'],
  [784,_q,0.14,'square'],[0,_e,0,'square'],[659,_e,0.14,'square'],[784,_q,0.14,'square'],
  [880,_q+_e,0.16,'square'],[0,_e,0,'square'],
  [784,_e,0.14,'square'],[784,_e,0.14,'square'],[880,_q,0.14,'square'],
  [988,_q,0.18,'square'],[880,_q,0.14,'square'],[784,_h,0.17,'square'],
];
const TRACK_BOSS = [
  [523,_eb,0.19,'sawtooth'],[523,_eb,0.19,'sawtooth'],[622,_eb,0.19,'sawtooth'],[0,_eb,0,'sawtooth'],
  [523,_eb,0.19,'sawtooth'],[698,_eb,0.19,'sawtooth'],[622,_eb,0.21,'sawtooth'],[523,_qb,0.21,'sawtooth'],
  [466,_qb+_eb,0.19,'sawtooth'],[0,_eb,0,'sawtooth'],
  [523,_eb,0.19,'sawtooth'],[523,_eb,0.19,'sawtooth'],[622,_eb,0.19,'sawtooth'],[0,_eb,0,'sawtooth'],
  [698,_eb,0.19,'sawtooth'],[831,_qb,0.24,'sawtooth'],[784,_h,0.21,'sawtooth'],
];

function _musicTick() {
  if (!AUDIO.ctx || !AUDIO.track) return;
  while (AUDIO.t < AUDIO.ctx.currentTime + 0.15) {
    const n = AUDIO.track[AUDIO.pos % AUDIO.track.length];
    _osc(n[0], n[1], n[2] || 0.15, n[3] || 'square', AUDIO.mGain, AUDIO.t);
    AUDIO.t += n[1]; AUDIO.pos++;
  }
}
function startMusic(track) {
  stopMusic();
  if (!AUDIO.ctx) return;
  AUDIO.track = track; AUDIO.pos = 0; AUDIO.t = AUDIO.ctx.currentTime + 0.05;
  _musicTick();
  AUDIO.sched = setInterval(_musicTick, 60);
}
function stopMusic() { clearInterval(AUDIO.sched); AUDIO.sched = null; AUDIO.track = null; }

let _lastMusicPhase = '';
function updateMusic() {
  const phase = boss ? 'boss' : gamePhase;
  if (phase === _lastMusicPhase) return;
  _lastMusicPhase = phase;
  if      (phase === 'menu')     startMusic(TRACK_MENU);
  else if (phase === 'playing')  startMusic(TRACK_GAME);
  else if (phase === 'boss')     startMusic(TRACK_BOSS);
  else if (phase === 'minigame') startMusic(TRACK_GAME);
  else                          stopMusic();
}

// ─── Skins ───────────────────────────────────────────────────────────────────
const SKINS = [
  { id:'default', name:'DINO',   hint:'',                   col:{ body:'#22c55e', dark:'#15803d', feet:'#15803d', glow:'#4ade80' } },
  { id:'flame',   name:'FLAME',  hint:'Defeat a boss',      col:{ body:'#ef4444', dark:'#b91c1c', feet:'#dc2626', glow:'#f97316' } },
  { id:'ocean',   name:'OCEAN',  hint:'Collect 15 coins',   col:{ body:'#3b82f6', dark:'#1d4ed8', feet:'#2563eb', glow:'#60a5fa' } },
  { id:'shadow',  name:'SHADOW', hint:'Reach checkpoint 2', col:{ body:'#a855f7', dark:'#6b21a8', feet:'#7c3aed', glow:'#c084fc' } },
  { id:'gold',    name:'GOLD',   hint:'Score 400 points',   col:{ body:'#f59e0b', dark:'#b45309', feet:'#d97706', glow:'#fde68a' } },
  { id:'ghost',   name:'GHOST',  hint:'Beat the game!',     col:{ body:'#e2e8f0', dark:'#94a3b8', feet:'#cbd5e1', glow:'#f8fafc' } },
];
let selectedSkin = 0;
let unlockedSkins = new Set(['default']);
let skinUnlockMsg = 0, skinUnlockName = '';
let coinsThisRun = 0;

function loadSkins() {
  try {
    const saved = JSON.parse(localStorage.getItem('dinoSkins') || '["default"]');
    unlockedSkins = new Set(saved);
    const idx = parseInt(localStorage.getItem('dinoSkin') || '0', 10);
    selectedSkin = (idx >= 0 && idx < SKINS.length && unlockedSkins.has(SKINS[idx].id)) ? idx : 0;
  } catch(e) {}
}
function saveSkins() {
  try {
    localStorage.setItem('dinoSkins', JSON.stringify([...unlockedSkins]));
    localStorage.setItem('dinoSkin',  String(selectedSkin));
  } catch(e) {}
}
function tryUnlock(id) {
  if (unlockedSkins.has(id)) return;
  unlockedSkins.add(id); saveSkins(); SFX.unlock();
  skinUnlockMsg = 220; skinUnlockName = SKINS.find(s => s.id === id)?.name || id;
}
function skinCol() { return (SKINS[selectedSkin] || SKINS[0]).col; }
function cycleSkin(dir) {
  const ul = SKINS.reduce((a,s,i) => { if (unlockedSkins.has(s.id)) a.push(i); return a; }, []);
  const cur = ul.indexOf(selectedSkin);
  selectedSkin = ul[(cur + dir + ul.length) % ul.length];
  saveSkins();
}

// ─── Stars (parallax background) ────────────────────────────────────────────
const stars = Array.from({ length: 120 }, () => ({
  x: Math.random() * W * 3,
  y: Math.random() * H * 0.7,
  r: Math.random() * 1.5 + 0.3,
  speed: Math.random() * 0.3 + 0.05,
  alpha: Math.random() * 0.6 + 0.4,
}));

// ─── Level builder ──────────────────────────────────────────────────────────
function buildLevel() {
  const platforms = [];
  const spikes    = [];
  const enemies   = [];
  const coins     = [];

  // ── Ground sections (with pits between) ──
  platforms.push({ x: -200,  y: H - 40, w: 600,  h: 40, deadly: false });
  platforms.push({ x: 500,   y: H - 40, w: 300,  h: 40, deadly: false });
  platforms.push({ x: 900,   y: H - 40, w: 500,  h: 40, deadly: false });
  platforms.push({ x: 1600,  y: H - 40, w: 500,  h: 40, deadly: false });
  platforms.push({ x: 2300,  y: H - 40, w: 500,  h: 40, deadly: false });
  platforms.push({ x: 3000,  y: H - 40, w: 400,  h: 40, deadly: false });
  platforms.push({ x: 3600,  y: H - 40, w: 400,  h: 40, deadly: false });
  platforms.push({ x: 4200,  y: H - 40, w: 400,  h: 40, deadly: false });
  platforms.push({ x: 4800,  y: H - 40, w: 700,  h: 40, deadly: false });

  // ── Floating platforms — difficulty scales each section ──
  // sec 1=easy, sec 8=hardest
  const fp = [
    // Section 1 — wide, slow enemies (x 100–900)
    { x: 150,  y: 310, w: 110, sec: 1 },
    { x: 330,  y: 245, w: 95,  sec: 1 },
    { x: 510,  y: 175, w: 115, sec: 1 },
    { x: 700,  y: 255, w: 85,  sec: 1 },
    { x: 850,  y: 315, w: 100, sec: 1 },
    // Section 2 — slightly tighter (x 980–1580)
    { x: 990,  y: 225, w: 100, sec: 2 },
    { x: 1170, y: 160, w: 90,  sec: 2 },
    { x: 1330, y: 245, w: 85,  sec: 2 },
    { x: 1480, y: 305, w: 100, sec: 2 },
    // Section 3 — narrower, faster (x 1620–2270)
    { x: 1670, y: 205, w: 90,  sec: 3 },
    { x: 1840, y: 135, w: 100, sec: 3 },
    { x: 2030, y: 225, w: 80,  sec: 3 },
    { x: 2190, y: 295, w: 90,  sec: 3 },
    // Section 4 — harder (x 2330–2980)
    { x: 2350, y: 175, w: 80,  sec: 4 },
    { x: 2530, y: 245, w: 75,  sec: 4 },
    { x: 2700, y: 315, w: 80,  sec: 4 },
    { x: 2870, y: 190, w: 80,  sec: 4 },
    // Section 5 — tough (x 3040–3570)
    { x: 3050, y: 210, w: 75,  sec: 5 },
    { x: 3210, y: 145, w: 70,  sec: 5 },
    { x: 3360, y: 225, w: 70,  sec: 5 },
    { x: 3510, y: 290, w: 70,  sec: 5 },
    // Section 6 — hard (x 3640–4170)
    { x: 3660, y: 190, w: 70,  sec: 6 },
    { x: 3810, y: 130, w: 65,  sec: 6 },
    { x: 3960, y: 215, w: 70,  sec: 6 },
    { x: 4110, y: 290, w: 70,  sec: 6 },
    // Section 7 — very hard (x 4240–4770)
    { x: 4250, y: 200, w: 65,  sec: 7 },
    { x: 4390, y: 135, w: 65,  sec: 7 },
    { x: 4530, y: 215, w: 60,  sec: 7 },
    { x: 4670, y: 285, w: 65,  sec: 7 },
    // Section 8 — hardest (x 4840–5430)
    { x: 4860, y: 190, w: 65,  sec: 8 },
    { x: 5000, y: 125, w: 60,  sec: 8 },
    { x: 5145, y: 205, w: 65,  sec: 8 },
    { x: 5290, y: 280, w: 60,  sec: 8 },
    { x: 5400, y: 175, w: 70,  sec: 8 },
  ];

  fp.forEach(p => platforms.push({ x: p.x, y: p.y, w: p.w, h: 18, deadly: false }));

  // ── Spikes — every other platform; double spikes in sections 6–8 ──
  [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33].forEach(i => {
    const p = fp[i];
    if (!p) return;
    if (p.sec >= 6) {
      spikes.push({ x: p.x + 8,        y: p.y - 24, w: 12, h: 24, platY: p.y });
      spikes.push({ x: p.x + p.w - 20, y: p.y - 24, w: 12, h: 24, platY: p.y });
    } else {
      spikes.push({ x: p.x + Math.floor(p.w / 2) - 6, y: p.y - 24, w: 12, h: 24, platY: p.y });
    }
  });

  // Ground cacti
  [440, 480, 640, 1700, 1750, 2400, 2450, 3100, 3150, 3700, 3750, 4300, 4350, 4900, 4950].forEach(x => {
    spikes.push({ x, y: H - 64, w: 12, h: 24, platY: H - 40 });
  });

  // ── Enemies — speed scales with section ──
  const speedBySec = { 1: 0.8, 2: 1.05, 3: 1.35, 4: 1.65, 5: 2.0, 6: 2.35, 7: 2.75, 8: 3.2 };
  [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32].forEach(i => {
    const p = fp[i];
    if (!p) return;
    const base = speedBySec[p.sec] || 0.8;
    enemies.push({
      x: p.x + p.w / 2 - 10,
      y: p.y - 22,
      w: 20, h: 22,
      dir: 1,
      speed: base + Math.random() * 0.35,
      minX: p.x + 5,
      maxX: p.x + p.w - 25,
      animTimer: 0,
    });
  });

  // ── Coins — every other platform ──
  fp.forEach((p, i) => {
    if (i % 2 === 0) {
      coins.push({ x: p.x + p.w / 2 - 8, y: p.y - 36, w: 16, h: 16, collected: false, animT: Math.random() * Math.PI * 2 });
    }
  });

  // Finish flag platform
  platforms.push({ x: 5500, y: H - 40, w: 200, h: 40, deadly: false });

  // ── Power-ups — placed on ground sections throughout the level ──
  const G = H - 70; // ground pickup height
  const powerups = [
    { x: 680,  y: G, w: 22, h: 22, type: 'heart',  collected: false, animT: 0 },
    { x: 1150, y: G, w: 22, h: 22, type: 'speed',  collected: false, animT: 0 },
    { x: 1800, y: G, w: 22, h: 22, type: 'jump',   collected: false, animT: 0 },
    { x: 2450, y: G, w: 22, h: 22, type: 'shield', collected: false, animT: 0 },
    { x: 3150, y: G, w: 22, h: 22, type: 'heart',  collected: false, animT: 0 },
    { x: 3750, y: G, w: 22, h: 22, type: 'speed',  collected: false, animT: 0 },
    { x: 4350, y: G, w: 22, h: 22, type: 'shield', collected: false, animT: 0 },
    { x: 4870, y: G, w: 22, h: 22, type: 'jump',   collected: false, animT: 0 },
    { x: 5050, y: G, w: 22, h: 22, type: 'heart',  collected: false, animT: 0 },
    { x: 5250, y: G, w: 22, h: 22, type: 'speed',  collected: false, animT: 0 },
  ];

  return { platforms, spikes, enemies, coins, powerups };
}

// ─── Player factory ──────────────────────────────────────────────────────────
function makePlayer() {
  return {
    x: 80, y: H - 90,
    w: 24, h: 28,
    vx: 0, vy: 0,
    onGround: false,
    facingRight: true,
    jumpBuffer: 0,
    coyoteTime: 0,
    jumpsLeft: 1,
    wasJump: false,
    animTimer: 0,
    squishY: 1, squishX: 1,
    dead: false,
    deathTimer: 0,
    speedBoost: 0,     // frames remaining
    jumpBoost: 0,      // frames remaining
    shieldActive: false,
  };
}

// ─── Game state ──────────────────────────────────────────────────────────────
let state;
let level;
let camera;
let score;
let lives;
let bestScore = 0;
let gamePhase; // 'playing' | 'boss' | 'respawn' | 'dead' | 'win'
let deathFlash;
let boss;
let nextBossScore;
let savedCameraX;
let bossCount;
let checkpointX, checkpointY, checkpointCamX;
let checkpointFlags;
let checkpointMsg;
let powerupMsg;
let powerupMsgType;

function initGame() {
  level          = buildLevel();
  state          = makePlayer();
  camera         = { x: 0 };
  score          = 0;
  lives          = 3;
  boss              = null;
  nextBossScore     = 500;
  savedCameraX      = 0;
  bossCount         = 0;
  checkpointX    = 80;
  checkpointY    = H - 90;
  checkpointCamX = 0;
  checkpointFlags = [
    { x: 1100, activated: false },
    { x: 2500, activated: false },
    { x: 3900, activated: false },
    { x: 5100, activated: false },
  ];
  checkpointMsg  = 0;
  powerupMsg     = 0;
  powerupMsgType = '';
  coinsThisRun   = 0;
  skinUnlockMsg  = 0;
  gamePhase         = 'menu';
  deathFlash        = 0;
}

initGame();
loadSkins();

// ─── Physics constants ───────────────────────────────────────────────────────
const GRAVITY    = 0.55;
const JUMP_FORCE = -11.5;
const MOVE_SPEED = 3.8;
const MAX_FALL   = 14;
const FRICTION   = 0.82;

// ─── Collision helpers ───────────────────────────────────────────────────────
function rectOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

function resolvePlatform(player, plat) {
  const overlapX = Math.min(player.x + player.w, plat.x + plat.w) - Math.max(player.x, plat.x);
  const overlapY = Math.min(player.y + player.h, plat.y + plat.h) - Math.max(player.y, plat.y);

  if (overlapX <= 0 || overlapY <= 0) return false;

  // Resolve along smallest overlap axis
  if (overlapY < overlapX) {
    if (player.y + player.h / 2 < plat.y + plat.h / 2) {
      // player on top
      player.y = plat.y - player.h;
      if (player.vy > 0) {
        player.squishY = 0.6;
        player.squishX = 1.4;
        player.vy = 0;
        player.onGround = true;
      }
    } else {
      player.y = plat.y + plat.h;
      if (player.vy < 0) player.vy = 0;
    }
  } else {
    if (player.x + player.w / 2 < plat.x + plat.w / 2) {
      player.x = plat.x - player.w;
    } else {
      player.x = plat.x + plat.w;
    }
    player.vx = 0;
  }
  return true;
}

// ─── Update ──────────────────────────────────────────────────────────────────
let lastTime = 0;

function update(ts) {
  const dt = Math.min((ts - lastTime) / 16.67, 3); // normalized to 60fps
  lastTime = ts;

  if (gamePhase === 'menu') {
    if (pressing('Space', 'Enter')) gamePhase = 'playing';
    return;
  }

  if (gamePhase === 'minigame') {
    if (keys['Escape']) { keys['Escape'] = false; gamePhase = 'menu'; return; }
    updateMiniGame(dt);
    return;
  }

  deathFlash    = Math.max(0, deathFlash - dt * 0.05);
  checkpointMsg = Math.max(0, checkpointMsg - dt);
  powerupMsg    = Math.max(0, powerupMsg - dt);
  skinUnlockMsg = Math.max(0, skinUnlockMsg - dt);

  if (gamePhase === 'dead') {
    state.deathTimer -= dt;
    if (state.deathTimer <= 0) initGame();
    return;
  }

  if (gamePhase === 'respawn') {
    state.deathTimer -= dt;
    if (state.deathTimer <= 0) {
      state      = makePlayer();
      deathFlash = 0;
      if (boss !== null) {
        state.x = 80; state.y = H - 80;
        camera.x = 0;
        gamePhase = 'boss';
      } else {
        state.x  = checkpointX;
        state.y  = checkpointY;
        camera.x = checkpointCamX;
        gamePhase = 'playing';
      }
    }
    return;
  }

  if (gamePhase === 'win') return;
  if (gamePhase !== 'playing' && gamePhase !== 'boss') return;

  const p = state;
  p.animTimer += dt;

  // Tick powerup timers
  if (p.speedBoost > 0) p.speedBoost -= dt;
  if (p.jumpBoost  > 0) p.jumpBoost  -= dt;

  const curSpeed = MOVE_SPEED * (p.speedBoost > 0 ? 1.75 : 1);
  const curJump  = JUMP_FORCE * (p.jumpBoost  > 0 ? 1.28 : 1);

  // ── Input ──
  const left  = pressing('ArrowLeft',  'KeyA');
  const right = pressing('ArrowRight', 'KeyD');
  const jump  = pressing('ArrowUp',    'KeyW', 'Space');

  if (left)  { p.vx -= 1.2 * dt; p.facingRight = false; }
  if (right) { p.vx += 1.2 * dt; p.facingRight = true;  }

  // Clamp horizontal speed
  p.vx = Math.max(-curSpeed, Math.min(curSpeed, p.vx));

  // Friction when no key pressed
  if (!left && !right) p.vx *= Math.pow(FRICTION, dt);

  // Gravity
  p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);

  // Coyote time & jump buffer
  if (p.onGround) { p.coyoteTime = 8; p.jumpsLeft = 1; }
  else            { p.coyoteTime = Math.max(0, p.coyoteTime - dt); }

  const justJumped = jump && !p.wasJump;
  p.wasJump = jump;
  if (justJumped) p.jumpBuffer = 8;
  else            p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

  if (p.jumpBuffer > 0 && p.coyoteTime > 0) {
    p.vy = curJump;
    p.jumpBuffer = 0;
    p.coyoteTime = 0;
    p.squishY = 1.4;
    p.squishX = 0.7;
    SFX.jump();
  } else if (p.jumpBuffer > 0 && p.jumpsLeft > 0) {
    p.vy = curJump * 0.85;
    p.jumpBuffer = 0;
    p.jumpsLeft = 0;
    p.squishY = 1.3;
    p.squishX = 0.75;
    SFX.jump();
  }

  // Variable jump height — release to fall faster
  if (!jump && p.vy < -4) p.vy += 0.6 * dt;

  // Move
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // Reset ground flag
  p.onGround = false;

  // Platform collisions (level) or simple arena floor (boss)
  if (gamePhase === 'boss') {
    if (p.y + p.h > H - 40) {
      p.y = H - 40 - p.h;
      if (p.vy > 0) { p.vy = 0; p.onGround = true; p.squishY = 0.6; p.squishX = 1.4; }
    }
    if (p.x < 20)          { p.x = 20;          p.vx = 0; }
    if (p.x + p.w > W - 20){ p.x = W - p.w - 20; p.vx = 0; }
  } else {
    level.platforms.forEach(plat => {
      if (rectOverlap(p, plat)) resolvePlatform(p, plat);
    });
  }

  // Squish recovery
  p.squishY += (1 - p.squishY) * 0.2 * dt;
  p.squishX += (1 - p.squishX) * 0.2 * dt;

  // ── Boss phase: update boss then skip level logic ──
  if (gamePhase === 'boss') {
    updateBoss(dt);
    camera.x = 0;
    return;
  }

  // ── Enemy update ──
  level.enemies.forEach(e => {
    e.animTimer += dt;
    e.x += e.dir * e.speed * dt;
    if (e.x <= e.minX || e.x + e.w >= e.maxX) {
      e.dir *= -1;
    }

    // Stomping enemy from above kills it (classic)
    if (rectOverlap(p, e)) {
      if (p.vy > 0 && p.y + p.h < e.y + e.h * 0.5 + 6) {
        // Stomp!
        e.dead = true;
        p.vy = JUMP_FORCE * 0.65;
        score += 50;
        p.squishY = 0.5;
        p.squishX = 1.5;
        SFX.stomp();
      } else if (!e.dead) {
        die();
        return;
      }
    }
  });
  level.enemies = level.enemies.filter(e => !e.dead);

  // ── Spike collisions ──
  level.spikes.forEach(s => {
    // Hitbox matches trunk only (x+3, width 5)
    const sh = { x: s.x + 3, y: s.y + 2, w: 5, h: s.h - 2 };
    if (rectOverlap(p, sh)) die();
  });

  // ── Coin collection ──
  level.coins.forEach(c => {
    if (!c.collected && rectOverlap(p, c)) {
      c.collected = true;
      score += 10;
      coinsThisRun++;
      SFX.coin();
    }
    c.animT += 0.05 * dt;
  });

  // ── Power-up collection ──
  level.powerups.forEach(pu => {
    pu.animT += 0.04 * dt;
    if (!pu.collected && rectOverlap(p, pu)) {
      pu.collected   = true;
      powerupMsgType = pu.type;
      powerupMsg     = 100;
      SFX.powerup();
      const DUR = 360;
      if (pu.type === 'heart') {
        lives = Math.min(lives + 1, 3);
      } else if (pu.type === 'speed') {
        p.speedBoost = DUR;
      } else if (pu.type === 'jump') {
        p.jumpBoost = DUR;
      } else if (pu.type === 'shield') {
        p.shieldActive = true;
      }
    }
  });

  // ── Fall off world ──
  if (p.y > H + 80) die();

  // ── Left boundary ──
  if (p.x < 0) { p.x = 0; p.vx = 0; }

  // ── Win condition ──
  if (p.x > 5500) {
    gamePhase = 'win';
    if (score > bestScore) bestScore = score;
    SFX.win();
    tryUnlock('ghost');
  }

  // ── Skin unlock checks ──
  if (score >= 400)             tryUnlock('gold');
  if (coinsThisRun >= 15)       tryUnlock('ocean');
  if (checkpointFlags[1]?.activated) tryUnlock('shadow');

  // ── Checkpoint save ──
  checkpointFlags.forEach(cp => {
    if (!cp.activated && p.x > cp.x) {
      cp.activated   = true;
      checkpointX    = p.x;
      checkpointY    = p.y;
      checkpointCamX = camera.x;
      checkpointMsg  = 120;
      lives          = 3;
      SFX.checkpoint();
    }
  });

  // ── Boss fight trigger ──
  if (score >= nextBossScore) {
    savedCameraX  = camera.x;
    nextBossScore += 500;
    boss          = makeBoss(bossCount % 3);
    bossCount    += 1;
    state.x = 80; state.y = H - 80;
    state.vx = 0; state.vy = 0;
    camera.x = 0;
    gamePhase = 'boss';
    return;
  }

  // ── Camera ──
  const targetX = p.x - W * 0.35;
  camera.x += (targetX - camera.x) * 0.1 * dt;
  camera.x = Math.max(0, camera.x);
}

function die() {
  if (gamePhase !== 'playing' && gamePhase !== 'boss') return;
  if (state.shieldActive) {
    state.shieldActive = false;
    deathFlash = 0.5;
    return;
  }
  SFX.death();
  deathFlash = 1;
  lives -= 1;
  if (score > bestScore) bestScore = score;
  if (lives <= 0) {
    gamePhase = 'dead';
    state.deathTimer = 120;
  } else {
    gamePhase = 'respawn';
    state.deathTimer = 80;
  }
}

// ─── Boss ────────────────────────────────────────────────────────────────────
const BOSS_CFGS = [
  { w: 60, h: 70, hp: 5, name: 'T-REX',      body: '#9b2335', dark: '#6b1525', glow: '#e94560', bg1: '#0d0005', bg2: '#2a000f', floor: '#3d0015', floorTop: '#6b0025' },
  { w: 80, h: 55, hp: 6, name: 'TRICERATOPS', body: '#0891b2', dark: '#0e7490', glow: '#38bdf8', bg1: '#001520', bg2: '#002a3d', floor: '#003d55', floorTop: '#006b8a' },
  { w: 72, h: 52, hp: 5, name: 'PTEROSAUR',   body: '#7c3aed', dark: '#5b21b6', glow: '#a78bfa', bg1: '#08001a', bg2: '#160035', floor: '#25005a', floorTop: '#4a00a0' },
];

function makeBoss(type) {
  const c    = BOSS_CFGS[type];
  const round = Math.floor(bossCount / 3); // gets harder each full cycle
  const hp   = c.hp + round * 2;
  const startY = type === 2 ? H - 40 - 150 : H - 40 - c.h;
  return { x: W - c.w - 80, y: startY, baseY: startY,
           w: c.w, h: c.h, hp, maxHp: hp, type, round,
           animTimer: 0, stunTimer: 0, facingRight: false,
           dashActive: 0, dashCooldown: 120 };
}

function updateBoss(dt) {
  boss.animTimer += dt;

  // Pterosaur: bobs faster and wilder as HP drops
  if (boss.type === 2) {
    const rage = 1 - boss.hp / boss.maxHp;
    boss.y = boss.baseY + Math.sin(boss.animTimer * (0.04 + rage * 0.035)) * (65 + rage * 50);
  }

  if (boss.stunTimer > 0) {
    boss.stunTimer -= dt;
    boss.dashActive = 0;
  } else {
    const dx = (state.x + state.w / 2) - (boss.x + boss.w / 2);

    // Dash mechanic for T-Rex and Triceratops
    if (boss.type !== 2) {
      if (boss.dashActive > 0) {
        boss.dashActive -= dt;
      } else if (boss.dashCooldown > 0) {
        boss.dashCooldown -= dt;
      } else {
        boss.dashActive   = 28;
        boss.dashCooldown = boss.type === 0 ? 190 : 230;
      }
    }

    const baseSpd    = boss.type === 1 ? 2.5 : boss.type === 0 ? 2.0 : 1.8;
    const roundBonus = (boss.round || 0) * 0.5;
    const rageBonus  = (boss.maxHp - boss.hp) * (boss.type === 1 ? 0.65 : 0.45);
    const dashBonus  = boss.dashActive > 0 ? 4.5 : 0;
    const speed      = baseSpd + roundBonus + rageBonus + dashBonus;

    boss.x += (dx > 0 ? speed : -speed) * dt;
    boss.facingRight = dx > 0;
  }
  boss.x = Math.max(20, Math.min(W - boss.w - 20, boss.x));

  if (rectOverlap(state, boss)) {
    const p = state;
    // Tighter stomp window (top 30% of boss) — harder to hit
    if (p.vy > 0 && p.y + p.h < boss.y + boss.h * 0.3 + 6) {
      boss.hp -= 1;
      boss.dashActive   = 0;
      boss.dashCooldown = 80;
      p.vy = JUMP_FORCE * 0.7;
      boss.stunTimer = 35;
      p.squishY = 0.5; p.squishX = 1.5;
      if (boss.hp <= 0) {
        score += 200 + (boss.round || 0) * 100;
        camera.x = savedCameraX;
        boss = null;
        gamePhase = 'playing';
        SFX.bossdie();
        tryUnlock('flame');
      } else {
        SFX.bosshit();
      }
    } else {
      die();
    }
  }
}

function drawBossArena() {
  const cfg = BOSS_CFGS[boss ? boss.type : 0];
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, cfg.bg1);
  grad.addColorStop(1, cfg.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = cfg.floor;
  ctx.fillRect(0, H - 40, W, 40);
  ctx.fillStyle = cfg.floorTop;
  ctx.fillRect(0, H - 40, W, 4);
  ctx.fillStyle = cfg.bg1;
  ctx.fillRect(0, 0, 20, H);
  ctx.fillRect(W - 20, 0, 20, H);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px "Courier New"';
  ctx.fillStyle = cfg.glow;
  ctx.shadowColor = cfg.glow;
  ctx.shadowBlur = 12;
  ctx.fillText(`★ BOSS: ${cfg.name} ★`, W / 2, 18);
  ctx.restore();
}

function drawBoss() {
  if (!boss) return;
  const cx = Math.round(boss.x + boss.w / 2);
  const cy = Math.round(boss.y + boss.h / 2);
  const sw = boss.w, sh = boss.h;
  const cfg  = BOSS_CFGS[boss.type];
  const stun = boss.stunTimer > 0;
  const body = stun ? '#ffffff' : cfg.body;
  const dark = stun ? '#cccccc' : cfg.dark;
  const glow = stun ? '#ffffff' : cfg.glow;

  ctx.save();
  ctx.translate(cx, cy);
  if (!boss.facingRight) ctx.scale(-1, 1);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 20;

  if (boss.type === 0) {
    // ── T-Rex ──
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-sw*0.3, sh*0.05); ctx.lineTo(-sw*0.85, sh*0.0); ctx.lineTo(-sw*0.3, sh*0.32);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = body;
    ctx.fillRect(-sw*0.3, -sh*0.22, sw*0.65, sh*0.58);
    ctx.fillRect(-sw*0.05,-sh*0.42, sw*0.45, sh*0.25);
    ctx.fillRect( sw*0.12,-sh*0.52, sw*0.52, sh*0.32);
    ctx.fillStyle = dark;
    ctx.fillRect( sw*0.28,-sh*0.26, sw*0.32, sh*0.16);
    ctx.fillRect( sw*0.2,  sh*0.0,  sw*0.2,  sh*0.14);
    ctx.fillRect( sw*0.36, sh*0.1,  sw*0.1,  sh*0.07);
    const legOff0 = stun ? 0 : Math.sin(boss.animTimer * 0.2) * 4;
    ctx.fillRect(-sw*0.05, sh*0.32-legOff0, sw*0.24, sh*0.22);
    ctx.fillRect(-sw*0.05, sh*0.52,         sw*0.30, sh*0.06);
    ctx.fillRect( sw*0.15, sh*0.32+legOff0, sw*0.24, sh*0.22);
    ctx.fillRect( sw*0.15, sh*0.52,         sw*0.30, sh*0.06);
    ctx.shadowBlur = 0;
    ctx.fillStyle = stun ? '#888' : '#ffff00';
    ctx.fillRect(sw*0.2,  -sh*0.48, 8, 8);
    ctx.fillStyle = stun ? '#555' : '#ff0000';
    ctx.fillRect(sw*0.25, -sh*0.44, 5, 5);

  } else if (boss.type === 1) {
    // ── Triceratops ──
    // Short stubby tail
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-sw*0.48, -sh*0.1); ctx.lineTo(-sw*0.78, sh*0.05); ctx.lineTo(-sw*0.48, sh*0.22);
    ctx.closePath(); ctx.fill();
    // Wide low body
    ctx.fillStyle = body;
    ctx.fillRect(-sw*0.48, -sh*0.28, sw*0.88, sh*0.62);
    // Neck frill (behind head)
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(sw*0.2, -sh*0.28); ctx.lineTo(sw*0.3, -sh*0.7); ctx.lineTo(sw*0.62, -sh*0.7); ctx.lineTo(sw*0.72, -sh*0.28);
    ctx.closePath(); ctx.fill();
    // Head
    ctx.fillStyle = body;
    ctx.fillRect(sw*0.28, -sh*0.5, sw*0.55, sh*0.38);
    // Horns (ivory)
    ctx.shadowBlur = 0;
    ctx.fillStyle = stun ? '#ccc' : '#f0f0e0';
    // Left horn
    ctx.beginPath();
    ctx.moveTo(sw*0.38, -sh*0.46); ctx.lineTo(sw*0.25, -sh*0.82); ctx.lineTo(sw*0.5, -sh*0.48);
    ctx.closePath(); ctx.fill();
    // Right horn
    ctx.beginPath();
    ctx.moveTo(sw*0.58, -sh*0.44); ctx.lineTo(sw*0.48, -sh*0.78); ctx.lineTo(sw*0.68, -sh*0.46);
    ctx.closePath(); ctx.fill();
    // Nose horn
    ctx.beginPath();
    ctx.moveTo(sw*0.72, -sh*0.32); ctx.lineTo(sw*0.96, -sh*0.42); ctx.lineTo(sw*0.75, -sh*0.18);
    ctx.closePath(); ctx.fill();
    // Eye
    ctx.fillStyle = stun ? '#888' : '#ffffff';
    ctx.fillRect(sw*0.35, -sh*0.44, 7, 7);
    ctx.fillStyle = stun ? '#555' : '#ff4500';
    ctx.fillRect(sw*0.39, -sh*0.40, 4, 4);
    // Four legs
    const legOff1 = stun ? 0 : Math.sin(boss.animTimer * 0.18) * 3;
    ctx.fillStyle = dark;
    ctx.fillRect(-sw*0.38, sh*0.3-legOff1, sw*0.2, sh*0.28); ctx.fillRect(-sw*0.38, sh*0.54, sw*0.24, sh*0.08);
    ctx.fillRect(-sw*0.12, sh*0.3+legOff1, sw*0.2, sh*0.28); ctx.fillRect(-sw*0.12, sh*0.54, sw*0.24, sh*0.08);
    ctx.fillRect( sw*0.1,  sh*0.3-legOff1, sw*0.2, sh*0.28); ctx.fillRect( sw*0.1,  sh*0.54, sw*0.24, sh*0.08);
    ctx.fillRect( sw*0.32, sh*0.3+legOff1, sw*0.2, sh*0.28); ctx.fillRect( sw*0.32, sh*0.54, sw*0.24, sh*0.08);

  } else {
    // ── Pterosaur ──
    // Wings
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-sw*0.08, -sh*0.05); ctx.lineTo(-sw*0.92, sh*0.32); ctx.lineTo(-sw*0.08, sh*0.28);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo( sw*0.08, -sh*0.05); ctx.lineTo( sw*0.92, sh*0.32); ctx.lineTo( sw*0.08, sh*0.28);
    ctx.closePath(); ctx.fill();
    // Wing membrane highlights
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-sw*0.08, sh*0.0); ctx.lineTo(-sw*0.75, sh*0.28); ctx.lineTo(-sw*0.08, sh*0.22);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // Body
    ctx.fillStyle = body;
    ctx.fillRect(-sw*0.14, -sh*0.3, sw*0.28, sh*0.52);
    // Head crest
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(sw*0.1, -sh*0.28); ctx.lineTo(sw*0.02, -sh*0.7); ctx.lineTo(sw*0.28, -sh*0.28);
    ctx.closePath(); ctx.fill();
    // Head
    ctx.fillStyle = body;
    ctx.fillRect(sw*0.08, -sh*0.42, sw*0.32, sh*0.28);
    // Beak (long, pointed)
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(sw*0.28, -sh*0.3); ctx.lineTo(sw*0.86, -sh*0.36); ctx.lineTo(sw*0.28, -sh*0.18);
    ctx.closePath(); ctx.fill();
    // Eye
    ctx.shadowBlur = 0;
    ctx.fillStyle = stun ? '#888' : '#ffffff';
    ctx.fillRect(sw*0.12, -sh*0.38, 6, 6);
    ctx.fillStyle = stun ? '#555' : '#cc00ff';
    ctx.fillRect(sw*0.16, -sh*0.34, 3, 3);
    // Tiny claws
    ctx.fillStyle = dark;
    const claw = stun ? 0 : Math.sin(boss.animTimer * 0.12) * 3;
    ctx.fillRect(-sw*0.06, sh*0.22+claw, sw*0.1, sh*0.12);
    ctx.fillRect( sw*0.0,  sh*0.22-claw, sw*0.1, sh*0.12);
  }

  ctx.restore();

  // HP bar
  const bx = boss.x, by = boss.y - 18, bw = boss.w;
  ctx.fillStyle = '#111';
  ctx.fillRect(bx, by, bw, 8);
  ctx.fillStyle = glow;
  ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), 8);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, 8);
  ctx.save();
  ctx.textAlign = 'center'; ctx.font = '10px "Courier New"';
  ctx.fillStyle = '#fff';
  ctx.fillText(`HP ${boss.hp}/${boss.maxHp}`, bx + bw / 2, by - 2);
  ctx.restore();
}

// ─── Draw helpers ────────────────────────────────────────────────────────────
function drawPlatform(plat) {
  const x = plat.x - camera.x;
  const y = plat.y;
  const w = plat.w;
  const h = plat.h;

  // Shadow
  ctx.fillStyle = COLOR.platShadow;
  ctx.fillRect(x + 4, y + 4, w, h);

  // Body
  ctx.fillStyle = COLOR.platform;
  ctx.fillRect(x, y, w, h);

  // Top highlight stripe
  ctx.fillStyle = COLOR.platTop;
  ctx.fillRect(x, y, w, 4);

  // Brick lines
  ctx.strokeStyle = COLOR.platShadow;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  for (let bx = x; bx < x + w; bx += 20) {
    ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx, y + h); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCactus(s) {
  const x = Math.round(s.x - camera.x);
  const y = Math.round(s.y);
  const h = s.h;  // 24

  ctx.save();
  ctx.shadowColor = '#4dcc4d';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#2d8a2d';

  // Trunk
  ctx.fillRect(x + 3, y, 5, h);

  // Left arm: horizontal then vertical up
  ctx.fillRect(x,     y + 8, 6, 4);
  ctx.fillRect(x,     y + 3, 4, 5);

  // Right arm: horizontal then vertical up
  ctx.fillRect(x + 7, y + 12, 5, 4);
  ctx.fillRect(x + 8, y + 8,  4, 4);

  // Trunk highlight
  ctx.fillStyle = '#4dcc4d';
  ctx.fillRect(x + 4, y + 1, 2, h - 2);

  ctx.restore();
}

function drawEnemy(e) {
  const x = Math.round(e.x - camera.x);
  const y = Math.round(e.y);
  const bounce = Math.sin(e.animTimer * 0.15) * 2;
  const sw = e.w;
  const sh = e.h;

  ctx.save();
  ctx.translate(x + sw / 2, y + sh / 2 + bounce);
  if (!e.dir || e.dir === -1) ctx.scale(-1, 1);

  ctx.shadowColor = COLOR.enemy;
  ctx.shadowBlur = 8;

  // Tail (stiff, horizontal)
  ctx.fillStyle = '#c07800';
  ctx.beginPath();
  ctx.moveTo(-sw * 0.3,  sh * 0.02);
  ctx.lineTo(-sw * 0.92, -sh * 0.08);
  ctx.lineTo(-sw * 0.3,  sh * 0.26);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = COLOR.enemy;
  ctx.fillRect(-sw * 0.3, -sh * 0.2, sw * 0.6, sh * 0.5);

  // Neck
  ctx.fillRect(-sw * 0.05, -sh * 0.38, sw * 0.35, sh * 0.22);

  // Head (raptor — elongated and low)
  ctx.fillRect(sw * 0.05, -sh * 0.5, sw * 0.58, sh * 0.28);

  // Snout (long, pointed)
  ctx.fillStyle = '#c07800';
  ctx.fillRect(sw * 0.32, -sh * 0.34, sw * 0.4, sh * 0.12);

  // Teeth
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sw * 0.38, -sh * 0.24, 3, 3);
  ctx.fillRect(sw * 0.48, -sh * 0.24, 3, 3);

  // Eye (red and menacing)
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sw * 0.12, -sh * 0.46, 5, 5);
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(sw * 0.16, -sh * 0.42, 3, 3);

  // Sickle arm / claw
  ctx.fillStyle = '#c07800';
  ctx.fillRect(sw * 0.18, -sh * 0.02, sw * 0.16, sh * 0.14);
  ctx.fillRect(sw * 0.3,  sh * 0.1,   sw * 0.08, sh * 0.06);

  // Legs (animated)
  const legOff = Math.sin(e.animTimer * 0.3) * 3;
  ctx.fillStyle = '#a06000';
  ctx.fillRect(-sw * 0.05, sh * 0.28 - legOff, sw * 0.22, sh * 0.2);
  ctx.fillRect(-sw * 0.05, sh * 0.46,           sw * 0.28, sh * 0.06);
  ctx.fillRect( sw * 0.12, sh * 0.28 + legOff,  sw * 0.22, sh * 0.2);
  ctx.fillRect( sw * 0.12, sh * 0.46,            sw * 0.28, sh * 0.06);

  ctx.restore();
}

function drawCoin(c) {
  if (c.collected) return;
  const x = c.x - camera.x + c.w / 2;
  const y = c.y + c.h / 2 + Math.sin(c.animT) * 3;

  ctx.save();
  ctx.shadowColor = COLOR.coinGlow;
  ctx.shadowBlur  = 10;

  // Spinning effect: scale X by cos
  const scaleX = Math.abs(Math.cos(c.animT * 1.5));
  ctx.translate(x, y);
  ctx.scale(scaleX, 1);

  ctx.fillStyle = COLOR.coin;
  ctx.beginPath();
  ctx.arc(0, 0, c.w / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLOR.coinGlow;
  ctx.beginPath();
  ctx.arc(-2, -2, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlayer(p) {
  const cx = Math.round(p.x + p.w / 2 - camera.x);
  const cy = Math.round(p.y + p.h / 2);
  const sw = p.w  * p.squishX;
  const sh = p.h  * p.squishY;

  ctx.save();
  ctx.translate(cx, cy);
  if (!p.facingRight) ctx.scale(-1, 1);

  const sc = skinCol();
  ctx.shadowColor = sc.glow;
  ctx.shadowBlur  = 12;

  // Tail
  ctx.fillStyle = sc.dark;
  ctx.beginPath();
  ctx.moveTo(-sw * 0.3,  sh * 0.05);
  ctx.lineTo(-sw * 0.85, sh * 0.0);
  ctx.lineTo(-sw * 0.3,  sh * 0.32);
  ctx.closePath();
  ctx.fill();

  // Main body
  ctx.fillStyle = sc.body;
  ctx.fillRect(-sw * 0.3, -sh * 0.22, sw * 0.65, sh * 0.58);

  // Neck / shoulder hump
  ctx.fillStyle = sc.body;
  ctx.fillRect(-sw * 0.05, -sh * 0.42, sw * 0.45, sh * 0.25);

  // Head
  ctx.fillStyle = sc.body;
  ctx.fillRect(sw * 0.12, -sh * 0.52, sw * 0.52, sh * 0.32);

  // Lower jaw / snout
  ctx.fillStyle = sc.dark;
  ctx.fillRect(sw * 0.28, -sh * 0.26, sw * 0.32, sh * 0.16);

  // Belly highlight
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = sc.glow;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(-sw * 0.2, -sh * 0.05, sw * 0.28, sh * 0.32);
  ctx.globalAlpha = 1;

  // Tiny arm
  ctx.fillStyle = sc.dark;
  ctx.fillRect(sw * 0.2,  sh * 0.0,  sw * 0.2,  sh * 0.14);
  ctx.fillRect(sw * 0.36, sh * 0.1,  sw * 0.1,  sh * 0.07);

  // Legs (animated)
  const legOff = p.onGround ? Math.sin(p.animTimer * 0.25) * 3 : 0;
  ctx.fillStyle = sc.feet;
  // Back leg
  ctx.fillRect(-sw * 0.05, sh * 0.32 - legOff, sw * 0.24, sh * 0.22);
  ctx.fillRect(-sw * 0.05, sh * 0.52,           sw * 0.30, sh * 0.06);
  // Front leg
  ctx.fillRect( sw * 0.15, sh * 0.32 + legOff,  sw * 0.24, sh * 0.22);
  ctx.fillRect( sw * 0.15, sh * 0.52,            sw * 0.30, sh * 0.06);

  // Eye
  ctx.fillStyle = COLOR.playerEye;
  ctx.fillRect(sw * 0.2,  -sh * 0.48, 6, 6);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(sw * 0.28, -sh * 0.43, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sw * 0.22, -sh * 0.47, 2, 2);

  // Shield aura
  if (p.shieldActive) {
    const pulse = Math.sin(p.animTimer * 0.18) * 0.3 + 0.7;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = `rgba(56,189,248,${pulse})`;
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(-sw * 0.56, -sh * 0.56, sw * 1.12, sh * 1.12);
  }

  ctx.restore();
}

function drawPowerup(pu) {
  if (pu.collected) return;
  const x = pu.x - camera.x + pu.w / 2;
  const y = pu.y + pu.h / 2 + Math.sin(pu.animT) * 4;

  const COLS = {
    heart:  { fill: '#e94560', glow: '#ff6b8a' },
    speed:  { fill: '#ffd700', glow: '#ffec80' },
    jump:   { fill: '#22c55e', glow: '#4ade80' },
    shield: { fill: '#38bdf8', glow: '#7dd3fc' },
  };
  const col = COLS[pu.type];

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = col.glow;
  ctx.shadowBlur  = 14;

  // Dark backing circle
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = col.fill;

  if (pu.type === 'heart') {
    ctx.scale(0.62, 0.62);
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.bezierCurveTo(0, 1, -6, -6, -11, -6);
    ctx.bezierCurveTo(-16, -6, -16, 2, -11, 8);
    ctx.lineTo(0, 17);
    ctx.lineTo(11, 8);
    ctx.bezierCurveTo(16, 2, 16, -6, 11, -6);
    ctx.bezierCurveTo(6, -6, 0, 1, 0, 5);
    ctx.fill();
  } else if (pu.type === 'speed') {
    // Lightning bolt
    ctx.beginPath();
    ctx.moveTo(3, -10);
    ctx.lineTo(-4, 1);
    ctx.lineTo(1,  1);
    ctx.lineTo(-3, 10);
    ctx.lineTo(5,  -1);
    ctx.lineTo(0,  -1);
    ctx.closePath();
    ctx.fill();
  } else if (pu.type === 'jump') {
    // Up arrow
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8,  -2);
    ctx.lineTo(3,  -2);
    ctx.lineTo(3,  10);
    ctx.lineTo(-3, 10);
    ctx.lineTo(-3, -2);
    ctx.lineTo(-8, -2);
    ctx.closePath();
    ctx.fill();
  } else if (pu.type === 'shield') {
    // Shield
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(9, -5);
    ctx.lineTo(9,  2);
    ctx.bezierCurveTo(9, 8, 4, 11, 0, 13);
    ctx.bezierCurveTo(-4, 11, -9, 8, -9, 2);
    ctx.lineTo(-9, -5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawBackground() {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,   COLOR.skyFar);
  grad.addColorStop(1,   COLOR.sky);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Stars (parallax)
  ctx.fillStyle = COLOR.star;
  stars.forEach(s => {
    const sx = ((s.x - camera.x * s.speed) % (W * 3) + W * 3) % (W * 3);
    if (sx < 0 || sx > W) return;
    ctx.globalAlpha = s.alpha;
    ctx.beginPath();
    ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Ground color at bottom
  ctx.fillStyle = COLOR.ground;
  ctx.fillRect(0, H - 8, W, 8);
}

function drawHUD() {
  ctx.save();
  ctx.font = 'bold 20px "Courier New"';
  ctx.textAlign = 'left';
  ctx.shadowColor = COLOR.textShadow;
  ctx.shadowBlur  = 6;
  ctx.fillStyle   = COLOR.text;
  ctx.fillText(`SCORE: ${score}`, 16, 32);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px "Courier New"';
  ctx.fillText(`BEST: ${bestScore}`, 16, 52);

  // Lives hearts
  ctx.textAlign   = 'right';
  ctx.font        = 'bold 22px "Courier New"';
  ctx.fillStyle   = '#e94560';
  ctx.shadowColor = '#ff6b8a';
  ctx.shadowBlur  = 8;
  const heartsStr = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  ctx.fillText(heartsStr, W - 16, 32);

  // Active powerup indicators
  const COLS = { speed: '#ffd700', jump: '#22c55e', shield: '#38bdf8' };
  const LABELS = { speed: '⚡SPEED', jump: '↑JUMP', shield: '◆SHIELD' };
  const DUR = 360;
  const active = [];
  if (state && state.speedBoost  > 0) active.push({ type: 'speed',  t: state.speedBoost });
  if (state && state.jumpBoost   > 0) active.push({ type: 'jump',   t: state.jumpBoost  });
  if (state && state.shieldActive)    active.push({ type: 'shield', t: DUR });
  active.forEach((ind, i) => {
    const bx = 16 + i * 72, by = 62, bw = 66, bh = 22;
    const c = COLS[ind.type];
    ctx.shadowColor = c; ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    // Timer bar
    const frac = Math.min(ind.t / DUR, 1);
    ctx.fillStyle = c; ctx.globalAlpha = 0.35;
    ctx.fillRect(bx, by, bw * frac, bh);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c; ctx.lineWidth = 1.2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.textAlign = 'left'; ctx.font = 'bold 10px "Courier New"';
    ctx.fillStyle = c; ctx.shadowBlur = 4;
    ctx.fillText(LABELS[ind.type], bx + 4, by + 14);
  });

  ctx.restore();
}

function drawDeathScreen() {
  ctx.save();
  ctx.fillStyle = `rgba(233, 69, 96, ${deathFlash * 0.35})`;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = 'bold 56px "Courier New"';
  ctx.shadowColor = '#e94560';
  ctx.shadowBlur  = 20;
  ctx.fillStyle   = '#fff';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 20);

  ctx.font = '20px "Courier New"';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ccc';
  ctx.fillText('Restarting...', W / 2, H / 2 + 24);
  ctx.restore();
}

function drawRespawnScreen() {
  ctx.save();
  ctx.fillStyle = `rgba(233, 69, 96, ${deathFlash * 0.4})`;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = 'bold 52px "Courier New"';
  ctx.shadowColor = '#e94560';
  ctx.shadowBlur  = 18;
  ctx.fillStyle   = '#fff';
  ctx.fillText('OUCH!', W / 2, H / 2 - 24);

  ctx.font = '26px "Courier New"';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#e94560';
  ctx.fillText('♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives)), W / 2, H / 2 + 20);

  ctx.font = '14px "Courier New"';
  ctx.fillStyle = '#aaa';
  ctx.shadowBlur = 4;
  ctx.fillText('Respawning...', W / 2, H / 2 + 52);
  ctx.restore();
}

function drawWinScreen() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 212, 170, 0.15)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = 'bold 52px "Courier New"';
  ctx.shadowColor = '#00d4aa';
  ctx.shadowBlur  = 24;
  ctx.fillStyle   = '#fff';
  ctx.fillText('YOU WIN!', W / 2, H / 2 - 30);

  ctx.font = '22px "Courier New"';
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`Score: ${score}`, W / 2, H / 2 + 16);

  ctx.font = '16px "Courier New"';
  ctx.fillStyle = '#aaa';
  ctx.shadowBlur = 4;
  ctx.fillText('Press SPACE or ENTER to play again', W / 2, H / 2 + 52);
  ctx.restore();

  if (pressing('Space', 'Enter')) initGame();
}

function drawMenuScreen() {
  drawBackground();
  ctx.save();
  ctx.textAlign = 'center';

  // Title — "DINO"
  ctx.font = 'bold 78px "Courier New"';
  ctx.shadowColor = '#4ade80';
  ctx.shadowBlur  = 36;
  ctx.fillStyle   = '#22c55e';
  ctx.fillText('DINO', W / 2, H / 2 - 70);

  // Title — "JUMP"
  ctx.fillStyle   = '#4ade80';
  ctx.shadowColor = '#22c55e';
  ctx.fillText('JUMP', W / 2, H / 2 + 4);

  // Tagline
  ctx.font      = '14px "Courier New"';
  ctx.fillStyle = '#7dd3a8';
  ctx.shadowBlur = 4;
  ctx.fillText('Stomp enemies  ·  Collect coins  ·  Defeat bosses', W / 2, H / 2 + 38);

  // Start button — pulsing glow
  const pulse = Math.sin(Date.now() * 0.003) * 0.2 + 0.8;
  const bx = W / 2 - 90, by = H / 2 + 58, bw = 180, bh = 46;
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur  = 22 * pulse;
  ctx.fillStyle   = `rgba(34,197,94,${0.12 + pulse * 0.08})`;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = `rgba(74,222,128,${pulse})`;
  ctx.lineWidth   = 2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.shadowBlur  = 8;
  ctx.font        = 'bold 22px "Courier New"';
  ctx.fillStyle   = '#ffffff';
  ctx.fillText('\u25b6  START', W / 2, by + 30);

  // Best score
  if (bestScore > 0) {
    ctx.font      = '13px "Courier New"';
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 4;
    ctx.fillText(`Best: ${bestScore}`, W / 2, H / 2 + 124);
  }

  // ── Skin selector ──
  const skin    = SKINS[selectedSkin];
  const locked  = !unlockedSkins.has(skin.id);
  const sy      = H / 2 + 145;
  const arrowW  = 38, arrowH = 28;

  // Left arrow
  ctx.shadowColor = locked ? '#555' : skin.col.glow;
  ctx.shadowBlur  = 6;
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
  ctx.strokeRect(W/2 - 110, sy, arrowW, arrowH);
  ctx.fillStyle = '#aaa'; ctx.font = 'bold 16px "Courier New"';
  ctx.fillText('◀', W/2 - 110 + arrowW/2, sy + 19);

  // Right arrow
  ctx.strokeRect(W/2 + 72, sy, arrowW, arrowH);
  ctx.fillText('▶', W/2 + 72 + arrowW/2, sy + 19);

  // Skin name + color swatch
  const sc2 = skin.col;
  ctx.shadowColor = locked ? '#555' : sc2.glow;
  ctx.shadowBlur  = locked ? 0 : 10;
  // Swatch circle
  ctx.fillStyle = locked ? '#333' : sc2.body;
  ctx.beginPath(); ctx.arc(W/2 - 38, sy + 14, 10, 0, Math.PI*2); ctx.fill();
  if (!locked) {
    ctx.fillStyle = sc2.dark;
    ctx.beginPath(); ctx.arc(W/2 - 38 + 3, sy + 14, 5, 0, Math.PI*2); ctx.fill();
  }
  // Name
  ctx.font      = `bold 14px "Courier New"`;
  ctx.fillStyle = locked ? '#555' : sc2.glow;
  ctx.textAlign = 'left';
  ctx.fillText((locked ? '🔒 ' : '') + skin.name, W/2 - 22, sy + 18);
  // Hint if locked
  if (locked) {
    ctx.font = '10px "Courier New"'; ctx.fillStyle = '#555'; ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.fillText(skin.hint, W/2, sy + 36);
  }
  ctx.textAlign = 'center';

  // Mini-game button
  const mbx = W/2 - 80, mby = H/2 + 188, mbw = 160, mbh = 38;
  const mpulse = Math.sin(Date.now() * 0.0025 + 1.5) * 0.2 + 0.8;
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur  = 14 * mpulse;
  ctx.fillStyle   = `rgba(245,158,11,${0.10 + mpulse * 0.08})`;
  ctx.fillRect(mbx, mby, mbw, mbh);
  ctx.strokeStyle = `rgba(253,230,138,${mpulse})`;
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(mbx, mby, mbw, mbh);
  ctx.shadowBlur  = 6;
  ctx.font        = 'bold 15px "Courier New"';
  ctx.fillStyle   = '#fde68a';
  ctx.textAlign   = 'center';
  ctx.fillText('🦕 MINI GAME', W / 2, mby + 25);

  // Controls hint
  ctx.font      = '12px "Courier New"';
  ctx.fillStyle = '#555';
  ctx.shadowBlur = 0;
  ctx.fillText('Arrow keys / WASD  ·  Space to jump  ·  or click START', W / 2, H - 22);

  ctx.restore();
}

function drawCheckpointFlag(cp) {
  const x = cp.x - camera.x;
  if (x < -20 || x > W + 20) return;
  const y = H - 185;

  // Pole
  ctx.fillStyle = cp.activated ? '#00d4aa' : '#aaa';
  ctx.fillRect(x, y, 4, 145);

  // Flag
  const wave = Math.sin(Date.now() * 0.004) * 5;
  ctx.fillStyle = cp.activated ? '#00d4aa' : '#ffd700';
  ctx.shadowColor = cp.activated ? '#00d4aa' : '#ffd700';
  ctx.shadowBlur = cp.activated ? 10 : 5;
  ctx.beginPath();
  ctx.moveTo(x + 4, y);
  ctx.lineTo(x + 34 + wave, y + 12);
  ctx.lineTo(x + 4, y + 24);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  if (cp.activated) {
    ctx.save();
    ctx.font = 'bold 9px "Courier New"';
    ctx.fillStyle = '#1a1a2e';
    ctx.textAlign = 'center';
    ctx.fillText('✓', x + 18, y + 16);
    ctx.restore();
  }
}

function drawFinishFlag() {
  const x = 5510 - camera.x;
  const y = H - 180;
  if (x < -20 || x > W + 20) return;

  // Pole
  ctx.fillStyle = '#888';
  ctx.fillRect(x, y, 4, 140);

  // Flag
  const wave = Math.sin(Date.now() * 0.005) * 6;
  ctx.fillStyle = '#00d4aa';
  ctx.beginPath();
  ctx.moveTo(x + 4, y);
  ctx.lineTo(x + 44 + wave, y + 15);
  ctx.lineTo(x + 4, y + 30);
  ctx.closePath();
  ctx.fill();
}

// ─── Mini-game ────────────────────────────────────────────────────────────────
const MG = {
  dino: { x: 90, y: 0, vy: 0, w: 32, h: 38, onGround: false, dead: false },
  obstacles: [],
  score: 0,
  highScore: 0,
  speed: 4.5,
  spawnTimer: 0,
  spawnInterval: 90,
  gameOver: false,
  groundY: 0,
};

function initMiniGame() {
  MG.groundY = H - 80;
  MG.dino.x = 90;
  MG.dino.y = MG.groundY - MG.dino.h;
  MG.dino.vy = 0;
  MG.dino.onGround = true;
  MG.dino.dead = false;
  MG.obstacles = [];
  MG.score = 0;
  MG.speed = 4.5;
  MG.spawnTimer = 60;
  MG.spawnInterval = 90;
  MG.gameOver = false;
}

function _mgSpawnObstacle() {
  const type = Math.random() < 0.62 ? 'cactus' : 'ptero';
  if (type === 'cactus') {
    const h = 30 + Math.random() * 24 | 0;
    MG.obstacles.push({ type: 'cactus', x: W + 20, w: 22, h, y: MG.groundY - h });
  } else {
    const fy = MG.groundY - 90 - Math.random() * 60;
    MG.obstacles.push({ type: 'ptero', x: W + 20, w: 38, h: 24, y: fy, wing: 0 });
  }
}

function updateMiniGame(dt) {
  if (MG.gameOver) {
    if (pressing('Space', 'ArrowUp', 'KeyW')) initMiniGame();
    return;
  }

  // Jump
  const wantsJump = pressing('Space', 'ArrowUp', 'KeyW');
  if (wantsJump && MG.dino.onGround) {
    MG.dino.vy = -12;
    MG.dino.onGround = false;
    SFX.jump();
  }

  // Gravity
  MG.dino.vy += GRAVITY * dt;
  if (MG.dino.vy > MAX_FALL) MG.dino.vy = MAX_FALL;
  MG.dino.y += MG.dino.vy * dt;

  // Ground
  if (MG.dino.y >= MG.groundY - MG.dino.h) {
    MG.dino.y = MG.groundY - MG.dino.h;
    MG.dino.vy = 0;
    MG.dino.onGround = true;
  }

  // Scroll speed ramps up
  MG.speed = Math.min(14, 4.5 + MG.score * 0.004);

  // Score
  MG.score += dt * 0.4;

  // Spawn obstacles
  MG.spawnTimer -= dt;
  if (MG.spawnTimer <= 0) {
    _mgSpawnObstacle();
    // Interval shrinks as speed grows
    MG.spawnInterval = Math.max(42, 90 - MG.score * 0.06);
    MG.spawnTimer = MG.spawnInterval + Math.random() * 30;
  }

  // Move obstacles & check collision
  for (let i = MG.obstacles.length - 1; i >= 0; i--) {
    const o = MG.obstacles[i];
    o.x -= MG.speed * dt;
    if (o.type === 'ptero') o.wing = (o.wing + dt * 0.18) % (Math.PI * 2);
    if (o.x + o.w < 0) { MG.obstacles.splice(i, 1); continue; }

    // AABB collision (shrink a little for forgiveness)
    const pad = 5;
    if (MG.dino.x + pad < o.x + o.w - pad &&
        MG.dino.x + MG.dino.w - pad > o.x + pad &&
        MG.dino.y + pad < o.y + o.h - pad &&
        MG.dino.y + MG.dino.h - pad > o.y + pad) {
      MG.gameOver = true;
      if (MG.score > MG.highScore) MG.highScore = MG.score;
      SFX.death();
      return;
    }
  }
}

function drawMiniGame() {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0a1a');
  sky.addColorStop(1, '#1a2a1a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Ground line
  ctx.fillStyle = '#2a4a2a';
  ctx.fillRect(0, MG.groundY, W, H - MG.groundY);
  ctx.fillStyle = '#3a6a3a';
  ctx.fillRect(0, MG.groundY, W, 3);

  // Running score
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px "Courier New"';
  ctx.fillStyle = '#7dd3a8';
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = 6;
  ctx.fillText(`SCORE: ${Math.floor(MG.score)}`, W - 20, 34);
  ctx.fillText(`BEST: ${Math.floor(MG.highScore)}`, W - 20, 56);
  ctx.restore();

  // Back to menu hint
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '11px "Courier New"';
  ctx.fillStyle = '#555';
  ctx.fillText('ESC → menu', 14, 24);
  ctx.restore();

  ctx.save();

  // Draw dino — same shape as main drawPlayer
  const sc = skinCol();
  const d = MG.dino;
  const sw = d.w, sh = d.h;
  const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
  const legOff = d.onGround ? Math.sin(Date.now() * 0.018) * 3 : 0;
  ctx.translate(cx, cy);
  ctx.shadowColor = sc.glow;
  ctx.shadowBlur  = 12;
  // Tail
  ctx.fillStyle = sc.dark;
  ctx.beginPath();
  ctx.moveTo(-sw * 0.3,  sh * 0.05);
  ctx.lineTo(-sw * 0.85, sh * 0.0);
  ctx.lineTo(-sw * 0.3,  sh * 0.32);
  ctx.closePath();
  ctx.fill();
  // Main body
  ctx.fillStyle = sc.body;
  ctx.fillRect(-sw * 0.3, -sh * 0.22, sw * 0.65, sh * 0.58);
  // Neck / shoulder hump
  ctx.fillRect(-sw * 0.05, -sh * 0.42, sw * 0.45, sh * 0.25);
  // Head
  ctx.fillRect(sw * 0.12, -sh * 0.52, sw * 0.52, sh * 0.32);
  // Lower jaw / snout
  ctx.fillStyle = sc.dark;
  ctx.fillRect(sw * 0.28, -sh * 0.26, sw * 0.32, sh * 0.16);
  // Belly highlight
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = sc.glow;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(-sw * 0.2, -sh * 0.05, sw * 0.28, sh * 0.32);
  ctx.globalAlpha = 1;
  // Tiny arm
  ctx.fillStyle = sc.dark;
  ctx.fillRect(sw * 0.2,  sh * 0.0,  sw * 0.2,  sh * 0.14);
  ctx.fillRect(sw * 0.36, sh * 0.1,  sw * 0.1,  sh * 0.07);
  // Legs (animated)
  ctx.fillStyle = sc.feet;
  ctx.fillRect(-sw * 0.05, sh * 0.32 - legOff, sw * 0.24, sh * 0.22);
  ctx.fillRect(-sw * 0.05, sh * 0.52,           sw * 0.30, sh * 0.06);
  ctx.fillRect( sw * 0.15, sh * 0.32 + legOff,  sw * 0.24, sh * 0.22);
  ctx.fillRect( sw * 0.15, sh * 0.52,            sw * 0.30, sh * 0.06);
  // Eye
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sw * 0.2,  -sh * 0.48, 6, 6);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(sw * 0.28, -sh * 0.43, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sw * 0.22, -sh * 0.47, 2, 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Draw obstacles
  for (const o of MG.obstacles) {
    if (o.type === 'cactus') {
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(o.x + 7, o.y, 8, o.h);             // trunk
      ctx.fillRect(o.x, o.y + 8, 22, 8);               // arms base
      ctx.fillRect(o.x, o.y, 7, 18);                   // left arm
      ctx.fillRect(o.x + 15, o.y + 4, 7, 14);          // right arm
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(o.x + 8, o.y, 6, 4);                // tip
    } else {
      // Pterodactyl
      ctx.shadowColor = '#a78bfa';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#7c3aed';
      const wFlap = Math.sin(o.wing) * 8;
      // Body
      ctx.fillRect(o.x + 8, o.y + 6, 20, 12);
      // Beak
      ctx.fillRect(o.x + 28, o.y + 8, 10, 5);
      // Wings
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(o.x, o.y + wFlap, 10, 10);          // left wing
      ctx.fillRect(o.x + 26, o.y - wFlap, 12, 8);      // right wing
      // Eye
      ctx.fillStyle = '#fff';
      ctx.fillRect(o.x + 26, o.y + 7, 4, 4);
      ctx.fillStyle = '#000';
      ctx.fillRect(o.x + 27, o.y + 8, 2, 2);
    }
  }

  ctx.shadowBlur = 0;
  ctx.restore();

  if (MG.gameOver) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 38px "Courier New"';
    ctx.fillStyle = '#e94560';
    ctx.shadowColor = '#e94560';
    ctx.shadowBlur = 22;
    ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
    ctx.font = '18px "Courier New"';
    ctx.fillStyle = '#7dd3a8';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 8;
    ctx.fillText(`Score: ${Math.floor(MG.score)}`, W / 2, H / 2 + 22);
    ctx.font = 'bold 15px "Courier New"';
    ctx.fillStyle = '#aaa';
    ctx.shadowBlur = 0;
    ctx.fillText('SPACE / UP to restart  ·  ESC to menu', W / 2, H / 2 + 58);
    ctx.restore();
  }
}

// ─── Main loop ───────────────────────────────────────────────────────────────
function loop(ts) {
  requestAnimationFrame(loop);

  update(ts);
  updateMusic();

  if (gamePhase === 'menu') { drawMenuScreen(); return; }
  if (gamePhase === 'minigame') { drawMiniGame(); return; }

  if (boss !== null) {
    // Boss arena
    drawBossArena();
    ctx.save();
    drawBoss();
    drawPlayer(state);
    ctx.restore();
  } else {
    // Normal level
    drawBackground();
    ctx.save();
    level.platforms.forEach(drawPlatform);
    level.coins.forEach(drawCoin);
    level.powerups.forEach(drawPowerup);
    level.spikes.forEach(drawCactus);
    level.enemies.forEach(drawEnemy);
    checkpointFlags.forEach(drawCheckpointFlag);
    drawFinishFlag();
    drawPlayer(state);
    ctx.restore();
  }

  drawHUD();
  // Checkpoint notification
  if (checkpointMsg > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, checkpointMsg / 30);
    ctx.font = 'bold 22px "Courier New"';
    ctx.fillStyle = '#00d4aa';
    ctx.shadowColor = '#00d4aa';
    ctx.shadowBlur = 14;
    ctx.fillText('✓ CHECKPOINT!', W / 2, H / 2 - 70);
    ctx.restore();
  }
  // Powerup pickup notification
  if (powerupMsg > 0) {
    const PCOLS  = { heart: '#e94560', speed: '#ffd700', jump: '#22c55e', shield: '#38bdf8' };
    const PNAMES = { heart: '+1 LIFE!', speed: 'SPEED BOOST!', jump: 'SUPER JUMP!', shield: 'SHIELD ON!' };
    const pc = PCOLS[powerupMsgType] || '#fff';
    ctx.save();
    ctx.textAlign  = 'center';
    ctx.globalAlpha = Math.min(1, powerupMsg / 25);
    ctx.font        = 'bold 24px "Courier New"';
    ctx.fillStyle   = pc;
    ctx.shadowColor = pc;
    ctx.shadowBlur  = 16;
    ctx.fillText(PNAMES[powerupMsgType] || 'POWER UP!', W / 2, H / 2 - 100);
    ctx.restore();
  }
  if (gamePhase === 'dead')    drawDeathScreen();
  if (gamePhase === 'respawn') drawRespawnScreen();
  if (gamePhase === 'win')     drawWinScreen();

  // Skin unlock notification
  if (skinUnlockMsg > 0) {
    ctx.save();
    ctx.textAlign  = 'center';
    ctx.globalAlpha = Math.min(1, skinUnlockMsg / 30);
    ctx.font        = 'bold 17px "Courier New"';
    ctx.fillStyle   = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 14;
    ctx.fillText(`✨ SKIN UNLOCKED: ${skinUnlockName}!`, W / 2, H / 2 - 130);
    ctx.restore();
  }
}

requestAnimationFrame(loop);
