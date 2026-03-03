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
  player:     '#00d4aa',
  playerEye:  '#ffffff',
  playerFeet: '#00a07a',
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
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup',   e => { keys[e.code] = false; });

function pressing(...codes) {
  return codes.some(c => keys[c]);
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

  // Ground floor (very wide)
  platforms.push({ x: -200, y: H - 40, w: 600, h: 40, deadly: false });

  // Pit then continue
  platforms.push({ x: 500, y: H - 40, w: 300, h: 40, deadly: false });
  platforms.push({ x: 900, y: H - 40, w: 500, h: 40, deadly: false });

  // Floating platforms — hand-crafted course
  const fp = [
    { x: 150,  y: 310, w: 100 },
    { x: 320,  y: 240, w: 90  },
    { x: 500,  y: 170, w: 110 },
    { x: 680,  y: 250, w: 80  },
    { x: 820,  y: 310, w: 100 },
    { x: 980,  y: 220, w: 120 },
    { x: 1160, y: 155, w: 90  },
    { x: 1320, y: 240, w: 80  },
    { x: 1470, y: 300, w: 120 },
    { x: 1660, y: 200, w: 100 },
    { x: 1830, y: 130, w: 110 },
    { x: 2020, y: 220, w: 80  },
    { x: 2180, y: 290, w: 120 },
    { x: 2380, y: 170, w: 100 },
    { x: 2560, y: 240, w: 90  },
    { x: 2730, y: 310, w: 80  },
  ];

  fp.forEach(p => platforms.push({ x: p.x, y: p.y, w: p.w, h: 18, deadly: false }));

  // Spikes on some platforms
  const spikyPlatIdx = [1, 3, 5, 7, 9, 11, 13];
  spikyPlatIdx.forEach(i => {
    const p = fp[i];
    if (!p) return;
    const count = Math.floor(p.w / 18);
    const startX = p.x + (p.w - count * 18) / 2;
    for (let j = 0; j < count; j++) {
      spikes.push({ x: startX + j * 18 + 3, y: p.y - 14, w: 12, h: 14, platY: p.y });
    }
  });

  // Ground spikes in pits/danger zones
  [
    { x: 420, count: 4 },
    { x: 600, count: 3 },
  ].forEach(({ x, count }) => {
    for (let j = 0; j < count; j++) {
      spikes.push({ x: x + j * 18, y: H - 54, w: 12, h: 14, platY: H - 40 });
    }
  });

  // Enemies on some platforms
  const enemyPlatIdx = [0, 2, 4, 6, 8, 10, 12, 14];
  enemyPlatIdx.forEach(i => {
    const p = fp[i];
    if (!p) return;
    enemies.push({
      x: p.x + p.w / 2 - 10,
      y: p.y - 22,
      w: 20, h: 22,
      dir: 1,
      speed: 0.8 + Math.random() * 0.5,
      minX: p.x + 5,
      maxX: p.x + p.w - 25,
      animTimer: 0,
    });
  });

  // Coins
  fp.forEach((p, i) => {
    if (i % 2 === 0) {
      coins.push({ x: p.x + p.w / 2 - 8, y: p.y - 36, w: 16, h: 16, collected: false, animT: Math.random() * Math.PI * 2 });
    }
  });

  // Finish flag platform
  platforms.push({ x: 2800, y: H - 40, w: 200, h: 40, deadly: false });

  return { platforms, spikes, enemies, coins };
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
    animTimer: 0,
    squishY: 1, squishX: 1,
    dead: false,
    deathTimer: 0,
  };
}

// ─── Game state ──────────────────────────────────────────────────────────────
let state;
let level;
let camera;
let score;
let bestScore = 0;
let gamePhase; // 'playing' | 'dead' | 'win'
let deathFlash;

function initGame() {
  level      = buildLevel();
  state      = makePlayer();
  camera     = { x: 0 };
  score      = 0;
  gamePhase  = 'playing';
  deathFlash = 0;
}

initGame();

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

  deathFlash = Math.max(0, deathFlash - dt * 0.05);

  if (gamePhase === 'dead') {
    state.deathTimer -= dt;
    if (state.deathTimer <= 0) initGame();
    return;
  }

  if (gamePhase === 'win') return;

  const p = state;
  p.animTimer += dt;

  // ── Input ──
  const left  = pressing('ArrowLeft',  'KeyA');
  const right = pressing('ArrowRight', 'KeyD');
  const jump  = pressing('ArrowUp',    'KeyW', 'Space');

  if (left)  { p.vx -= 1.2 * dt; p.facingRight = false; }
  if (right) { p.vx += 1.2 * dt; p.facingRight = true;  }

  // Clamp horizontal speed
  p.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, p.vx));

  // Friction when no key pressed
  if (!left && !right) p.vx *= Math.pow(FRICTION, dt);

  // Gravity
  p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);

  // Coyote time & jump buffer
  if (p.onGround) p.coyoteTime = 8;
  else            p.coyoteTime = Math.max(0, p.coyoteTime - dt);

  if (jump) p.jumpBuffer = 8;
  else      p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

  if (p.jumpBuffer > 0 && p.coyoteTime > 0) {
    p.vy = JUMP_FORCE;
    p.jumpBuffer = 0;
    p.coyoteTime = 0;
    p.squishY = 1.4;
    p.squishX = 0.7;
  }

  // Variable jump height — release to fall faster
  if (!jump && p.vy < -4) p.vy += 0.6 * dt;

  // Move
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // Reset ground flag
  p.onGround = false;

  // Platform collisions
  level.platforms.forEach(plat => {
    if (rectOverlap(p, plat)) resolvePlatform(p, plat);
  });

  // Squish recovery
  p.squishY += (1 - p.squishY) * 0.2 * dt;
  p.squishX += (1 - p.squishX) * 0.2 * dt;

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
      } else if (!e.dead) {
        die();
        return;
      }
    }
  });
  level.enemies = level.enemies.filter(e => !e.dead);

  // ── Spike collisions ──
  level.spikes.forEach(s => {
    // Shrink hitbox slightly for fairness
    const sh = { x: s.x + 2, y: s.y + 2, w: s.w - 4, h: s.h - 2 };
    if (rectOverlap(p, sh)) die();
  });

  // ── Coin collection ──
  level.coins.forEach(c => {
    if (!c.collected && rectOverlap(p, c)) {
      c.collected = true;
      score += 10;
    }
    c.animT += 0.05 * dt;
  });

  // ── Fall off world ──
  if (p.y > H + 80) die();

  // ── Left boundary ──
  if (p.x < 0) { p.x = 0; p.vx = 0; }

  // ── Win condition ──
  if (p.x > 2850) {
    gamePhase = 'win';
    if (score > bestScore) bestScore = score;
  }

  // ── Camera ──
  const targetX = p.x - W * 0.35;
  camera.x += (targetX - camera.x) * 0.1 * dt;
  camera.x = Math.max(0, camera.x);
}

function die() {
  if (gamePhase !== 'playing') return;
  gamePhase = 'dead';
  state.deathTimer = 90;
  deathFlash = 1;
  if (score > bestScore) bestScore = score;
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

function drawSpike(s) {
  const x = s.x - camera.x;
  const y = s.y;

  // Glow
  ctx.save();
  ctx.shadowColor = COLOR.spikeGlow;
  ctx.shadowBlur = 8;

  ctx.fillStyle = COLOR.spike;
  ctx.beginPath();
  ctx.moveTo(x,           y + s.h);
  ctx.lineTo(x + s.w / 2, y);
  ctx.lineTo(x + s.w,     y + s.h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemy(e) {
  const x = Math.round(e.x - camera.x);
  const y = Math.round(e.y);
  const bounce = Math.sin(e.animTimer * 0.15) * 2;

  ctx.save();
  ctx.translate(x + e.w / 2, y + e.h / 2 + bounce);
  if (!e.dir || e.dir === -1) ctx.scale(-1, 1);

  // Body
  ctx.fillStyle = COLOR.enemy;
  ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);

  // Eyes
  ctx.fillStyle = COLOR.enemyEye;
  ctx.fillRect(2,  -e.h / 2 + 4, 5, 5);

  // Feet animation
  const legOff = Math.sin(e.animTimer * 0.3) * 3;
  ctx.fillStyle = '#c07800';
  ctx.fillRect(-e.w / 2,      e.h / 2 - 5 + legOff,  6, 5);
  ctx.fillRect( e.w / 2 - 6,  e.h / 2 - 5 - legOff,  6, 5);

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

  // Body glow
  ctx.shadowColor = COLOR.player;
  ctx.shadowBlur  = 12;

  // Body
  ctx.fillStyle = COLOR.player;
  ctx.fillRect(-sw / 2, -sh / 2, sw, sh);

  // Feet
  const legOff = p.onGround ? Math.sin(p.animTimer * 0.25) * 3 : 0;
  ctx.fillStyle = COLOR.playerFeet;
  ctx.fillRect(-sw / 2,       sh / 2 - 6 + legOff, sw * 0.4, 6);
  ctx.fillRect( sw / 2 * 0.1, sh / 2 - 6 - legOff, sw * 0.4, 6);

  // Eye
  ctx.shadowBlur = 0;
  ctx.fillStyle  = COLOR.playerEye;
  ctx.fillRect(sw * 0.1, -sh * 0.2, 6, 6);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(sw * 0.2, -sh * 0.15, 3, 3);

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
  // Score
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
  ctx.fillText('YOU DIED', W / 2, H / 2 - 20);

  ctx.font = '20px "Courier New"';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ccc';
  ctx.fillText('Restarting...', W / 2, H / 2 + 24);
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

function drawFinishFlag() {
  const x = 2860 - camera.x;
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

// ─── Main loop ───────────────────────────────────────────────────────────────
function loop(ts) {
  requestAnimationFrame(loop);

  update(ts);

  // Draw
  drawBackground();

  ctx.save();
  // Platforms
  level.platforms.forEach(drawPlatform);
  // Coins
  level.coins.forEach(drawCoin);
  // Spikes
  level.spikes.forEach(drawSpike);
  // Enemies
  level.enemies.forEach(drawEnemy);
  // Finish flag
  drawFinishFlag();
  // Player
  drawPlayer(state);
  ctx.restore();

  // HUD
  drawHUD();

  // Overlay screens
  if (gamePhase === 'dead') drawDeathScreen();
  if (gamePhase === 'win')  drawWinScreen();
}

requestAnimationFrame(loop);
