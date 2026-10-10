/* ============ 第二部分：渲染 · 交互 · 主循环 ============ */

/* ---------- Canvas 设置 ---------- */
const canvas = $('game');
const ctx = canvas.getContext('2d');
const PX = 32; // 每格渲染像素（16逻辑像素 x2 缩放）
canvas.width = VIEW.w * PX;
canvas.height = VIEW.h * PX;

function drawPixelTile(gx, gy, color) {
  ctx.fillStyle = color;
  ctx.fillRect(gx * PX, gy * PX, PX, PX);
}

/* 简单像素画：玩家（16x16逻辑，按格画） */
function drawPlayer(gx, gy, facing) {
  const x = gx * PX, y = gy * PX;
  // 影子
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(x + PX / 2, y + PX - 3, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // 身体（根据职业上色）
  const clsColor = G.cls === 'warrior' ? '#c95b4e' : G.cls === 'mage' ? '#4e6fe0' : '#5b8f4e';
  ctx.fillStyle = clsColor;
  ctx.fillRect(x + 5, y + 6, 6, 8);
  // 头
  ctx.fillStyle = '#e8c39a';
  ctx.fillRect(x + 4, y + 1, 8, 6);
  // 头发
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x + 4, y + 1, 8, 2);
  // 眼睛（方向）
  ctx.fillStyle = '#1a1a22';
  const ex = facing === 1 ? x + 10 : x + 5;
  ctx.fillRect(ex, y + 4, 2, 2);
  // 武器
  ctx.fillStyle = '#d4d4e0';
  if (facing === 1) ctx.fillRect(x + 11, y + 7, 2, 7);
  else ctx.fillRect(x + 3, y + 7, 2, 7);
  // 斗篷
  ctx.fillStyle = G.cls === 'warrior' ? '#7a2a22' : G.cls === 'mage' ? '#2a3a7a' : '#2a5a3a';
  ctx.fillRect(x + 5, y + 13, 6, 2);
}

function drawEnemy(e) {
  const x = e.x * PX, y = e.y * PX;
  // 影子
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(x + PX / 2, y + PX - 3, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  // 受击闪烁
  if (e.hurtT > 0) { ctx.globalAlpha = .5; }
  // 身体
  const s = e.isBoss ? 1.6 : 1;
  ctx.fillStyle = e.color;
  if (e.type === 'slime') {
    ctx.beginPath(); ctx.ellipse(x + PX / 2, y + PX - 4, 8 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a2a1f'; ctx.fillRect(x + PX / 2 - 3, y + PX / 2 - 2, 2, 2); ctx.fillRect(x + PX / 2 + 3, y + PX / 2 - 2, 2, 2);
  } else if (e.type === 'ghost') {
    ctx.globalAlpha = .65;
    ctx.beginPath(); ctx.arc(x + PX / 2, y + PX / 2 - 2, 7 * s, Math.PI, 0); ctx.lineTo(x + PX - 2, y + PX - 4); ctx.lineTo(x + 2, y + PX - 4); ctx.fill();
  } else if (e.type === 'bat') {
    ctx.fillStyle = '#3a2a5a';
    ctx.beginPath(); ctx.moveTo(x + PX / 2, y + PX / 2 - 2);
    ctx.lineTo(x + 1, y + 4); ctx.lineTo(x + 6, y + 9); ctx.lineTo(x + PX / 2, y + 6);
    ctx.lineTo(x + PX - 6, y + 9); ctx.lineTo(x + PX - 1, y + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4444'; ctx.fillRect(x + PX / 2 - 2, y + 2, 4, 2);
  } else if (e.isBoss) {
    ctx.fillStyle = '#2a1a1a';
    ctx.beginPath(); ctx.arc(x + PX / 2, y + PX / 2 - 3, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(x + PX / 2, y + PX / 2 - 4, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffdd00'; ctx.fillRect(x + PX / 2 - 4, y + 2, 2, 3); ctx.fillRect(x + PX / 2 + 3, y + 2, 2, 3);
    ctx.fillStyle = '#ff2222'; ctx.fillRect(x + PX / 2 - 2, y + PX / 2 + 2, 2, 2); ctx.fillRect(x + PX / 2 + 2, y + PX / 2 + 2, 2, 2);
  } else {
    // 通用人形
    ctx.fillStyle = e.color;
    ctx.fillRect(x + 5, y + 6, 6, 8);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 4, y + 1, 8, 5);
    ctx.fillStyle = '#ff2222'; ctx.fillRect(x + PX / 2 - 2, y + 4, 2, 2); ctx.fillRect(x + PX / 2 + 2, y + 4, 2, 2);
  }
  ctx.globalAlpha = 1;
  // 血条
  if (e.hp < e.maxHp) {
    ctx.fillStyle = '#0a0d13';
    ctx.fillRect(x + 2, y - 6, PX - 4, 4);
    ctx.fillStyle = '#e05252';
    ctx.fillRect(x + 2, y - 6, Math.max(1, (PX - 4) * (e.hp / e.maxHp)), 4);
  }
}

/* ---------- 浮动文字 ---------- */
function addFloating(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 1.0 });
}
let hintTimer = null;
function showHint(text) {
  const h = $('floatHint');
  h.textContent = text;
  h.style.display = 'block';
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.style.display = 'none', 1600);
}

/* ---------- 相机 ---------- */
function cameraPos() {
  const cx = G.x * PX - canvas.width / 2 + PX / 2;
  const cy = G.y * PX - canvas.height / 2 + PX / 2;
  return {
    x: clamp(cx, 0, MAP_W * PX - canvas.width),
    y: clamp(cy, 0, MAP_H * PX - canvas.height),
  };
}

/* ---------- 渲染 ---------- */
let walkAnim = 0;
function render(dt) {
  const A = AREAS[G.area];
  ctx.fillStyle = A.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cam = cameraPos();
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // 地面（只画视野内）
  const sx = Math.floor(cam.x / PX), sy = Math.floor(cam.y / PX);
  const ex = sx + VIEW.w + 1, ey = sy + VIEW.h + 1;
  for (let y = sy; y <= ey; y++) {
    for (let x = sx; x <= ex; x++) {
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      const isWall = world[G.area][y][x] === 1;
      if (isWall) {
        ctx.fillStyle = A.wall;
        ctx.fillRect(x * PX, y * PX, PX, PX);
        ctx.fillStyle = 'rgba(0,0,0,.2)';
        ctx.fillRect(x * PX, y * PX, PX, 3);
      } else {
        ctx.fillStyle = ((x + y) % 2 === 0) ? A.ground : A.ground2;
        ctx.fillRect(x * PX, y * PX, PX, PX);
        // 装饰草/石
        if (((x * 7 + y * 13) % 23) === 0) {
          ctx.fillStyle = 'rgba(255,255,255,.06)';
          ctx.fillRect(x * PX + 6, y * PX + 10, 3, 3);
        }
      }
    }
  }

  // 出口标记
  ctx.fillStyle = 'rgba(212,162,78,.5)';
  ctx.fillRect(A.exit.x * PX, A.exit.y * PX, PX, PX);
  ctx.fillStyle = '#d4a24e';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('➜', A.exit.x * PX + PX / 2, A.exit.y * PX + 14);

  // NPC
  const npc = A.npc;
  if (npc) {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(npc.icon, npc.x * PX + PX / 2, npc.y * PX + 22);
    // 头顶名字
    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText(npc.name, npc.x * PX + PX / 2, npc.y * PX + 2);
  }

  // 掉落物
  for (const l of loots) {
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(l.icon, l.x * PX + PX / 2, l.y * PX + PX - 2);
  }

  // 敌人
  for (const e of enemies) {
    if (!e.alive) continue;
    drawEnemy(e);
  }

  // 玩家
  drawPlayer(G.px, G.py, moveDir.right || !moveDir.left ? 1 : -1);

  // 投射物
  if (projectile) {
    ctx.fillStyle = projectile.color;
    ctx.beginPath(); ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,136,51,.3)';
    ctx.beginPath(); ctx.arc(projectile.x, projectile.y, 9, 0, Math.PI * 2); ctx.fill();
  }

  // 粒子
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  // 浮动文字
  for (const f of floatingTexts) {
    ctx.globalAlpha = clamp(f.life * 2, 0, 1);
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // 区域名（顶部角落）
  ctx.fillStyle = 'rgba(11,13,18,.65)';
  ctx.fillRect(6, 6, 130, 20);
  ctx.fillStyle = '#d4a24e';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('📍 ' + A.name, 12, 20);
}

/* ---------- 敌人AI ---------- */
function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.hurtT > 0) e.hurtT -= dt;
    if (e.attackCd > 0) e.attackCd -= dt;
    const dx = G.x - e.x, dy = G.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1.2) {
      if (e.attackCd <= 0) {
        enemyAttack(e);
        e.attackCd = 1.1;
      }
    } else if (dist <= e.aggro) {
      // 追击（简单寻路：优先主轴）
      const steps = Math.round(e.speed * dt * 2);
      for (let i = 0; i < steps; i++) {
        if (Math.abs(dx) > Math.abs(dy)) {
          tryMoveEnemy(e, Math.sign(dx), 0);
        } else {
          tryMoveEnemy(e, 0, Math.sign(dy));
        }
      }
    }
  }
}

function tryMoveEnemy(e, dx, dy) {
  const nx = e.x + dx, ny = e.y + dy;
  if (nx < 1 || ny < 1 || nx >= MAP_W - 1 || ny >= MAP_H - 1) return;
  if (world[G.area][ny][nx] === 1) return;
  if (nx === G.x && ny === G.y) return;
  // 不与其它敌人重叠
  for (const o of enemies) { if (o !== e && o.alive && o.x === nx && o.y === ny) return; }
  e.x = nx; e.y = ny;
}

/* ---------- 掉落拾取 ---------- */
function pickupLoot() {
  for (let i = loots.length - 1; i >= 0; i--) {
    const l = loots[i];
    if (Math.abs(l.x - G.x) < 1 && Math.abs(l.y - G.y) < 1) {
      if (l.type === 'gold') {
        G.gold += l.amt;
        addFloating(G.x * PX + PX / 2, G.y * PX, '+' + l.amt + '💰', '#ffcc66');
        sfx.coin();
      } else if (l.type === 'item') {
        G.inv[l.item] = (G.inv[l.item] || 0) + 1;
        addFloating(G.x * PX + PX / 2, G.y * PX, '+' + ITEMS[l.item].name, '#66ccff');
        sfx.pickup();
      }
      loots.splice(i, 1);
    }
  }
}

/* ---------- 粒子/文字/投射物更新 ---------- */
function updateFx(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 120 * dt; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const f = floatingTexts[i];
    f.y -= 22 * dt; f.life -= dt;
    if (f.life <= 0) floatingTexts.splice(i, 1);
  }
  for (let i = loots.length - 1; i >= 0; i--) {
    loots[i].life -= dt;
    if (loots[i].life <= 0) loots.splice(i, 1);
  }
  if (projectile) {
    const p = projectile;
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d <= step) {
      // 命中
      const target = nearestEnemy(0.6);
      if (target) {
        target.hp -= p.dmg;
        target.hurtT = .4;
        addFloating(target.x * PX + PX / 2, target.y * PX - 4, '-' + p.dmg, '#ff8833');
        sfx.hit();
        particles.push({ x: p.tx, y: p.ty, vx: rand(-80, 80), vy: rand(-80, 0), life: .5, color: p.color });
        if (target.hp <= 0) killEnemy(target);
      }
      projectile = null;
    } else {
      p.x += dx / d * step; p.y += dy / d * step;
    }
  }
}

/* ---------- NPC交互 ---------- */
function interact() {
  const A = AREAS[G.area];
  const npc = A.npc;
  if (!npc) { showHint('这里没有可交谈的对象'); return; }
  const d = Math.hypot(npc.x - G.x, npc.y - G.y);
  if (d > 1.8) { showHint('靠近 NPC 再交谈'); return; }
  sfx.npc();
  const text = npc.texts[Math.floor(Math.random() * npc.texts.length)];
  showDialog(npc.icon + ' ' + npc.name, text, [
    { label: A.shop ? '🛒 商店' : '关闭', fn: () => { hideDialog(); if (A.shop) openShop(); } },
    { label: '关闭', fn: hideDialog },
  ]);
}

/* ---------- 商店 ---------- */
function openShop() {
  const items = ['potion', 'mpotion', 'sword1', 'sword2', 'sword3', 'armor1', 'armor2', 'armor3', 'ring'];
  // 按区域解锁高级装备
  const unlock = {
    0: ['potion', 'mpotion', 'sword1', 'armor1'],
    1: ['potion', 'mpotion', 'sword1', 'sword2', 'armor1', 'armor2'],
    2: ['potion', 'mpotion', 'sword2', 'armor2', 'ring'],
    3: ['potion', 'mpotion', 'sword2', 'sword3', 'armor2', 'armor3', 'ring'],
    4: ['potion', 'mpotion', 'sword3', 'armor3', 'ring'],
  }[G.area] || items;
  showDialog('🛒 旅行商店', '金币：' + G.gold, [
    ...unlock.map(id => ({
      label: ITEMS[id].icon + ' ' + ITEMS[id].name + '（' + ITEMS[id].price + '💰）',
      fn: () => {
        if (G.gold >= ITEMS[id].price) {
          G.gold -= ITEMS[id].price;
          G.inv[id] = (G.inv[id] || 0) + 1;
          sfx.coin();
          showHint('购买了 ' + ITEMS[id].name);
          openShop();
        } else {
          showHint('金币不足');
        }
      }
    })),
    { label: '离开', fn: hideDialog },
  ]);
}

/* ---------- 背包 ---------- */
function openBag() {
  const list = $('bagList');
  list.innerHTML = '';
  let has = false;
  for (const id in G.inv) {
    const count = G.inv[id];
    if (!count) continue;
    has = true;
    const it = ITEMS[id];
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = '<span class="nm">' + it.icon + ' ' + it.name + ' ×' + count + '</span>' +
      '<span class="pr">' + (it.type === 'consumable' ? '使用' : '装备') + '</span>';
    row.onclick = () => {
      if (it.type === 'consumable') useItem(id);
      else equipItem(id);
    };
    row.title = it.desc;
    list.appendChild(row);
  }
  if (!has) list.innerHTML = '<div class="dim" style="text-align:center;padding:20px 0">背包空空如也…</div>';
  // 当前装备信息
  const eq = document.createElement('div');
  eq.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid #1e2840;font-size:11px;color:var(--dim);line-height:1.8';
  eq.innerHTML = '武器：' + (G.weapon ? ITEMS[G.weapon].icon + ' ' + ITEMS[G.weapon].name : '无') +
    '<br>防具：' + (G.armor ? ITEMS[G.armor].icon + ' ' + ITEMS[G.armor].name : '无') +
    '<br>戒指：' + (G.ring ? ITEMS[G.ring].icon + ' ' + ITEMS[G.ring].name : '无');
  list.appendChild(eq);
  $('modalBag').classList.add('show');
}

function useItem(id) {
  const it = ITEMS[id];
  if (id === 'potion') {
    if (G.hp >= G.maxHp) { showHint('生命已满'); return; }
    G.hp = Math.min(G.maxHp, G.hp + it.heal);
    sfx.potion();
  } else if (id === 'mpotion') {
    if (G.mp >= G.maxMp) { showHint('法力已满'); return; }
    G.mp = Math.min(G.maxMp, G.mp + it.mp);
    sfx.potion();
  } else return;
  G.inv[id]--;
  if (G.inv[id] <= 0) delete G.inv[id];
  showHint('使用了 ' + it.name);
  openBag();
}

function equipItem(id) {
  const it = ITEMS[id];
  if (it.type === 'weapon') G.weapon = id;
  else if (it.type === 'armor') G.armor = id;
  else if (it.type === 'ring') G.ring = id;
  recalc();
  sfx.equip();
  showHint('装备了 ' + it.name);
  G.inv[id]--;
  if (G.inv[id] <= 0) delete G.inv[id];
  openBag();
}

/* ---------- 对话框 ---------- */
function showDialog(title, text, btns) {
  $('dlgTitle').textContent = title;
  $('dlgText').innerHTML = text;
  const box = $('dlgBtns');
  box.innerHTML = '';
  for (const b of btns) {
    const btn = document.createElement('button');
    btn.className = 'itemBtn';
    btn.textContent = b.label;
    btn.onclick = () => b.fn && b.fn();
    box.appendChild(btn);
  }
  $('modalDialog').classList.add('show');
}
function hideDialog() { $('modalDialog').classList.remove('show'); }

/* ---------- UI更新 ---------- */
function updateUI() {
  $('hpBar').style.width = (G.hp / G.maxHp * 100) + '%';
  $('mpBar').style.width = (G.mp / G.maxMp * 100) + '%';
  $('xpBar').style.width = (G.xp / G.xpNext * 100) + '%';
  $('hpVal').textContent = G.hp + '/' + G.maxHp;
  $('mpVal').textContent = G.mp + '/' + G.maxMp;
  $('xpVal').textContent = G.xp + '/' + G.xpNext;
  $('lvVal').textContent = G.lv;
  $('goldVal').textContent = G.gold;
  $('atkVal').textContent = G.atk;
  $('skillName').textContent = CLASSES[G.cls].skill.name;
  updateLoc();
}
function updateLoc() {
  $('locVal').textContent = '📍 ' + AREAS[G.area].name;
}

/* ---------- 游戏流程 ---------- */
function startGame(cls) {
  newGame(cls);
  buildWorld();
  spawnEnemies();
  $('screen-title').style.display = 'none';
  $('screen-game').style.display = 'flex';
  updateUI();
  save();
  showHint('欢迎来到暗影征途！击败暗影之王，完成征途');
  running = true;
  lastT = 0;
  loop();
}

function continueGame() {
  const d = load();
  if (!d) { startGame('warrior'); return; }
  G = d;
  if (typeof G.px !== 'number') { G.px = G.x; G.py = G.y; }
  buildWorld();
  spawnEnemies();
  $('screen-title').style.display = 'none';
  $('screen-game').style.display = 'flex';
  updateUI();
  running = true;
  lastT = 0;
  loop();
}

function gameOver() {
  sfx.gameover();
  showDialog('💀 你倒下了…', '黑暗笼罩了你。\n等级：' + G.lv + ' ｜ 击杀：' + G.kills, [
    { label: '从墓穴醒来（原地复活）', fn: () => { G.hp = Math.round(G.maxHp * 0.5); G.mp = Math.round(G.maxMp * 0.5); hideDialog(); updateUI(); } },
  ]);
  // 保留存档，供重新挑战
  save();
}

function winGame() {
  sfx.level();
  showDialog('👑 暗影征途 · 完成', '你击败了暗影之王，将光明带回这片大陆！\n最终等级：' + G.lv + ' ｜ 击杀怪物：' + G.kills + ' ｜ 金币：' + G.gold, [
    { label: '继续探索', fn: hideDialog },
  ]);
  save();
}

/* ---------- 主循环 ---------- */
let lastT = 0, running = false;
function loop(t) {
  if (!running) return;
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  updatePlayer(dt);
  updateEnemies(dt);
  pickupLoot();
  updateFx(dt);
  render(dt);
  updateUI();
  requestAnimationFrame(loop);
}
function stopLoop() { running = false; }

/* ---------- 输入绑定 ---------- */
function bindControls() {
  // 方向键
  const dirBtns = document.querySelectorAll('#dpad button[data-d]');
  dirBtns.forEach(b => {
    const d = b.dataset.d;
    const press = e => { e.preventDefault(); setDir(d, true); };
    const release = e => { e.preventDefault(); setDir(d, false); };
    b.addEventListener('touchstart', press, { passive: false });
    b.addEventListener('touchend', release, { passive: false });
    b.addEventListener('mousedown', press);
    b.addEventListener('mouseup', release);
    b.addEventListener('mouseleave', release);
  });
  // 动作
  $('btnAttack').addEventListener('click', () => playerAttack());
  $('btnSkill').addEventListener('click', () => playerSkill());
  $('btnInteract').addEventListener('click', () => interact());
  $('btnBag').addEventListener('click', () => openBag());
  // 键盘（桌面调试）
  const keys = {};
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { keys.u = true; }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { keys.d = true; }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.l = true; }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.r = true; }
    if (e.key === ' ') { playerAttack(); }
    if (e.key === 'Enter') { interact(); }
    syncKeys();
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.u = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.d = false;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.l = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.r = false;
    syncKeys();
  });
  function syncKeys() {
    setDir('up', !!keys.u); setDir('down', !!keys.d);
    setDir('left', !!keys.l); setDir('right', !!keys.r);
  }
  // 菜单
  $('btnMenu').addEventListener('click', () => {
    $('menuInfo').textContent = G.icon + ' ' + G.className + ' Lv' + G.lv;
    $('menuSkill').textContent = CLASSES[G.cls].skill.name + '（' + CLASSES[G.cls].skill.cost + ' MP）';
    $('menuKill').textContent = '击杀 ' + G.kills + ' ｜ ' + (G.bossDefeated ? '已击败暗影之王' : '尚未击败暗影之王');
    $('menuClose').textContent = '关闭';
    $('modalMenu').classList.add('show');
  });
  $('menuClose').addEventListener('click', () => $('modalMenu').classList.remove('show'));
  $('btnSave').addEventListener('click', () => { save(); showHint('进度已保存'); $('modalMenu').classList.remove('show'); });
  $('btnVol').addEventListener('click', () => {
    soundOn = !soundOn;
    $('btnVol').textContent = soundOn ? '开' : '关';
  });
  $('btnReset').addEventListener('click', () => {
    if (confirm('确定要重新开始吗？当前进度将丢失。')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  });
  $('bagClose').addEventListener('click', () => $('modalBag').classList.remove('show'));

  // 标题界面
  $('btnNew').addEventListener('click', () => {
    $('btnNew').style.display = 'none';
    $('btnContinue').style.display = 'none';
    $('classSelect').style.display = 'flex';
  });
  let selCls = 'warrior';
  document.querySelectorAll('.cls').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.cls').forEach(c => c.classList.remove('sel'));
      el.classList.add('sel');
      selCls = el.dataset.cls;
    });
  });
  $('btnStartGame').addEventListener('click', () => startGame(selCls));
  $('btnContinue').addEventListener('click', () => continueGame());

  // 显示继续按钮（如有存档）
  if (load()) $('btnContinue').style.display = 'block';

  // 定时存档
  setInterval(save, 15000);
}

/* ---------- PWA 注册 ---------- */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------- 启动 ---------- */
window.addEventListener('DOMContentLoaded', () => {
  bindControls();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});
window.addEventListener('pagehide', () => save());