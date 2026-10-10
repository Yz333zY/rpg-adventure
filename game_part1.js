/* ============ 暗影征途 · 像素RPG 核心逻辑 ============ */
'use strict';

/* ---------- 工具 ---------- */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const chance = p => Math.random() < p;
const SAVE_KEY = 'shadowQuestSave_v1';

/* ---------- 音效（WebAudio，无外部文件） ---------- */
let audioCtx = null, soundOn = true;
function beep(freq, dur, vol, type) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.value = vol || 0.06;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  } catch (e) {}
}
const sfx = {
  hit: () => beep(180, .08, .08, 'square'),
  crit: () => { beep(140, .1, .1, 'square'); beep(320, .12, .08, 'triangle'); },
  skill: () => { beep(400, .15, .09, 'sawtooth'); beep(600, .2, .07, 'triangle'); },
  hurt: () => beep(110, .18, .09, 'sawtooth'),
  die: () => { beep(300, .2, .1, 'square'); beep(200, .3, .1, 'square'); },
  coin: () => { beep(880, .08, .05, 'sine'); beep(1320, .1, .05, 'sine'); },
  level: () => { beep(523, .1, .07, 'triangle'); beep(659, .1, .07, 'triangle'); beep(784, .2, .08, 'triangle'); },
  potion: () => { beep(600, .1, .05, 'sine'); beep(900, .15, .05, 'sine'); },
  pickup: () => beep(700, .08, .05, 'sine'),
  equip: () => { beep(500, .08, .06, 'triangle'); beep(750, .1, .06, 'triangle'); },
  portal: () => { beep(200, .4, .1, 'sine'); beep(300, .4, .08, 'sine'); },
  npc: () => beep(440, .06, .05, 'sine'),
  gameover: () => { beep(220, .2, .1, 'square'); beep(165, .3, .1, 'square'); beep(110, .5, .12, 'square'); },
};

/* ---------- 游戏常量 ---------- */
const TILE = 16;            // 逻辑像素块
const VIEW = { w: 16, h: 14 }; // 视野：16x14 格
const MAP_W = 40, MAP_H = 30;

/* ---------- 职业 ---------- */
const CLASSES = {
  warrior: { name: '战士', icon: '🛡️', hp: 1.5, mp: .8, atk: 1.2, def: 1.3, spd: .9, crit: .1, skill: { name: '猛击', cost: 8, mult: 1.8, cd: 1.2, type: 'melee' } },
  mage:    { name: '法师', icon: '🔮', hp: .9,  mp: 1.5, atk: 1.1, def: .8, spd: 1.0, crit: .15, skill: { name: '火球术', cost: 12, mult: 2.4, cd: 2.0, type: 'ranged' } },
  rogue:   { name: '游侠', icon: '🗡️', hp: 1.0, mp: 1.1, atk: 1.2, def: .9, spd: 1.4, crit: .3, skill: { name: '致命连击', cost: 10, mult: 2.0, cd: 1.5, type: 'melee' } },
};

/* ---------- 敌人 ---------- */
const ENEMIES = {
  slime:   { name: '史莱姆', icon: '🟢', hp: 20, atk: 5,  def: 1, xp: 8,  gold: randInt(2, 5),  speed: .8,  color: '#6fd08c', aggro: 2.4 },
  bat:     { name: '暗影蝙蝠', icon: '🦇', hp: 14, atk: 6,  def: 0, xp: 10, gold: randInt(3, 6),  speed: 1.4, color: '#8a6ae0', aggro: 3.2 },
  goblin:  { name: '哥布林', icon: '👺', hp: 30, atk: 8,  def: 2, xp: 16, gold: randInt(5, 10), speed: 1.0, color: '#d08a4e', aggro: 3.0 },
  skeleton:{ name: '骷髅兵', icon: '💀', hp: 38, atk: 11, def: 3, xp: 22, gold: randInt(8, 14), speed: .9,  color: '#e8e8f0', aggro: 3.0 },
  ghost:   { name: '幽灵', icon: '👻', hp: 26, atk: 12, def: 1, xp: 26, gold: randInt(10, 16), speed: 1.1, color: '#b0d4f0', aggro: 3.6 },
  orc:     { name: '兽人战士', icon: '👹', hp: 55, atk: 15, def: 4, xp: 34, gold: randInt(12, 20), speed: .9, color: '#7a9a4e', aggro: 3.0 },
  golem:   { name: '岩石傀儡', icon: '🗿', hp: 80, atk: 18, def: 8, xp: 50, gold: randInt(18, 30), speed: .6, color: '#a08a70', aggro: 2.6 },
  wraith:  { name: '暗影魔', icon: '🌑', hp: 65, atk: 20, def: 4, xp: 60, gold: randInt(20, 34), speed: 1.2, color: '#5a4a8a', aggro: 3.6 },
  dragon:  { name: '幼龙', icon: '🐉', hp: 120, atk: 25, def: 6, xp: 90, gold: randInt(30, 50), speed: 1.0, color: '#e05252', aggro: 3.4 },
  boss:    { name: '暗影之王', icon: '👑', hp: 400, atk: 32, def: 10, xp: 500, gold: 500, speed: .8, color: '#c8102e', aggro: 5.0 },
};

/* ---------- 物品 ---------- */
const ITEMS = {
  potion:   { name: '生命药水', icon: '🧪', type: 'consumable', desc: '恢复 50 点生命值', price: 15, heal: 50 },
  mpotion:  { name: '法力药水', icon: '🔵', type: 'consumable', desc: '恢复 30 点法力值', price: 18, mp: 30 },
  sword1:   { name: '铁剑', icon: '⚔️', type: 'weapon', desc: '攻击 +5', price: 40, atk: 5 },
  sword2:   { name: '寒霜剑', icon: '❄️', type: 'weapon', desc: '攻击 +12', price: 120, atk: 12 },
  sword3:   { name: '烈焰剑', icon: '🔥', type: 'weapon', desc: '攻击 +22', price: 320, atk: 22 },
  armor1:   { name: '皮甲', icon: '🥋', type: 'armor', desc: '防御 +3', price: 35, def: 3 },
  armor2:   { name: '锁子甲', icon: '⛓️', type: 'armor', desc: '防御 +8', price: 100, def: 8 },
  armor3:   { name: '龙鳞甲', icon: '🐲', type: 'armor', desc: '防御 +15', price: 280, def: 15 },
  ring:     { name: '力量戒指', icon: '💍', type: 'ring', desc: '攻击 +8 · 暴击 +10%', price: 180, atk: 8, crit: .1 },
};

/* ---------- 地图区域定义 ---------- */
/* 每个区域：入口格、出口格、敌人表、物品掉落、商店、NPC */
const AREAS = [
  {
    name: '宁静草原', bg: '#1c2a1f', ground: '#27402a', ground2: '#2d4a30',
    wall: '#3a5440', desc: '冒险的起点，温和的草原',
    entrance: { x: 5, y: 24 }, exit: { x: 36, y: 6 }, exitTo: 1,
    enemies: ['slime', 'bat'],
    enemyCount: 12, spawnRate: 2.4,
    npc: { x: 10, y: 26, name: '老者阿尔文', icon: '🧙', texts: ['欢迎来到暗影征途，年轻的冒险者。', '前方的草原栖息着史莱姆和蝙蝠，小心应对。', '击杀怪物可获得经验与金币，到商店购买装备。'] },
    shop: true,
  },
  {
    name: '幽暗森林', bg: '#12201c', ground: '#1b332a', ground2: '#1f3a30',
    wall: '#2c4a3a', desc: '枝叶遮蔽天日，怪物变得狡诈',
    entrance: { x: 3, y: 6 }, exit: { x: 36, y: 24 }, exitTo: 2,
    enemies: ['bat', 'goblin', 'skeleton'],
    enemyCount: 14, spawnRate: 2.0,
    npc: { x: 5, y: 10, name: '猎人海姆', icon: '🏹', texts: ['森林深处的骷髅会掉落铁剑碎片。', '哥布林成群出现，注意别被包围。'] },
    shop: true,
  },
  {
    name: '荒芜墓地', bg: '#1a1822', ground: '#26222e', ground2: '#2b2735',
    wall: '#3a3545', desc: '亡灵徘徊之地，传说有宝藏',
    entrance: { x: 3, y: 24 }, exit: { x: 36, y: 5 }, exitTo: 3,
    enemies: ['skeleton', 'ghost', 'orc'],
    enemyCount: 16, spawnRate: 1.8,
    npc: { x: 6, y: 26, name: '守墓人', icon: '🕯️', texts: ['幽灵刀枪不入？不，它们怕魔法。', '墓园深处的骷髅王掉落的装备不错。'] },
    shop: true,
  },
  {
    name: '熔岩洞穴', bg: '#20141a', ground: '#2e1e26', ground2: '#34222a',
    wall: '#4a2e36', desc: '灼热之地，强大的怪物在此蛰伏',
    entrance: { x: 3, y: 5 }, exit: { x: 36, y: 24 }, exitTo: 4,
    enemies: ['orc', 'golem', 'wraith'],
    enemyCount: 18, spawnRate: 1.6,
    npc: { x: 5, y: 9, name: '矮人铁匠', icon: '🔨', texts: ['洞穴深处的幼龙守护着龙鳞甲。', '岩石傀儡防御极高，需要魔法对付。'] },
    shop: true,
  },
  {
    name: '龙之谷', bg: '#1a1020', ground: '#241630', ground2: '#2a1a38',
    wall: '#3a244a', desc: '最终的试炼之地，暗影之王在此',
    entrance: { x: 3, y: 22 }, exit: { x: 38, y: 4 }, exitTo: -1,
    enemies: ['wraith', 'dragon', 'boss'],
    enemyCount: 20, spawnRate: 1.4,
    npc: { x: 6, y: 24, name: '先知', icon: '🔮', texts: ['暗影之王就在峡谷尽头。', '击败他，你将完成暗影征途的传说。'] },
    shop: true,
  },
];

/* ---------- 世界地图数据（程序生成） ---------- */
let world = []; // world[area][y][x] = 0 空地 / 1 墙
function genArea(areaIdx) {
  const A = AREAS[areaIdx];
  const g = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));
  // 边框
  for (let x = 0; x < MAP_W; x++) { g[0][x] = 1; g[MAP_H - 1][x] = 1; }
  for (let y = 0; y < MAP_H; y++) { g[y][0] = 1; g[y][MAP_W - 1] = 1; }
  // 随机障碍（用简单伪随机）
  let seed = areaIdx * 7919 + 13;
  const rnd = () => { seed = (seed * 16807 + 19) % 2147483647; return seed / 2147483647; };
  const density = 0.10 + areaIdx * 0.012;
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 2; x++) {
      if (rnd() < density) {
        // 避免堵死入口/出口：出口周围留空
        const nearExit = (Math.abs(x - A.exit.x) <= 1 && Math.abs(y - A.exit.y) <= 1);
        const nearEnt = (Math.abs(x - A.entrance.x) <= 1 && Math.abs(y - A.entrance.y) <= 1);
        if (!nearExit && !nearEnt) g[y][x] = 1;
      }
    }
  }
  // 入口/出口格子确保为空
  g[A.entrance.y][A.entrance.x] = 0;
  g[A.exit.y][A.exit.x] = 0;
  return g;
}
function buildWorld() {
  world = AREAS.map((_, i) => genArea(i));
}

/* ---------- 状态 ---------- */
let G = null; // 游戏状态

function newGame(cls) {
  const c = CLASSES[cls];
  const maxHp = Math.round(100 * c.hp);
  const maxMp = Math.round(40 * c.mp);
  G = {
    cls, className: c.name, icon: c.icon,
    x: AREAS[0].entrance.x, y: AREAS[0].entrance.y,
    px: AREAS[0].entrance.x, py: AREAS[0].entrance.y,
    area: 0, hp: maxHp, maxHp, mp: maxMp, maxMp,
    lv: 1, xp: 0, xpNext: 60, gold: 30,
    baseAtk: 10, baseDef: 2, atk: 10, def: 2, crit: c.crit, spd: c.spd,
    weapon: null, armor: null, ring: null,
    inv: { potion: 2, mpotion: 1 },
    kills: 0, bossDefeated: false, started: true,
  };
  recalc();
}

function recalc() {
  const c = CLASSES[G.cls];
  G.atk = G.baseAtk + (G.weapon ? ITEMS[G.weapon].atk || 0 : 0) + (G.ring ? ITEMS[G.ring].atk || 0 : 0);
  G.def = G.baseDef + (G.armor ? ITEMS[G.armor].def || 0 : 0);
  G.crit = c.crit + (G.ring ? (ITEMS[G.ring].crit || 0) : 0);
}

/* ---------- 存档 ---------- */
function save() {
  if (!G || !G.started) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {}
}
function load() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return null;
    const d = JSON.parse(s);
    if (!d || !d.started) return null;
    return d;
  } catch (e) { return null; }
}

/* ---------- 实体 ---------- */
let enemies = [];
let loots = [];
let particles = [];
let floatingTexts = [];
let projectile = null;

function spawnEnemies() {
  enemies = [];
  const A = AREAS[G.area];
  for (let i = 0; i < A.enemyCount; i++) {
    let x, y, tries = 0;
    do {
      x = randInt(2, MAP_W - 3); y = randInt(2, MAP_H - 3);
      tries++;
    } while (tries < 40 && (world[G.area][y][x] === 1 || (Math.abs(x - G.x) < 2 && Math.abs(y - G.y) < 2)));
    if (tries >= 40) continue;
    const type = A.enemies[randInt(0, A.enemies.length - 1)];
    const t = ENEMIES[type];
    enemies.push({
      type, name: t.name, icon: t.icon, x, y,
      hp: t.hp, maxHp: t.hp, atk: t.atk, def: t.def,
      xp: t.xp, gold: randInt(t.gold[0], t.gold[1]),
      speed: t.speed, color: t.color, aggro: t.aggro,
      alive: true, hurtT: 0, attackCd: 0, dir: 0,
    });
  }
  // 确保出生点附近至少有一只怪物（新手体验）
  if (G.area === 0) {
    let placed = false, tries = 0;
    while (!placed && tries < 60) {
      tries++;
      const ang = rand(0, Math.PI * 2);
      const dist = randInt(4, 7);
      const ex = Math.round(G.x + Math.cos(ang) * dist);
      const ey = Math.round(G.y + Math.sin(ang) * dist);
      if (canStand(ex, ey) && !enemies.some(o => o.x === ex && o.y === ey)) {
        const type = A.enemies[randInt(0, A.enemies.length - 1)];
        const t = ENEMIES[type];
        enemies.push({
          type, name: t.name, icon: t.icon, x: ex, y: ey,
          hp: t.hp, maxHp: t.hp, atk: t.atk, def: t.def,
          xp: t.xp, gold: randInt(t.gold[0], t.gold[1]),
          speed: t.speed, color: t.color, aggro: t.aggro,
          alive: true, hurtT: 0, attackCd: 0, dir: 0,
        });
        placed = true;
      }
    }
  }
  // 区域boss（如果有）
  if (G.area === 4 && !G.bossDefeated) {
    enemies.push({
      type: 'boss', name: ENEMIES.boss.name, icon: ENEMIES.boss.icon,
      x: 30, y: 14, hp: ENEMIES.boss.hp, maxHp: ENEMIES.boss.hp,
      atk: ENEMIES.boss.atk, def: ENEMIES.boss.def, xp: ENEMIES.boss.xp,
      gold: ENEMIES.boss.gold, speed: ENEMIES.boss.speed, color: ENEMIES.boss.color,
      aggro: ENEMIES.boss.aggro, alive: true, hurtT: 0, attackCd: 0, dir: 0, isBoss: true,
    });
  }
}

/* ---------- 掉落 ---------- */
function dropLoot(x, y, e) {
  const r = Math.random();
  if (r < 0.30) loots.push({ x, y, type: 'gold', amt: e.gold, life: 30, icon: '💰' });
  else if (r < 0.40) loots.push({ x, y, type: 'item', item: 'potion', life: 30, icon: '🧪' });
  else if (r < 0.45 && G.area >= 1) loots.push({ x, y, type: 'item', item: 'mpotion', life: 30, icon: '🔵' });
  else if (r < 0.55 && chance(0.5)) { /* 小概率装备 */ }
  if (e.type === 'boss') {
    loots.push({ x, y, type: 'item', item: 'sword3', life: 60, icon: '🔥' });
    loots.push({ x, y, type: 'item', item: 'armor3', life: 60, icon: '🐲' });
    loots.push({ x, y, type: 'gold', amt: 300, life: 60, icon: '💰' });
  }
}

/* ---------- 战斗 ---------- */
function playerAttack() {
  const target = nearestEnemy(1.6);
  if (!target) { showHint('附近没有敌人'); return; }
  const crit = chance(G.crit);
  let dmg = Math.max(1, G.atk * rand(.9, 1.1) - target.def * 0.5);
  if (crit) dmg *= 1.8;
  dmg = Math.round(dmg);
  target.hp -= dmg;
  target.hurtT = 0.3;
  addFloating(target.x * TILE + 8, target.y * TILE - 4, '-' + dmg, crit ? '#ffcc33' : '#ff5555');
  sfx[crit ? 'crit' : 'hit']();
  particles.push({ x: target.x * TILE + 8, y: target.y * TILE + 8, vx: rand(-30, 30), vy: rand(-40, -10), life: .4, color: crit ? '#ffcc33' : '#ff6666' });
  if (target.hp <= 0) killEnemy(target);
  else target.attackCd = Math.max(target.attackCd, .4);
}

function playerSkill() {
  const c = CLASSES[G.cls];
  const sk = c.skill;
  if (G.mp < sk.cost) { showHint('法力不足'); return; }
  G.mp -= sk.cost;
  sfx.skill();
  if (sk.type === 'ranged') {
    const target = nearestEnemy(6);
    if (!target) { showHint('附近没有敌人'); G.mp += sk.cost; return; }
    projectile = { x: G.x * TILE + 8, y: G.y * TILE + 8, tx: target.x * TILE + 8, ty: target.y * TILE + 8, speed: 220, dmg: Math.round(G.atk * sk.mult), color: '#ff8833' };
  } else {
    const target = nearestEnemy(2.2);
    if (!target) { showHint('技能需要靠近敌人'); G.mp += sk.cost; return; }
    const dmg = Math.round(G.atk * sk.mult * rand(.9, 1.1) - target.def * 0.4);
    target.hp -= dmg;
    target.hurtT = .4;
    addFloating(target.x * TILE + 8, target.y * TILE - 4, '-' + dmg, '#ffaa33');
    particles.push({ x: target.x * TILE + 8, y: target.y * TILE + 8, vx: rand(-60, 60), vy: rand(-60, -20), life: .5, color: '#ff8833' });
    if (target.hp <= 0) killEnemy(target);
  }
}

function nearestEnemy(range) {
  let best = null, bd = range * TILE;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - G.x, e.y - G.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function killEnemy(e) {
  e.alive = false;
  G.xp += e.xp; G.gold += e.gold; G.kills++;
  addFloating(e.x * TILE + 8, e.y * TILE - 8, '+' + e.xp + ' XP', '#8fd08c');
  addFloating(e.x * TILE + 8, e.y * TILE - 18, '+' + e.gold + ' G', '#ffcc66');
  sfx.die();
  dropLoot(e.x, e.y, e);
  if (e.type === 'boss') { G.bossDefeated = true; sfx.portal(); }
  checkLevel();
}

function checkLevel() {
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.lv++;
    G.xpNext = Math.round(G.xpNext * 1.5);
    G.maxHp += 8; G.maxMp += 4; G.baseAtk += 2; G.baseDef += 1;
    G.hp = G.maxHp; G.mp = G.maxMp;
    recalc();
    sfx.level();
    addFloating(G.x * TILE + 8, G.y * TILE - 8, '升级! Lv ' + G.lv, '#ffcc33');
  }
}

function enemyAttack(e) {
  const dmg = Math.max(1, Math.round(e.atk * rand(.85, 1.15) - G.def * 0.5));
  G.hp -= dmg;
  sfx.hurt();
  addFloating(G.x * TILE + 8, G.y * TILE - 4, '-' + dmg, '#ff6666');
  if (G.hp <= 0) {
    G.hp = 0;
    gameOver();
  }
}

/* ---------- 移动 ---------- */
let moveDir = { up: false, down: false, left: false, right: false };
function setDir(k, v) {
  moveDir[k] = v;
  if (v) { // 同时按下多个方向时，重置其他方向（4向移动）
    if (k === 'up' || k === 'down') { moveDir.left = false; moveDir.right = false; }
    else { moveDir.up = false; moveDir.down = false; }
  }
}

function canStand(x, y) {
  if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return false;
  if (world[G.area][y][x] === 1) return false;
  return true;
}

function checkPortal() {
  const A = AREAS[G.area];
  if (G.x === A.exit.x && G.y === A.exit.y) {
    if (A.exitTo >= 0) {
      sfx.portal();
      G.area = A.exitTo;
      G.x = AREAS[G.area].entrance.x;
      G.y = AREAS[G.area].entrance.y;
      G.px = G.x; G.py = G.y;
      spawnEnemies();
      showHint('进入 ' + AREAS[G.area].name);
      updateLoc();
    } else {
      winGame();
    }
  }
}

/* 平滑移动：px/py 为小数位置，G.x/G.y 为当前格 */
function updatePlayer(dt) {
  const spd = 4.2 * G.spd;
  let dx = 0, dy = 0;
  if (moveDir.up) dy = -1;
  if (moveDir.down) dy = 1;
  if (moveDir.left) dx = -1;
  if (moveDir.right) dx = 1;
  if (dx !== 0 || dy !== 0) {
    const mag = Math.hypot(dx, dy);
    G.px += dx / mag * spd * dt;
    G.py += dy / mag * spd * dt;
    // 分轴落地到整数格（有碰撞）
    const tx = Math.round(G.px), ty = Math.round(G.py);
    if (tx !== G.x) {
      if (canStand(tx, G.y)) G.x = tx; else G.px = G.x;
    }
    if (ty !== G.y) {
      if (canStand(G.x, ty)) G.y = ty; else G.py = G.y;
    }
  }
  checkPortal();
}
