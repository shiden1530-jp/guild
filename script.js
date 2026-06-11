'use strict';

// Adventurer Guild Idle - 日本語版。localStorageだけで完結する静的ブラウザゲームです。
const SAVE_KEY = 'adventurerGuildIdle.jp.v1';
const TICK_MS = 1000;
const MAX_LOG = 80;

const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const itemRarityOrder = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const rarityJa = { Common: '普通', Uncommon: '非凡', Rare: '希少', Epic: '叙事詩級', Legendary: '伝説級', Mythic: '神話級' };
const slotJa = { Weapon: '武器', Shield: '盾', Helmet: '兜', Armor: '鎧', Accessory: '装飾品' };
const slotEmoji = { Weapon: '⚔️', Shield: '🛡️', Helmet: '🪖', Armor: '🥋', Accessory: '💍' };

const nameParts = {
  first: ['アル', 'ベル', 'セリ', 'ドラン', 'エル', 'フィ', 'ガル', 'ヘル', 'イリ', 'ジル', 'カイ', 'ルナ', 'ミラ', 'ノク', 'オル', 'リュウ'],
  last: ['ディン', 'ファ', 'ガルド', 'ミア', 'ヴァン', 'リア', 'ノア', 'シア', 'ベル', 'ロス', 'レイン', 'クロウ', 'フォル', 'グリム'],
  title: ['灰狼', '暁', '黒鉄', '月影', '霧渡り', '竜牙', '星詠み', '墓守', '銀梟', '紅蓮']
};

const dungeons = [
  { id: 'forest', name: '呪われた森', power: 35, duration: 45, reward: 1, chest: 0.28, difficulty: 1, unlock: 1 },
  { id: 'cave', name: '黒曜石の洞窟', power: 95, duration: 95, reward: 2.2, chest: 0.36, difficulty: 2, unlock: 3 },
  { id: 'ruins', name: '古代遺跡', power: 210, duration: 180, reward: 4.4, chest: 0.44, difficulty: 3.8, unlock: 6 },
  { id: 'abyss', name: '奈落の裂け目', power: 520, duration: 360, reward: 9, chest: 0.55, difficulty: 7.2, unlock: 10 },
  { id: 'castle', name: '魔王城', power: 1200, duration: 720, reward: 20, chest: 0.7, difficulty: 13, unlock: 16 }
];

const facilities = [
  { id: 'tavern', name: '酒場', desc: '雇用費を下げ、高レア冒険者の出現率を上げる。', base: 120, mult: 1.75 },
  { id: 'blacksmith', name: '鍛冶場', desc: '装備の品質と売値を高める。', base: 180, mult: 1.9 },
  { id: 'warehouse', name: '倉庫', desc: '所持枠と同時遠征枠を拡張する。', base: 220, mult: 2.05 },
  { id: 'training', name: '訓練場', desc: '経験値獲得量と基礎能力を増やす。', base: 260, mult: 2.0 },
  { id: 'research', name: '研究塔', desc: '宝箱率、遠征速度、神話装備率を伸ばす。', base: 420, mult: 2.2 }
];

const chestTiers = [
  { id: 'wood', name: '木の宝箱', min: 0, weight: 50 },
  { id: 'iron', name: '鉄の宝箱', min: 2, weight: 28 },
  { id: 'silver', name: '銀の宝箱', min: 5, weight: 14 },
  { id: 'gold', name: '金の宝箱', min: 9, weight: 6 },
  { id: 'mythic', name: '神話の宝箱', min: 14, weight: 2 }
];

const affixes = [
  { key: 'attackPct', label: '攻撃力', min: 4, max: 18 },
  { key: 'defensePct', label: '防御力', min: 4, max: 18 },
  { key: 'hpPct', label: 'HP', min: 4, max: 20 },
  { key: 'luckPct', label: '幸運', min: 3, max: 16 },
  { key: 'xpPct', label: '経験値', min: 3, max: 15 },
  { key: 'chestPct', label: '宝箱率', min: 2, max: 12 }
];

const el = id => document.getElementById(id);
const fmt = n => Math.floor(n).toLocaleString('ja-JP');
const rand = (min, max) => Math.random() * (max - min) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let state;
state = loadGame();
let selectedAdventurerId = state.adventurers[0]?.id ?? null;
let selectedItemId = null;
let lastTick = Date.now();

function defaultState() {
  const base = {
    gold: 120,
    guildLevel: 1,
    guildXp: 0,
    fame: 0,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    adventurers: [],
    inventory: [],
    chests: [],
    expeditions: [],
    facilities: Object.fromEntries(facilities.map(f => [f.id, 0])),
    log: []
  };
  base.adventurers.push(createAdventurer('Common'));
  base.chests.push({ tier: 'wood', id: uid('chest') });
  return base;
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return defaultState();
  try {
    const saved = JSON.parse(raw);
    return { ...defaultState(), ...saved, facilities: { ...defaultState().facilities, ...saved.facilities } };
  } catch (error) {
    console.warn('セーブデータの読み込みに失敗しました。新規データを作成します。', error);
    return defaultState();
  }
}

function saveGame() {
  state.lastSeen = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function createAdventurer(forceRarity) {
  const tavern = state?.facilities?.tavern ?? 0;
  const weights = [58 - tavern * 2, 25, 11 + tavern, 5 + tavern * 0.6, 1 + tavern * 0.25];
  const rarity = forceRarity || weightedPick(rarityOrder.map((r, i) => ({ id: r, weight: Math.max(1, weights[i]) })));
  const idx = rarityOrder.indexOf(rarity);
  const name = `${pick(nameParts.first)}${pick(nameParts.last)}・${pick(nameParts.title)}`;
  const scale = 1 + idx * 0.35;
  return {
    id: uid('adv'), name, rarity, level: 1, xp: 0,
    hp: Math.round(rand(42, 60) * scale), attack: Math.round(rand(9, 15) * scale),
    defense: Math.round(rand(5, 11) * scale), luck: Math.round(rand(3, 9) * scale),
    equipment: { Weapon: null, Shield: null, Helmet: null, Armor: null, Accessory: null }
  };
}

function weightedPick(entries) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return entries[entries.length - 1].id;
}

function adventurerStats(adv) {
  const training = state.facilities.training || 0;
  const fameBonus = 1 + state.fame * 0.01;
  const base = {
    hp: adv.hp + adv.level * 9,
    attack: adv.attack + adv.level * 2.3,
    defense: adv.defense + adv.level * 1.7,
    luck: adv.luck + adv.level * 0.9,
    xpPct: state.fame * 0.5 + training * 4,
    chestPct: state.fame * 0.25,
    speedPct: state.fame * 0.3 + (state.facilities.research || 0) * 3
  };
  for (const itemId of Object.values(adv.equipment)) {
    const item = state.inventory.find(i => i.id === itemId);
    if (!item) continue;
    base.hp += item.stats.hp || 0; base.attack += item.stats.attack || 0;
    base.defense += item.stats.defense || 0; base.luck += item.stats.luck || 0;
    for (const affix of item.affixes) base[affix.key] = (base[affix.key] || 0) + affix.value;
  }
  return {
    hp: Math.round(base.hp * (1 + base.hpPct / 100) * (1 + training * 0.02) * fameBonus),
    attack: Math.round(base.attack * (1 + base.attackPct / 100) * fameBonus),
    defense: Math.round(base.defense * (1 + base.defensePct / 100) * fameBonus),
    luck: Math.round(base.luck * (1 + base.luckPct / 100) * fameBonus),
    xpPct: base.xpPct, chestPct: base.chestPct, speedPct: base.speedPct
  };
}

function powerOf(adv) {
  const s = adventurerStats(adv);
  return Math.round(s.hp * 0.35 + s.attack * 4 + s.defense * 3 + s.luck * 2);
}

function recruitCost() {
  return Math.max(20, Math.round(50 * Math.pow(1.22, state.adventurers.length) * (1 - (state.facilities.tavern || 0) * 0.04)));
}

function startExpedition(advId, dungeonId) {
  const adv = state.adventurers.find(a => a.id === advId);
  const dungeon = dungeons.find(d => d.id === dungeonId);
  if (!adv || !dungeon || state.guildLevel < dungeon.unlock) return;
  if (state.expeditions.some(e => e.adventurerId === advId)) return notify('その冒険者は遠征中です。');
  if (state.expeditions.length >= expeditionSlots()) return notify('遠征枠が不足しています。倉庫を強化しましょう。');
  const stats = adventurerStats(adv);
  const duration = Math.max(10, dungeon.duration * (1 - Math.min(60, stats.speedPct) / 100));
  state.expeditions.push({ id: uid('exp'), adventurerId: advId, dungeonId, start: Date.now(), end: Date.now() + duration * 1000, log: [] });
  addLog(`${adv.name} が「${dungeon.name}」へ出発しました。`);
  render(); saveGame();
}

function expeditionSlots() {
  return 1 + Math.floor((state.facilities.warehouse || 0) / 2);
}

function resolveExpeditions(now, silent = false) {
  const completed = state.expeditions.filter(e => e.end <= now);
  if (!completed.length) return { gold: 0, xp: 0, chests: 0, items: 0, logs: [] };
  const summary = { gold: 0, xp: 0, chests: 0, items: 0, logs: [] };
  state.expeditions = state.expeditions.filter(e => e.end > now);
  for (const exp of completed) {
    const adv = state.adventurers.find(a => a.id === exp.adventurerId);
    const dungeon = dungeons.find(d => d.id === exp.dungeonId);
    if (!adv || !dungeon) continue;
    const stats = adventurerStats(adv);
    const power = powerOf(adv);
    const odds = Math.max(0.08, Math.min(0.98, (power / dungeon.power) * rand(0.72, 1.22)));
    const success = Math.random() < odds;
    const gold = Math.round((success ? 38 : 12) * dungeon.reward * rand(0.85, 1.25));
    const xp = Math.round((success ? 28 : 12) * dungeon.reward * (1 + stats.xpPct / 100));
    state.gold += gold; state.guildXp += Math.round(xp * 0.45);
    gainXp(adv, xp);
    summary.gold += gold; summary.xp += xp;
    const chestChance = dungeon.chest + stats.chestPct / 100 + (state.facilities.research || 0) * 0.015;
    let chestName = '';
    if (success && Math.random() < chestChance) {
      const chest = rollChest(); state.chests.push(chest); summary.chests++;
      chestName = ` / ${chestNameById(chest.tier)}を発見`;
    }
    if (success && Math.random() < 0.08 + (state.facilities.blacksmith || 0) * 0.01) {
      state.inventory.push(generateItem(dungeon.difficulty)); summary.items++;
    }
    const line = `${adv.name} は「${dungeon.name}」を${success ? '踏破' : '辛くも撤退'}。金貨${fmt(gold)}・経験値${fmt(xp)}獲得${chestName}。勝率推定${Math.round(odds * 100)}%。`;
    summary.logs.push(line); addLog(line);
  }
  updateGuildLevel();
  if (!silent) notify(`遠征完了: 金貨 ${fmt(summary.gold)} / 宝箱 ${summary.chests}`);
  return summary;
}

function gainXp(adv, xp) {
  adv.xp += xp;
  while (adv.xp >= xpToNext(adv.level)) {
    adv.xp -= xpToNext(adv.level); adv.level++;
    adv.hp += Math.round(rand(5, 10)); adv.attack += Math.round(rand(1, 3)); adv.defense += Math.round(rand(1, 3)); adv.luck += Math.round(rand(0, 2));
    addLog(`${adv.name} が Lv.${adv.level} に上昇しました！`);
  }
}

function xpToNext(level) { return Math.round(55 * Math.pow(level, 1.55)); }
function updateGuildLevel() {
  while (state.guildXp >= guildXpToNext(state.guildLevel)) {
    state.guildXp -= guildXpToNext(state.guildLevel); state.guildLevel++;
    addLog(`ギルドレベルが ${state.guildLevel} になりました。新たな脅威が解禁されます。`);
  }
}
function guildXpToNext(level) { return Math.round(90 * Math.pow(level, 1.7)); }

function rollChest() {
  const options = chestTiers.filter(c => state.guildLevel >= c.min).map(c => ({ id: c.id, weight: c.weight + (state.facilities.research || 0) }));
  return { id: uid('chest'), tier: weightedPick(options) };
}
function chestNameById(id) { return chestTiers.find(c => c.id === id)?.name || '宝箱'; }

function generateItem(depth = 1, chestTier = 'wood') {
  const slots = Object.keys(slotJa);
  const slot = pick(slots);
  const tierBoost = ['wood', 'iron', 'silver', 'gold', 'mythic'].indexOf(chestTier);
  const quality = depth + tierBoost * 1.2 + (state.facilities.blacksmith || 0) * 0.35 + state.fame * 0.08;
  const rarity = weightedPick(itemRarityOrder.map((r, i) => ({ id: r, weight: Math.max(1, 62 - i * 18 + quality * (i + 0.4)) })));
  const ri = itemRarityOrder.indexOf(rarity);
  const level = Math.max(1, Math.round(quality + rand(1, 4) + ri * 2));
  const statScale = (level + 2) * (1 + ri * 0.55);
  const stats = { hp: 0, attack: 0, defense: 0, luck: 0 };
  if (slot === 'Weapon') stats.attack = Math.round(statScale * rand(1.8, 2.7));
  if (slot === 'Shield') stats.defense = Math.round(statScale * rand(1.5, 2.4));
  if (slot === 'Helmet') { stats.hp = Math.round(statScale * rand(4, 6)); stats.defense = Math.round(statScale * 0.7); }
  if (slot === 'Armor') { stats.hp = Math.round(statScale * rand(6, 9)); stats.defense = Math.round(statScale); }
  if (slot === 'Accessory') { stats.luck = Math.round(statScale * rand(1.1, 2)); stats.hp = Math.round(statScale * 2); }
  const affixCount = Math.max(0, ri - 1 + (Math.random() < 0.35 ? 1 : 0));
  const rolled = [];
  const pool = [...affixes];
  for (let i = 0; i < affixCount; i++) {
    const affix = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    rolled.push({ key: affix.key, label: affix.label, value: Math.round(rand(affix.min, affix.max) * (1 + ri * 0.18)) });
  }
  const prefixes = ['古びた', '影縫いの', '血塗られた', '星辰の', '竜骨の', '祝福されし', '深淵の'];
  const suffixes = ['勇気', '幸運', '滅魔', '守護', '疾風', '叡智', '亡霊'];
  return { id: uid('item'), slot, rarity, level, stats, affixes: rolled, value: Math.round(statScale * (ri + 1) * 5), name: `${pick(prefixes)}${rarityJa[rarity]}${slotJa[slot]}・${pick(suffixes)}`, created: Date.now() };
}

function openChest() {
  if (!state.chests.length) return notify('開けられる宝箱がありません。');
  const chest = state.chests.shift();
  const depth = Math.max(1, state.guildLevel / 2);
  const item = generateItem(depth, chest.tier);
  state.inventory.push(item);
  addLog(`${chestNameById(chest.tier)}から「${item.name}」を入手しました。`);
  showModal(`<div class="chest-animation">🎁</div><h2>${chestNameById(chest.tier)} 開封！</h2>${itemHtml(item)}<p class="hint">希少な装備は複数のランダム接辞を持ちます。</p>`);
  trimInventory(); render(); saveGame();
}

function trimInventory() {
  const cap = 30 + (state.facilities.warehouse || 0) * 10;
  if (state.inventory.length <= cap) return;
  state.inventory.sort((a, b) => itemPower(b) - itemPower(a));
  const removed = state.inventory.splice(cap);
  const gold = removed.reduce((sum, i) => sum + i.value, 0);
  state.gold += gold;
  addLog(`倉庫上限超過のため低戦力装備を自動売却し、金貨${fmt(gold)}を得ました。`);
}

function itemPower(item) {
  return Object.values(item.stats).reduce((a, b) => a + b, 0) + item.affixes.reduce((a, b) => a + b.value * 2, 0) + itemRarityOrder.indexOf(item.rarity) * 25;
}

function equipItem(itemId, advId = selectedAdventurerId) {
  const item = state.inventory.find(i => i.id === itemId);
  const adv = state.adventurers.find(a => a.id === advId);
  if (!item || !adv) return;
  adv.equipment[item.slot] = item.id;
  selectedAdventurerId = adv.id;
  addLog(`${adv.name} が「${item.name}」を装備しました。`);
  render(); saveGame();
}

function sellItem(itemId) {
  const item = state.inventory.find(i => i.id === itemId);
  if (!item) return;
  for (const adv of state.adventurers) for (const slot of Object.keys(adv.equipment)) if (adv.equipment[slot] === itemId) adv.equipment[slot] = null;
  state.inventory = state.inventory.filter(i => i.id !== itemId);
  const value = Math.round(item.value * (1 + (state.facilities.blacksmith || 0) * 0.06));
  state.gold += value; addLog(`「${item.name}」を売却し、金貨${fmt(value)}を得ました。`);
  selectedItemId = null; render(); saveGame();
}

function upgradeFacility(id) {
  const facility = facilities.find(f => f.id === id);
  const level = state.facilities[id] || 0;
  const cost = Math.round(facility.base * Math.pow(facility.mult, level));
  if (state.gold < cost) return notify('金貨が不足しています。');
  state.gold -= cost; state.facilities[id] = level + 1;
  addLog(`${facility.name}を Lv.${level + 1} に強化しました。`);
  render(); saveGame();
}

function prestige() {
  if (state.guildLevel < 20) return notify('名声転生はギルドLv20から解禁されます。');
  const gained = Math.floor(Math.sqrt(state.guildLevel) + state.adventurers.length / 2);
  const fresh = defaultState();
  Object.assign(state, fresh, { fame: state.fame + gained });
  selectedAdventurerId = state.adventurers[0].id; selectedItemId = null;
  addLog(`名声転生により名声ポイントを ${gained} 獲得しました。`);
  render(); saveGame();
}

function addLog(text) {
  state.log.unshift({ time: Date.now(), text });
  state.log = state.log.slice(0, MAX_LOG);
}
function notify(text) {
  const n = document.createElement('div'); n.className = 'notification'; n.textContent = text; document.body.appendChild(n);
  setTimeout(() => n.remove(), 2600);
}
function showModal(html) { el('modalContent').innerHTML = html; el('modal').classList.remove('hidden'); }
function hideModal() { el('modal').classList.add('hidden'); }

function render() {
  el('goldText').textContent = fmt(state.gold);
  el('guildLevelText').textContent = state.guildLevel;
  el('fameText').textContent = state.fame;
  el('slotsText').textContent = `${state.expeditions.length}/${expeditionSlots()}`;
  el('recruitCostText').textContent = `雇用費: ${fmt(recruitCost())} 金貨`;
  el('chestText').textContent = `宝箱: ${state.chests.length}（${state.chests.map(c => chestNameById(c.tier)).slice(0, 3).join('、') || 'なし'}）`;
  renderAdventurers(); renderDungeons(); renderExpeditions(); renderInventory(); renderFacilities(); renderLog();
}

function renderAdventurers() {
  el('adventurerList').innerHTML = state.adventurers.map(adv => {
    const stats = adventurerStats(adv), power = powerOf(adv), xpPct = Math.min(100, adv.xp / xpToNext(adv.level) * 100);
    const busy = state.expeditions.some(e => e.adventurerId === adv.id);
    return `<article class="card ${selectedAdventurerId === adv.id ? 'selected' : ''}" data-select-adv="${adv.id}">
      <h3>${adv.name}</h3><div class="meta"><span class="badge rarity-${adv.rarity}">${rarityJa[adv.rarity]}</span><span class="badge">Lv.${adv.level}</span><span class="badge">戦力 ${fmt(power)}</span>${busy ? '<span class="badge">遠征中</span>' : ''}</div>
      <div class="stats"><span>HP ${fmt(stats.hp)}</span><span>攻撃 ${fmt(stats.attack)}</span><span>防御 ${fmt(stats.defense)}</span><span>幸運 ${fmt(stats.luck)}</span></div>
      <div class="progress" title="経験値"><span style="width:${xpPct}%"></span></div>
      <div class="meta">${Object.entries(adv.equipment).map(([slot, id]) => `<span class="badge">${slotEmoji[slot]} ${id ? state.inventory.find(i => i.id === id)?.name ?? '不明' : '未装備'}</span>`).join('')}</div>
    </article>`;
  }).join('');
}

function renderDungeons() {
  el('dungeonList').innerHTML = dungeons.map(d => {
    const locked = state.guildLevel < d.unlock;
    const selected = state.adventurers.find(a => a.id === selectedAdventurerId);
    const canRun = selected && !locked && !state.expeditions.some(e => e.adventurerId === selected.id) && state.expeditions.length < expeditionSlots();
    return `<article class="dungeon ${locked ? 'locked' : ''}">
      <h3>${d.name}</h3><div class="meta"><span class="badge">推奨戦力 ${fmt(d.power)}</span><span class="badge">${Math.round(d.duration)}秒</span><span class="badge">宝箱 ${Math.round(d.chest * 100)}%</span></div>
      <p class="hint">報酬倍率 x${d.reward} / 敵危険度 ${d.difficulty}</p>
      <div class="dungeon-actions"><button ${canRun ? '' : 'disabled'} data-start-dungeon="${d.id}">${locked ? `ギルドLv${d.unlock}で解禁` : '選択冒険者を派遣'}</button></div>
    </article>`;
  }).join('');
}

function renderExpeditions() {
  const now = Date.now();
  el('expeditionList').innerHTML = state.expeditions.length ? state.expeditions.map(e => {
    const adv = state.adventurers.find(a => a.id === e.adventurerId), d = dungeons.find(x => x.id === e.dungeonId);
    const total = e.end - e.start, left = Math.max(0, e.end - now), pct = Math.min(100, (1 - left / total) * 100);
    return `<article class="card"><h3>${adv?.name || '不明'} → ${d?.name || '不明'}</h3><div class="meta"><span class="badge">残り ${Math.ceil(left / 1000)}秒</span><span class="badge">戦力 ${adv ? fmt(powerOf(adv)) : 0}</span></div><div class="progress"><span style="width:${pct}%"></span></div></article>`;
  }).join('') : '<p class="hint">遠征はありません。冒険者を選び、ダンジョンへ派遣しましょう。</p>';
}

function renderInventory() {
  const filter = el('inventoryFilter').value, sort = el('inventorySort').value;
  let items = [...state.inventory].filter(i => filter === 'all' || i.slot === filter);
  if (sort === 'power') items.sort((a, b) => itemPower(b) - itemPower(a));
  if (sort === 'rarity') items.sort((a, b) => itemRarityOrder.indexOf(b.rarity) - itemRarityOrder.indexOf(a.rarity));
  if (sort === 'newest') items.sort((a, b) => b.created - a.created);
  if (sort === 'value') items.sort((a, b) => b.value - a.value);
  el('inventoryList').innerHTML = items.length ? items.map(itemHtml).join('') : '<p class="hint">装備はまだありません。宝箱や遠征から獲得できます。</p>';
}

function itemHtml(item) {
  const equippedBy = state.adventurers.find(a => Object.values(a.equipment).includes(item.id));
  return `<article class="item-card ${selectedItemId === item.id ? 'selected' : ''}" data-item="${item.id}">
    <h4 class="rarity-${item.rarity}">${item.name}</h4>
    <div class="meta"><span class="badge">${slotEmoji[item.slot]} ${slotJa[item.slot]}</span><span class="badge rarity-${item.rarity}">${rarityJa[item.rarity]}</span><span class="badge">Lv.${item.level}</span></div>
    <div class="stats">${Object.entries(item.stats).filter(([,v]) => v).map(([k,v]) => `<span>${statLabel(k)} +${fmt(v)}</span>`).join('')}${item.affixes.map(a => `<span>${a.label} +${a.value}%</span>`).join('')}</div>
    <p class="hint">戦力 ${fmt(itemPower(item))} / 売値 ${fmt(item.value)}${equippedBy ? ` / ${equippedBy.name}が装備中` : ''}</p>
    <div class="item-actions"><button data-equip="${item.id}">装備</button><button class="danger" data-sell="${item.id}">売却</button></div>
  </article>`;
}
function statLabel(k) { return { hp: 'HP', attack: '攻撃', defense: '防御', luck: '幸運' }[k] || k; }

function renderFacilities() {
  const prestigeButton = state.guildLevel >= 20 ? `<button class="primary" data-prestige>名声転生（現在名声 ${state.fame}）</button>` : `<button disabled>名声転生: ギルドLv20で解禁</button>`;
  el('facilityList').innerHTML = facilities.map(f => {
    const level = state.facilities[f.id] || 0, cost = Math.round(f.base * Math.pow(f.mult, level));
    return `<article class="facility"><h3>${f.name} Lv.${level}</h3><p class="hint">${f.desc}</p><div class="meta"><span class="badge">費用 ${fmt(cost)} 金貨</span></div><button ${state.gold >= cost ? '' : 'disabled'} data-upgrade="${f.id}">強化</button></article>`;
  }).join('') + `<article class="facility"><h3>名声の祭壇</h3><p class="hint">高レベル到達後に進行をリセットし、永続ボーナスを得ます。</p>${prestigeButton}</article>`;
}

function renderLog() {
  el('eventLog').innerHTML = state.log.map(l => `<div class="log-entry"><strong>${new Date(l.time).toLocaleTimeString('ja-JP')}</strong><br>${l.text}</div>`).join('') || '<p class="hint">ログはまだありません。</p>';
}

function handleOfflineProgress() {
  const previous = state.lastSeen || Date.now();
  const elapsed = Date.now() - previous;
  if (elapsed < 5000) return;
  const summary = resolveExpeditions(Date.now(), true);
  if (summary.gold || summary.xp || summary.chests || summary.items) {
    showModal(`<h2>オフライン進行</h2><p>${Math.floor(elapsed / 1000)}秒の不在中に遠征が完了しました。</p><ul><li>金貨: ${fmt(summary.gold)}</li><li>経験値: ${fmt(summary.xp)}</li><li>宝箱: ${summary.chests}</li><li>装備: ${summary.items}</li></ul><h3>戦闘記録</h3>${summary.logs.map(x => `<p class="hint">${x}</p>`).join('')}`);
  }
}

function bindEvents() {
  document.body.addEventListener('click', event => {
    const target = event.target.closest('button, article');
    if (!target) return;
    const advCard = target.closest('[data-select-adv]');
    if (advCard && !target.matches('button')) { selectedAdventurerId = advCard.dataset.selectAdv; render(); return; }
    if (target.dataset.startDungeon) startExpedition(selectedAdventurerId, target.dataset.startDungeon);
    if (target.dataset.equip) equipItem(target.dataset.equip);
    if (target.dataset.sell) sellItem(target.dataset.sell);
    if (target.dataset.upgrade) upgradeFacility(target.dataset.upgrade);
    if ('prestige' in target.dataset) prestige();
  });
  el('recruitBtn').addEventListener('click', () => {
    const cost = recruitCost();
    if (state.gold < cost) return notify('金貨が不足しています。');
    state.gold -= cost; const adv = createAdventurer(); state.adventurers.push(adv); selectedAdventurerId = adv.id;
    addLog(`${adv.name}（${rarityJa[adv.rarity]}）を雇用しました。`); render(); saveGame();
  });
  el('openChestBtn').addEventListener('click', openChest);
  el('sellSelectedBtn').addEventListener('click', () => selectedItemId ? sellItem(selectedItemId) : notify('売却する装備を選択してください。'));
  el('saveBtn').addEventListener('click', () => { saveGame(); showModal(document.getElementById('deployInstructions').innerHTML); });
  el('clearLogBtn').addEventListener('click', () => { state.log = []; render(); saveGame(); });
  el('modalClose').addEventListener('click', hideModal);
  el('modal').addEventListener('click', e => { if (e.target.id === 'modal') hideModal(); });
  el('inventoryFilter').addEventListener('change', renderInventory);
  el('inventorySort').addEventListener('change', renderInventory);
  el('inventoryList').addEventListener('click', e => {
    const card = e.target.closest('[data-item]');
    if (card && !e.target.matches('button')) { selectedItemId = card.dataset.item; renderInventory(); }
  });
  el('inventoryList').addEventListener('mousemove', e => {
    const card = e.target.closest('[data-item]'), tip = el('itemTooltip');
    if (!card) { tip.style.display = 'none'; return; }
    const item = state.inventory.find(i => i.id === card.dataset.item);
    if (!item) return;
    const current = selectedAdventurerId ? state.adventurers.find(a => a.id === selectedAdventurerId)?.equipment[item.slot] : null;
    const currentItem = state.inventory.find(i => i.id === current);
    const diff = currentItem ? itemPower(item) - itemPower(currentItem) : itemPower(item);
    tip.innerHTML = `<strong>${item.name}</strong><br>${slotJa[item.slot]} / ${rarityJa[item.rarity]}<br>現在装備との差: ${diff >= 0 ? '+' : ''}${fmt(diff)} 戦力`;
    tip.style.left = `${Math.min(e.clientX + 16, window.innerWidth - 330)}px`; tip.style.top = `${e.clientY + 16}px`; tip.style.display = 'block';
  });
  el('inventoryList').addEventListener('mouseleave', () => { el('itemTooltip').style.display = 'none'; });
}

function gameLoop() {
  const now = Date.now();
  if (now - lastTick >= TICK_MS) {
    lastTick = now; resolveExpeditions(now); render(); saveGame();
  }
  requestAnimationFrame(gameLoop);
}

bindEvents();
handleOfflineProgress();
render();
gameLoop();
