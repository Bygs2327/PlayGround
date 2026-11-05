import {
  HANDLES, RANKS, DARK_RANKS, HEAT_STATES, WEAKNESS, CATEGORY_TONE,
  TOOLS, PAYLOADS, COVERS, UPGRADES, TARGETS, COMPLICATIONS, WORLD_NEWS,
  ACHIEVEMENTS, TOOL_MAP, PAYLOAD_MAP, TARGET_MAP, COVER_MAP, UPGRADE_MAP
} from './data.js';

/* ------------------------------------------------------------------ */
/* constants + helpers                                                */
/* ------------------------------------------------------------------ */

const SAVE_KEY = 'rootaccess.save.v2';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let S = null;
let savedState = null;
let screen = 'ops';
let arsenalTab = 'tools';
let marketTab = 'fence';
let draft = null;
let runSession = null;
let overlayLocked = false;
let pendingRaid = false;
let pendingEndgame = false;
let pendingNotices = [];
let lastRunOutcome = null;
let audioCtx = null;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pad2 = (n) => String(n).padStart(2, '0');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const uid = () => Math.random().toString(36).slice(2, 10);
const tagTone = (cat) => CATEGORY_TONE[cat] || 'cyan';

function meter(value, max, extra = '') {
  let out = `<span class="meter ${extra}">`;
  for (let i = 1; i <= max; i += 1) out += `<i class="${i <= value ? 'on' : ''}"></i>`;
  return `${out}</span>`;
}

/* ------------------------------------------------------------------ */
/* state                                                              */
/* ------------------------------------------------------------------ */

function defaultState(handle) {
  return {
    v: 2,
    handle,
    day: 1,
    credits: 160,
    energy: 8,
    rep: 0,
    darknet: 0,
    heat: 0,
    inventory: [],
    ownedTools: ['hydra', 'nmap', 'proxychains'],
    ownedPayloads: [],
    upgrades: { rig: 0, scrubber: 0, storage: 0, power: 0, relay: 0, papers: 0 },
    targets: {},
    news: [
      { day: 1, tag: 'WRAITH', text: 'First contact. MOTH.HOUSE is live on the board. Run recon before you touch the door.' },
      { day: 1, tag: 'WIRE', text: pick(WORLD_NEWS) }
    ],
    stats: {
      ops: 0, success: 0, fail: 0, clean: 0, sold: 0,
      earned: 0, spent: 0, viruses: 0, chaos: 0, arrests: 0, ransom: 0
    },
    flags: { tutorial: false, firstSuccess: false, firstArrest: false, aegisOpen: false, endingSeen: false },
    sound: true,
    createdAt: Date.now()
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.handle) return null;
    const base = defaultState(parsed.handle);
    return {
      ...base,
      ...parsed,
      upgrades: { ...base.upgrades, ...(parsed.upgrades || {}) },
      stats: { ...base.stats, ...(parsed.stats || {}) },
      flags: { ...base.flags, ...(parsed.flags || {}) },
      targets: parsed.targets || {},
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      ownedTools: Array.isArray(parsed.ownedTools) ? parsed.ownedTools : base.ownedTools,
      ownedPayloads: Array.isArray(parsed.ownedPayloads) ? parsed.ownedPayloads : [],
      news: Array.isArray(parsed.news) && parsed.news.length ? parsed.news : base.news
    };
  } catch {
    return null;
  }
}

function persist() {
  if (!S) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* storage may be disabled */ }
  updateHud();
}

function rankIndexFor(rep) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (rep >= r.min) idx = i; });
  return idx;
}
function rank() { return RANKS[rankIndexFor(S.rep)]; }
function darkRankIndexFor(dark) {
  let idx = 0;
  DARK_RANKS.forEach((r, i) => { if (dark >= r.min) idx = i; });
  return idx;
}
function darkRank() { return DARK_RANKS[darkRankIndexFor(S.darknet)]; }
function maxEnergy() { return 8 + (S.upgrades.power || 0); }
function invCap() { return 6 + (S.upgrades.storage || 0) * 2; }
function tstate(id) {
  if (!S.targets[id]) S.targets[id] = {};
  return S.targets[id];
}
function isDone(t) { return !!tstate(t.id).done; }
function isLocked(t) { return S.rep < t.reqRep; }
function isAlerted(t) {
  const ts = tstate(t.id);
  return !!(ts.alertUntil && ts.alertUntil >= S.day);
}
function effectiveDifficulty(t) { return t.difficulty + (isAlerted(t) ? 1 : 0); }
function heatState() { return HEAT_STATES.find((h) => S.heat <= h.max) || HEAT_STATES[HEAT_STATES.length - 1]; }
function saleMultiplier() { return 1 + Math.min(0.5, S.darknet * 0.006); }
function saleValue(item) { return Math.round(item.value * saleMultiplier()); }
function weaknessLabel(t) { return WEAKNESS[t.weakness] || t.weakness.toUpperCase(); }

function fixerMessage() {
  const aegis = TARGET_MAP.aegis;
  if (S.stats.ops === 0 && !isDone(TARGET_MAP.moth)) {
    return 'First contract is live: MOTH.HOUSE. Recon is cheap. Match your entry tool to the target weakness. If the trace spikes, cut the line.';
  }
  if (S.heat >= 75) {
    return 'You are burning. Dump the data, buy a burner relay, or sleep for a day. I am not covering for you, and the task force does not negotiate.';
  }
  if (S.inventory.length >= invCap()) {
    return 'Your cache is full. Fence something before you run another job. Data left in a hot drive is just evidence with a price tag.';
  }
  if (!isDone(aegis) && S.rep >= aegis.reqRep) {
    return 'AEGIS is open. Everything you have done leads to that door. Do not rush it. Buy the quiet tools, cool the heat, then go.';
  }
  if (S.flags.firstArrest) {
    return 'You got lucky. Next time they bring a warrant, a forensic team, and a van. Keep the heat under fifty or make yourself boring.';
  }
  if (S.stats.success >= 8) {
    return 'Your handle is moving through the right rooms. That means the wrong rooms have heard it too. Spend the cred on cover, not toys.';
  }
  const tips = [
    'Support modules stack. A cheap scanner plus a good entry tool beats a loud framework on its own.',
    'Darknet reputation raises fence prices and unlocks the serious malware. Sell, do not hoard.',
    'Heat over fifty gets you a file. Heat over seventy-five gets you a task force. End the day if the meter is screaming.',
    'Every target has a weakness. Matching your entry tool to it is worth more than raw power.',
    'A payload makes a run louder. Ransomware pays in credits and attention. Choose which one you can afford.',
    'Alerted targets run one layer harder for two days. Let them cool, or hit them with a better tool.',
    'The best run is a clean one. The second best is one where you still have a rig afterward.',
    'Recon gives ten percent and a weakness report. It costs one power. There is no good reason to skip it twice.'
  ];
  return tips[(S.day + S.stats.ops) % tips.length];
}

/* ------------------------------------------------------------------ */
/* HUD                                                                */
/* ------------------------------------------------------------------ */

function updateHud() {
  if (!S) return;
  $('#hud-handle').textContent = `@${S.handle}`;
  $('#hud-rank').textContent = rank().name;
  $('#hud-day').textContent = `DAY ${pad2(S.day)}`;
  $('#hud-power').textContent = `PWR ${S.energy}/${maxEnergy()}`;
  $('#hud-credits').textContent = `¤ ${fmt(S.credits)}`;
  $('#hud-rep').textContent = fmt(S.rep);
  $('#hud-dark').innerHTML = `${S.darknet} <em>${darkRank().name}</em>`;
  const hs = heatState();
  $('#heat-state').textContent = hs.name;
  $('#heat-value').textContent = `${Math.round(S.heat)}%`;
  $('#heat-fill').style.width = `${S.heat}%`;
  $('#heat-row').dataset.tone = hs.tone;
  const soundBtn = $('#sound-btn');
  soundBtn.textContent = S.sound ? '♪' : '×';
  soundBtn.classList.toggle('off', !S.sound);
  soundBtn.setAttribute('aria-label', S.sound ? 'Mute sound' : 'Enable sound');
}

/* ------------------------------------------------------------------ */
/* shared view helpers                                                */
/* ------------------------------------------------------------------ */

function riskNote() {
  if (S.heat >= 75) {
    return `<div class="risk-note critical"><span class="glyph">!</span><div><strong>HUNTED // HEAT ${Math.round(S.heat)}%</strong>The task force is building a file. End the day, buy cover, or get ready to burn everything.</div></div>`;
  }
  if (S.inventory.length >= invCap()) {
    return `<div class="risk-note"><span class="glyph">▤</span><div><strong>CACHE FULL</strong>Fence data in the market before you take another contract. Overflow is auto-fenced at a loss.</div></div>`;
  }
  if (S.heat >= 50) {
    return `<div class="risk-note"><span class="glyph">!</span><div><strong>FLAGGED // HEAT ${Math.round(S.heat)}%</strong>Analysts have a shape for you now. Keep the next run quiet or lay low.</div></div>`;
  }
  return '';
}

function newsTag(tag) {
  const tone = { WRAITH: 'pink', BREACH: 'cyan', RAID: 'red', MARKET: 'amber', WIRE: 'green', DARK: 'violet' }[tag] || '';
  return `<span class="tag ${tone}">${esc(tag)}</span>`;
}

function pushNews(tag, text) {
  S.news.unshift({ day: S.day, tag, text });
  if (S.news.length > 45) S.news.length = 45;
}

function announceProgress(prevRep, prevDark) {
  const notices = [];
  const newRank = rankIndexFor(S.rep);
  if (newRank > rankIndexFor(prevRep)) {
    notices.push({ tone: 'gold', text: `RANK UP // ${RANKS[newRank].name}` });
  }
  const newDark = darkRankIndexFor(S.darknet);
  if (newDark > darkRankIndexFor(prevDark)) {
    notices.push({ tone: 'gold', text: `DARKNET RANK // ${DARK_RANKS[newDark].name}` });
  }
  TARGETS.forEach((t) => {
    if (!isDone(t) && t.reqRep > prevRep && t.reqRep <= S.rep) {
      notices.push({ tone: 'good', text: `NEW CONTRACT // ${t.name}` });
    }
  });
  if (runSession) pendingNotices.push(...notices);
  else notices.forEach((n) => toast(n.text, n.tone, '◈'));
}

function flushNotices() {
  const list = pendingNotices.splice(0);
  list.forEach((n, i) => setTimeout(() => toast(n.text, n.tone, '◈'), i * 450));
}

/* ------------------------------------------------------------------ */
/* OPS VIEW                                                           */
/* ------------------------------------------------------------------ */

function contractCard(t, idx, priorityTarget) {
  const ts = tstate(t.id);
  const locked = isLocked(t);
  const done = isDone(t);
  const alert = isAlerted(t);
  const priority = priorityTarget && priorityTarget.id === t.id;
  let state = 'OPEN';
  let stateSub = `¤${fmt(t.payout[0])}–${fmt(t.payout[1])}`;
  if (done) {
    state = 'ZEROED';
    stateSub = `DAY ${pad2(ts.doneDay || '--')}`;
  } else if (locked) {
    state = 'LOCKED';
    stateSub = `REP ${t.reqRep}`;
  } else if (alert) {
    state = 'ALERTED';
    stateSub = 'SEC +1';
  }
  return `
    <button class="contract ${priority ? 'priority' : ''} ${locked ? 'locked' : ''} ${done ? 'done' : ''} ${alert ? 'alerted' : ''}"
      data-action="open-target" data-id="${t.id}" aria-label="${esc(t.name)} contract">
      <span class="contract-idx">${pad2(idx + 1)}</span>
      <span class="contract-main">
        <span class="contract-name">${esc(t.name)} <span class="tag ${tagTone(t.category)}">${t.category}</span>${priority ? '<span class="tag solid">NEXT</span>' : ''}</span>
        <span class="contract-meta">
          <span>DIFF ${effectiveDifficulty(t)}</span>
          <span>◈ ${esc(weaknessLabel(t))}</span>
          <span class="green">+${t.rep} REP</span>
        </span>
      </span>
      <span class="contract-state">${state}<strong>${stateSub}</strong></span>
    </button>`;
}

function viewOps() {
  const next = TARGETS.find((t) => !isDone(t) && !isLocked(t) && !isAlerted(t))
    || TARGETS.find((t) => !isDone(t) && !isLocked(t));
  const open = TARGETS.filter((t) => !isDone(t)).length;
  const first = S.stats.ops === 0;
  const pips = Array.from({ length: maxEnergy() }, (_, i) => `<span class="pip ${i < S.energy ? 'on' : ''}"></span>`).join('');
  return `
    <section class="section-head">
      <div class="eyebrow">CONTRACT BOARD // ${pad2(S.day)}</div>
      <h1 class="page-title">${first ? 'First contact.' : 'Back on the wire.'}</h1>
      <p class="page-sub">${first ? 'Every system has a door. Yours is the one nobody remembered to lock.' : 'The board refreshes. The heat does not. Choose the next door carefully.'}</p>
    </section>

    ${riskNote()}

    <div class="card fixer-card">
      <div class="fixer-head">
        <span class="avatar">W</span>
        <div>
          <div class="fixer-name">WRAITH <span class="tag pink">FIXER</span></div>
          <div class="fixer-meta">DEAD DROP // ${String(6 + (S.day % 12)).padStart(2, '0')}:${String((S.stats.ops * 7) % 60).padStart(2, '0')} LOCAL</div>
        </div>
      </div>
      <p class="fixer-msg">${esc(fixerMessage())}</p>
    </div>

    <div class="powerline">
      <span class="powerline-label">POWER</span>
      <div class="pips">${pips}</div>
      <span class="powerline-label">${S.energy}/${maxEnergy()}</span>
      <button class="mini-btn" data-action="end-day">END DAY</button>
    </div>

    <div class="section-head row">
      <div>
        <div class="eyebrow">OPEN WORK</div>
        <h2 class="count-title">${open} contract${open === 1 ? '' : 's'} remaining</h2>
      </div>
      <span class="tag ${S.heat >= 50 ? 'amber' : 'green'}">${S.heat >= 50 ? 'HEAT RISING' : 'GRID QUIET'}</span>
    </div>

    <div class="contracts">
      ${TARGETS.map((t, i) => contractCard(t, i, next)).join('')}
    </div>

    <p class="disclaimer" style="margin-top:18px">REAL TOOL + MALWARE NAMES APPEAR AS FICTIONALIZED GAME CONTENT · NO WORKING ATTACK CODE · THIS IS A SIMULATION</p>
  `;
}

/* ------------------------------------------------------------------ */
/* ARSENAL VIEW                                                       */
/* ------------------------------------------------------------------ */

function toolCard(tool, mode = 'arsenal') {
  const owned = S.ownedTools.includes(tool.id);
  const role = tool.role === 'entry' ? 'ENTRY' : 'SUPPORT';
  const isEntry = tool.role === 'entry';
  const heat = tool.heat > 0 ? `+${tool.heat}` : `${tool.heat}`;
  const reqBits = [];
  if (tool.reqRep) reqBits.push(`REP ${tool.reqRep}`);
  if (tool.reqDark) reqBits.push(`DARK ${tool.reqDark}`);
  let footer = '';
  if (mode === 'market') {
    if (owned) {
      footer = '<span class="tag green">OWNED</span>';
    } else {
      const disabled = S.credits < tool.cost || S.rep < tool.reqRep || S.darknet < (tool.reqDark || 0);
      footer = `<span class="price">¤ ${fmt(tool.cost)}${reqBits.length ? ` <span class="req">${reqBits.join(' · ')}</span>` : ''}</span>
        <button class="btn btn-sm ${disabled ? 'btn-ghost' : ''}" data-action="buy-tool" data-id="${tool.id}" ${disabled ? 'disabled' : ''}>ACQUIRE</button>`;
    }
  } else if (owned) {
    footer = `<span class="tag green">READY</span><span class="gear-sub">SELECTABLE IN EVERY PLAN</span>`;
  } else {
    footer = `<span class="price">¤ ${fmt(tool.cost)}${reqBits.length ? ` <span class="req">${reqBits.join(' · ')}</span>` : ''}</span>
      <button class="mini-btn" data-action="go-market" data-market="hardware">FIND IN MARKET →</button>`;
  }
  return `
    <div class="gear-card ${owned ? 'owned' : 'locked'}">
      <div class="gear-head">
        <div>
          <div class="gear-name">${esc(tool.name)} <span class="tag ${owned ? 'green' : 'amber'}">${owned ? 'OWNED' : 'LOCKED'}</span></div>
          <div class="gear-sub">${role} MODULE · ${tool.tags.map((x) => x.toUpperCase()).join(' / ')}</div>
        </div>
        <span class="tag">${role}</span>
      </div>
      <p class="gear-desc">${esc(tool.desc)}</p>
      <div class="gear-stats">
        ${isEntry
          ? `<span class="gear-stat">PWR ${meter(tool.power, 5)}</span>`
          : `<span class="gear-stat">BONUS ${meter(tool.bonus, 12)}</span>`}
        <span class="gear-stat">HEAT <b class="${tool.heat >= 6 ? 'red' : tool.heat <= 0 ? 'green' : 'amber'}">${heat}</b></span>
        <span class="gear-stat">TAGS <b>${tool.tags.map((x) => x.toUpperCase()).join(' / ')}</b></span>
      </div>
      <p class="gear-tip">${esc(tool.tip)}</p>
      <div class="gear-footer">${footer}</div>
    </div>`;
}

function payloadCard(payload, mode = 'arsenal') {
  const owned = S.ownedPayloads.includes(payload.id);
  const reqBits = [];
  if (payload.reqRep) reqBits.push(`REP ${payload.reqRep}`);
  if (payload.reqDark) reqBits.push(`DARK ${payload.reqDark}`);
  let footer = '';
  if (mode === 'market') {
    if (owned) {
      footer = '<span class="tag green">OWNED</span>';
    } else {
      const disabled = S.credits < payload.cost || S.rep < payload.reqRep || S.darknet < (payload.reqDark || 0);
      footer = `<span class="price">¤ ${fmt(payload.cost)}${reqBits.length ? ` <span class="req">${reqBits.join(' · ')}</span>` : ''}</span>
        <button class="btn btn-sm ${disabled ? 'btn-ghost' : ''}" data-action="buy-payload" data-id="${payload.id}" ${disabled ? 'disabled' : ''}>ACQUIRE</button>`;
    }
  } else if (owned) {
    footer = `<span class="tag green">READY</span><span class="gear-sub">OPTIONAL PAYLOAD SLOT</span>`;
  } else {
    footer = `<span class="price">¤ ${fmt(payload.cost)}${reqBits.length ? ` <span class="req">${reqBits.join(' · ')}</span>` : ''}</span>
      <button class="mini-btn" data-action="go-market" data-market="malware">FIND IN MARKET →</button>`;
  }
  return `
    <div class="gear-card ${owned ? 'owned' : 'locked'}">
      <div class="gear-head">
        <div>
          <div class="gear-name">${esc(payload.name)} <span class="tag ${owned ? 'green' : 'pink'}">${owned ? 'OWNED' : 'LOCKED'}</span></div>
          <div class="gear-sub">${payload.year} · ${esc(payload.kind)}</div>
        </div>
        <span class="tag red">PAYLOAD</span>
      </div>
      <p class="gear-desc">${esc(payload.desc)}</p>
      <div class="gear-stats">
        <span class="gear-stat">SUCCESS <b class="green">+${payload.success}%</b></span>
        <span class="gear-stat">HEAT <b class="red">+${payload.heat}</b></span>
        <span class="gear-stat">REP <b class="green">+${payload.rep}</b></span>
        <span class="gear-stat">LOOT <b>×${payload.lootMult.toFixed(2)}</b></span>
        ${payload.ransom ? `<span class="gear-stat">RANSOM <b class="amber">¤${fmt(payload.ransom[0])}–${fmt(payload.ransom[1])}</b></span>` : ''}
      </div>
      <div class="gear-footer">${footer}</div>
    </div>`;
}

function viewArsenal() {
  const ownedTools = TOOLS.filter((t) => S.ownedTools.includes(t.id)).length;
  const ownedPays = PAYLOADS.filter((p) => S.ownedPayloads.includes(p.id)).length;
  const sortedTools = [...TOOLS].sort((a, b) => {
    const ao = S.ownedTools.includes(a.id) ? 0 : 1;
    const bo = S.ownedTools.includes(b.id) ? 0 : 1;
    return ao - bo || a.cost - b.cost;
  });
  const list = arsenalTab === 'tools'
    ? sortedTools.map((t) => toolCard(t)).join('')
    : [...PAYLOADS].sort((a, b) => {
      const ao = S.ownedPayloads.includes(a.id) ? 0 : 1;
      const bo = S.ownedPayloads.includes(b.id) ? 0 : 1;
      return ao - bo || a.reqRep - b.reqRep;
    }).map((p) => payloadCard(p)).join('');

  return `
    <section class="section-head">
      <div class="eyebrow">YOUR KIT // ${ownedTools} TOOLS · ${ownedPays} PAYLOADS</div>
      <h1 class="page-title">The <span class="accent">arsenal</span>.</h1>
      <p class="page-sub">Entry tools open doors. Support modules stack on top. Payloads are optional, loud, and occasionally worth it.</p>
    </section>

    <div class="segmented">
      <button class="${arsenalTab === 'tools' ? 'active' : ''}" data-action="arsenal-tab" data-value="tools">TOOLS <span class="count">${ownedTools}/${TOOLS.length}</span></button>
      <button class="${arsenalTab === 'payloads' ? 'active' : ''}" data-action="arsenal-tab" data-value="payloads">PAYLOADS <span class="count">${ownedPays}/${PAYLOADS.length}</span></button>
    </div>

    ${list}

    <p class="disclaimer" style="margin-top:18px">TOOL + MALWARE NAMES ARE USED AS HISTORICAL REFERENCES IN A FICTIONAL SIMULATION. NO OPERATIONAL CODE OR ATTACK INSTRUCTIONS ARE INCLUDED.</p>
  `;
}

/* ------------------------------------------------------------------ */
/* MARKET VIEW                                                        */
/* ------------------------------------------------------------------ */

function fenceView() {
  const mult = saleMultiplier();
  const cap = invCap();
  const pct = Math.round((S.inventory.length / cap) * 100);
  const total = S.inventory.reduce((sum, item) => sum + saleValue(item), 0);
  const items = S.inventory.length
    ? S.inventory.map((item) => `
      <div class="item-card">
        <span class="item-glyph">▤</span>
        <span>
          <span class="item-name">${esc(item.name)}</span>
          <span class="item-meta"><span>${esc(item.src)}</span><span class="tag ${item.tag === 'MED' || item.tag === 'GOV' ? 'red' : 'cyan'}">${esc(item.tag)}</span><span>DAY ${pad2(item.day)}</span></span>
        </span>
        <span class="item-value">¤ ${fmt(saleValue(item))}<small>SELL</small></span>
        <button class="mini-btn" data-action="sell-item" data-id="${item.id}">SELL</button>
      </div>`).join('')
    : `<div class="empty"><span class="big">▤</span>Your cache is empty. Zero a contract and bring the data back.</div>`;

  return `
    <div class="capacity">
      <div class="capacity-top"><span>CACHE ${S.inventory.length}/${cap}</span><span>FENCE MULTIPLIER ×${mult.toFixed(2)}</span></div>
      <div class="capacity-track"><div class="capacity-fill ${pct >= 100 ? 'full' : ''}" style="width:${Math.min(100, pct)}%"></div></div>
    </div>
    <div class="inventory-grid">${items}</div>
    ${S.inventory.length ? `
      <div class="sell-all-bar">
        <span class="total">ALL DATA <b>¤ ${fmt(total)}</b></span>
        <button class="btn btn-sm" data-action="sell-all">SELL ALL</button>
      </div>
      <p class="disclaimer" style="text-align:left;margin-top:10px">SELLING ADDS TRACE HEAT. RADIOACTIVE TAGS (MED/GOV/BLACK) ARE WORTH MORE AND HURT MORE.</p>
    ` : ''}
  `;
}

function marketView() {
  const ownedTools = TOOLS.filter((t) => S.ownedTools.includes(t.id)).length;
  const ownedPays = PAYLOADS.filter((p) => S.ownedPayloads.includes(p.id)).length;
  let body = '';
  if (marketTab === 'fence') body = fenceView();
  if (marketTab === 'hardware') {
    const list = TOOLS.filter((t) => !S.ownedTools.includes(t.id)).sort((a, b) => a.reqRep - b.reqRep || a.cost - b.cost);
    body = list.length
      ? list.map((t) => toolCard(t, 'market')).join('')
      : '<div class="empty"><span class="big">✓</span>Every tool in the catalog is already in your kit.</div>';
  }
  if (marketTab === 'malware') {
    const list = PAYLOADS.filter((p) => !S.ownedPayloads.includes(p.id)).sort((a, b) => a.reqRep - b.reqRep || a.cost - b.cost);
    body = list.length
      ? list.map((p) => payloadCard(p, 'market')).join('')
      : '<div class="empty"><span class="big">✓</span>Every payload in the catalog is already in your kit.</div>';
  }
  return `
    <section class="section-head">
      <div class="eyebrow">THE BAZAAR // ESCROW ONLINE</div>
      <h1 class="page-title">Fence it. <span class="accent">Buy better.</span></h1>
      <p class="page-sub">Stolen data is only worth what someone will pay before it spoils. Tools are an investment. Payloads are a confession.</p>
    </section>

    <div class="market-header">
      <div><div class="label">AVAILABLE CREDITS</div><div class="value">¤ ${fmt(S.credits)}</div></div>
      <div style="text-align:right"><div class="label">DARKNET STANDING</div><div class="value violet">${darkRank().name} · ${S.darknet}</div></div>
    </div>

    <div class="segmented">
      <button class="${marketTab === 'fence' ? 'active' : ''}" data-action="market-tab" data-value="fence">FENCE <span class="count">${S.inventory.length}</span></button>
      <button class="${marketTab === 'hardware' ? 'active' : ''}" data-action="market-tab" data-value="hardware">HARDWARE <span class="count">${ownedTools}/${TOOLS.length}</span></button>
      <button class="${marketTab === 'malware' ? 'active' : ''}" data-action="market-tab" data-value="malware">MALWARE <span class="count">${ownedPays}/${PAYLOADS.length}</span></button>
    </div>

    ${body}

    <p class="disclaimer" style="margin-top:18px">MARKET ITEMS ARE FICTIONAL GAME OBJECTS NAMED AFTER REAL TOOLS AND HISTORICAL MALWARE. NOTHING HERE CAN BE DOWNLOADED OR RUN.</p>
  `;
}

/* ------------------------------------------------------------------ */
/* SAFEHOUSE VIEW                                                     */
/* ------------------------------------------------------------------ */

function upgradeCard(up) {
  const level = S.upgrades[up.id] || 0;
  const maxed = level >= up.max;
  const cost = maxed ? null : up.costs[level];
  const levels = Array.from({ length: up.max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
  const canBuy = !maxed && S.credits >= cost;
  return `
    <div class="upgrade-card">
      <span class="upgrade-glyph">${up.glyph}</span>
      <div>
        <div class="upgrade-name"><span>${esc(up.name)}</span><span class="tag ${maxed ? 'green' : ''}">${maxed ? 'MAX' : `LVL ${level}/${up.max}`}</span></div>
        <div class="upgrade-levels">${levels}</div>
        <p class="upgrade-desc">${esc(up.desc)}</p>
        <div class="upgrade-stat">${esc(up.stat)}</div>
        <div class="upgrade-foot">
          <span class="price">${maxed ? 'FULLY UPGRADED' : `¤ ${fmt(cost)}`}</span>
          ${maxed ? '' : `<button class="mini-btn" data-action="buy-upgrade" data-id="${up.id}" ${canBuy ? '' : 'disabled'}>${canBuy ? 'INSTALL' : 'NEED CREDITS'}</button>`}
        </div>
      </div>
    </div>`;
}

function viewSafehouse() {
  const pct = Math.round((S.inventory.length / invCap()) * 100);
  const unlocked = ACHIEVEMENTS.map((a) => ({ ...a, on: a.test(S) }));
  const done = unlocked.filter((a) => a.on).length;
  return `
    <section class="section-head">
      <div class="eyebrow">SAFEHOUSE // SUBLEVEL 3</div>
      <h1 class="page-title">Keep the lights <span class="accent">on.</span></h1>
      <p class="page-sub">Rest, upgrade, and make yourself harder to find. The rent is due whether or not the job pays.</p>
    </section>

    <div class="safe-panel">
      <div class="metric-box"><div class="k">DAY</div><div class="v">${pad2(S.day)}</div><div class="s">${rank().name}</div></div>
      <div class="metric-box"><div class="k">POWER</div><div class="v green">${S.energy}/${maxEnergy()}</div><div class="s">${S.energy === 0 ? 'TIRED' : 'READY'}</div></div>
      <div class="metric-box"><div class="k">HEAT</div><div class="v ${S.heat >= 75 ? 'red' : ''}">${Math.round(S.heat)}%</div><div class="s">${heatState().name}</div></div>
      <div class="metric-box"><div class="k">CACHE</div><div class="v">${S.inventory.length}/${invCap()}</div><div class="s">${pct >= 100 ? 'FULL' : `${pct}% USED`}</div></div>
    </div>

    <div class="card rest-card">
      <div class="eyebrow">END OF DAY</div>
      <h3>Pull the blinds. Let the trace cool.</h3>
      <p>Advance to the next day. Restores all power, cools heat by 7, expires alerts, and charges ¤25 for rent and bandwidth. If you cannot pay, the heat finds you.</p>
      <div class="rest-row">
        <span class="cost">UPKEEP ¤25 · −7 HEAT</span>
        <button class="btn btn-primary btn-sm" data-action="end-day">END DAY →</button>
      </div>
    </div>

    <div class="section-head row">
      <div><div class="eyebrow">HARDWARE</div><h2 class="count-title">Safehouse upgrades</h2></div>
      <span class="tag green">${S.credits >= 0 ? `¤ ${fmt(S.credits)}` : ''}</span>
    </div>
    <div class="upgrade-grid">${UPGRADES.map(upgradeCard).join('')}</div>

    <div class="section-head row" style="margin-top:20px">
      <div><div class="eyebrow">DOSSIER</div><h2 class="count-title">What the record says</h2></div>
      <span class="tag ${S.stats.arrests ? 'red' : 'green'}">${S.stats.arrests} RAID${S.stats.arrests === 1 ? '' : 'S'}</span>
    </div>
    <div class="dossier-grid">
      <div class="dossier-cell"><div class="k">OPS</div><div class="v">${S.stats.ops}</div></div>
      <div class="dossier-cell"><div class="k">CLEAN</div><div class="v">${S.stats.clean}</div></div>
      <div class="dossier-cell"><div class="k">SOLD</div><div class="v">${S.stats.sold}</div></div>
      <div class="dossier-cell"><div class="k">EARNED</div><div class="v">${fmt(S.stats.earned)}</div></div>
      <div class="dossier-cell"><div class="k">VIRUSES</div><div class="v">${S.stats.viruses}</div></div>
      <div class="dossier-cell"><div class="k">CHAOS</div><div class="v">${S.stats.chaos}</div></div>
    </div>

    <div class="section-head row" style="margin-top:20px">
      <div><div class="eyebrow">ACHIEVEMENTS</div><h2 class="count-title">${done}/${ACHIEVEMENTS.length} unlocked</h2></div>
    </div>
    <div class="achievements">
      ${unlocked.map((a) => `<span class="achievement ${a.on ? 'on' : ''}" title="${esc(a.desc)}"><span class="dotmark"></span>${esc(a.name)}</span>`).join('')}
    </div>

    <div class="section-head row" style="margin-top:20px">
      <div><div class="eyebrow">SYSTEM</div><h2 class="count-title">Local session</h2></div>
    </div>
    <div class="settings-list">
      <div class="settings-row"><div><div>Sound</div><div class="sub">Synthesized interface beeps</div></div><button class="mini-btn" data-action="toggle-sound">${S.sound ? 'ON' : 'OFF'}</button></div>
      <div class="settings-row"><div><div>Field manual</div><div class="sub">How the run loop works</div></div><button class="mini-btn" data-action="open-help">OPEN</button></div>
      <div class="settings-row"><div><div>Wipe identity</div><div class="sub">Deletes local save permanently</div></div><button class="mini-btn danger" data-action="reset-run">RESET</button></div>
    </div>

    <p class="disclaimer" style="margin-top:18px">PROGRESS SAVES LOCALLY IN THIS BROWSER. THIS IS A FICTIONAL SIMULATION; REAL CYBERCRIME IS A CRIME.</p>
  `;
}

/* ------------------------------------------------------------------ */
/* INTEL VIEW                                                         */
/* ------------------------------------------------------------------ */

function viewIntel() {
  const ri = rankIndexFor(S.rep);
  const cur = RANKS[ri];
  const next = RANKS[ri + 1];
  const rankPct = next ? Math.round(((S.rep - cur.min) / (next.min - cur.min)) * 100) : 100;
  const open = TARGETS.filter((t) => !isDone(t)).length;
  const hs = heatState();
  return `
    <section class="section-head">
      <div class="eyebrow">THE WIRE // LIVE FEED</div>
      <h1 class="page-title">Someone is <span class="accent">always watching.</span></h1>
      <p class="page-sub">Headlines, fixer traffic, and the shape of your own file. Reputation opens doors. Heat closes them.</p>
    </section>

    <div class="card case-panel">
      <div class="eyebrow">CASE FILE // @${esc(S.handle)}</div>
      <div class="case-row"><span>STREET STANDING</span><b>${rank().name} · ${fmt(S.rep)} REP</b></div>
      <div class="case-row"><span>THREAT LEVEL</span><b class="${S.heat >= 75 ? 'red' : S.heat >= 50 ? 'amber' : 'green'}">${hs.name} · ${Math.round(S.heat)}%</b></div>
      <div class="case-row"><span>DARKNET STANDING</span><b>${darkRank().name} · ${S.darknet}</b></div>
      <div class="case-row"><span>OPEN CONTRACTS</span><b>${open}</b></div>
      <div class="case-row"><span>RAIDS SURVIVED</span><b class="${S.stats.arrests ? 'red' : ''}">${S.stats.arrests} / 3</b></div>
      <div class="capacity" style="margin:9px 0 0">
        <div class="capacity-top"><span>NEXT RANK ${next ? esc(next.name) : 'MAX'}</span><span>${next ? `${fmt(S.rep)} / ${next.min}` : 'MYTH'}</span></div>
        <div class="capacity-track"><div class="capacity-fill" style="width:${clamp(rankPct, 0, 100)}%"></div></div>
      </div>
    </div>

    <div class="section-head row" style="margin-top:20px">
      <div><div class="eyebrow">TRAFFIC</div><h2 class="count-title">The last 45 signals</h2></div>
      <span class="tag green">LIVE</span>
    </div>
    <div class="timeline">
      ${S.news.map((n) => `
        <div class="news-item ${n.tag === 'RAID' ? 'raid' : n.tag === 'BREACH' ? 'hot' : ''}">
          <div class="news-meta"><span class="news-day">DAY ${pad2(n.day)}</span>${newsTag(n.tag)}</div>
          <div class="news-text">${esc(n.text)}</div>
        </div>`).join('')}
    </div>

    <div class="card" style="margin-top:12px">
      <div class="eyebrow">FIELD NOTES</div>
      <ul class="tip-list">
        <li><b>01</b><span>Recon costs 1 power and gives +10% success plus a weakness report. Use it.</span></li>
        <li><b>02</b><span>Entry tools have <b>PWR</b>. Support modules add <b>BONUS</b> and often reduce heat.</span></li>
        <li><b>03</b><span>Payloads add success, loot, reputation, and heat. Ransomware also pays credits immediately.</span></li>
        <li><b>04</b><span>Heat at 100 triggers a raid. You get two ways out. Three raids ends the run.</span></li>
        <li><b>05</b><span>Selling raises darknet reputation, improving fence prices and unlocking serious malware.</span></li>
      </ul>
    </div>

    <p class="disclaimer" style="margin-top:18px">REAL-WORLD NAMES ARE USED FOR HISTORICAL CONTEXT ONLY. THIS GAME CONTAINS NO FUNCTIONAL MALWARE, EXPLOITS, OR ATTACK TOOLS.</p>
  `;
}

/* ------------------------------------------------------------------ */
/* RENDER                                                             */
/* ------------------------------------------------------------------ */

function render() {
  if (!S) return;
  updateHud();
  const views = { ops: viewOps, arsenal: viewArsenal, market: marketView, safehouse: viewSafehouse, intel: viewIntel };
  $('#view').innerHTML = (views[screen] || viewOps)();
  $$('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === screen));
}

function switchTab(tab) {
  if (!S) return;
  screen = tab;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
/* ------------------------------------------------------------------ */
/* overlay helpers                                                    */
/* ------------------------------------------------------------------ */

function setOverlay(html) {
  const root = $('#overlay');
  root.innerHTML = html;
  document.body.classList.add('overlay-open');
}
function clearOverlay() {
  $('#overlay').innerHTML = '';
  document.body.classList.remove('overlay-open');
  overlayLocked = false;
}
function closeOverlay() {
  if (overlayLocked) return;
  clearOverlay();
}

const closeBtn = '<button class="sheet-close" data-action="close-overlay" aria-label="Close">×</button>';

/* ------------------------------------------------------------------ */
/* HELP / INTRO / RESET                                               */
/* ------------------------------------------------------------------ */

function openHelp() {
  setOverlay(`
    <div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Field manual">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div><div class="eyebrow">FIELD MANUAL // REV 2.7</div><h2>How to run the grid.</h2></div>
          ${closeBtn}
        </div>
        <div class="help-section">
          <h3><span class="num">01</span> THE JOB LOOP</h3>
          <p>Open <b>OPS</b>, pick a contract, and run <b>RECON</b> (1 power) for +10% success and a weakness report. Then <b>PLAN OP</b> and choose an entry tool, optional support, optional payload, and cover.</p>
        </div>
        <div class="help-section">
          <h3><span class="num">02</span> MATCH THE WEAKNESS</h3>
          <p>Each target has a weak layer: <b>WEB/CMS, NETWORK EDGE, CREDENTIALS, HUMAN FACTOR,</b> or <b>OT/INDUSTRIAL</b>. An entry tool that matches gets a large success bonus. Support modules add their bonus; matching support adds more.</p>
        </div>
        <div class="help-section">
          <h3><span class="num">03</span> THE BREACH</h3>
          <p>Watch the trace. Mid-run you can <b>PUSH THROUGH</b> (+8% success, +8 heat), <b>REROUTE</b> (¤40, −10 heat), or <b>CUT THE LINE</b> (no loot, minimal heat). A failed run leaves the target alerted for two days.</p>
        </div>
        <div class="help-section">
          <h3><span class="num">04</span> HEAT &amp; RAIDS</h3>
          <p>Heat is the only thing that can end you. At 100 the door comes in. Burn the rig (lose data and credits) or stand ground (lose more credits, keep data, stay hot). Three raids ends the run.</p>
        </div>
        <div class="help-section">
          <h3><span class="num">05</span> MONEY &amp; REP</h3>
          <p>Sell stolen data in <b>MARKET → FENCE</b>. Sales raise darknet reputation and improve prices. Street reputation unlocks harder contracts. Buy tools, payloads, and safehouse upgrades to reach AEGIS DEFENSE.</p>
        </div>
        <div class="help-section">
          <h3><span class="num">06</span> REAL-WORLD NAMES</h3>
          <p>Tools and historical malware names appear as <b>fictional game content</b>. There is no working attack code, malware, or operational instruction in this game. This is a simulation about consequences, not a manual.</p>
        </div>
        <button class="btn btn-block" data-action="close-overlay" style="margin-top:14px">GOT IT</button>
        <p class="disclaimer">PROGRESS SAVES LOCALLY. REAL CYBERCRIME IS A CRIME.</p>
      </div>
    </div>`);
}

function openIntro() {
  setOverlay(`
    <div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="First contact">
        <div class="sheet-grip"></div>
        <div class="fixer-head">
          <span class="avatar">W</span>
          <div>
            <div class="fixer-name">WRAITH <span class="tag pink">FIXER</span></div>
            <div class="fixer-meta">ENCRYPTED DROP // FIRST CONTACT</div>
          </div>
        </div>
        <h2 style="margin:8px 0 6px;font-size:21px">Before you touch anything.</h2>
        <p class="lede">You have a handle, a secondhand rig, and one soft target. That is more than most people get.</p>
        <div class="help-section">
          <h3>01 · RECON FIRST</h3>
          <p>It costs one power and buys ten percent success plus a weakness report. Cheap people get caught.</p>
        </div>
        <div class="help-section">
          <h3>02 · MATCH THE TOOL</h3>
          <p>Every target has a weak layer. Pick an entry tool that matches it and stack a support module on top.</p>
        </div>
        <div class="help-section">
          <h3>03 · HEAT KILLS</h3>
          <p>Every job leaves a trace. At 100 heat, they come for you. End the day, buy cover, or cut the line.</p>
        </div>
        <button class="btn btn-block" data-action="close-intro" style="margin-top:12px">UNDERSTOOD. OPEN THE BOARD.</button>
      </div>
    </div>`);
}

function openResetConfirm() {
  setOverlay(`
    <div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Reset run">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div><div class="eyebrow">DANGER // LOCAL WIPE</div><h2>Burn this identity?</h2></div>
          ${closeBtn}
        </div>
        <p class="lede">This deletes your save, reputation, credits, data, and all progress on this device. There is no recovery and no undo.</p>
        <div class="sheet-actions">
          <button class="btn btn-ghost" data-action="close-overlay">KEEP PLAYING</button>
          <button class="btn btn-danger" data-action="confirm-reset">WIPE IT</button>
        </div>
      </div>
    </div>`);
}

/* ------------------------------------------------------------------ */
/* TARGET DETAIL                                                      */
/* ------------------------------------------------------------------ */

function securityBars(t) {
  const labels = ['PERIMETER', 'AUTH', 'DATA'];
  return t.security.map((v, i) => {
    const bars = Array.from({ length: 5 }, (_, n) => {
      const on = n < v;
      const cls = on ? (v >= 5 ? 'on critical' : v >= 4 ? 'on hot' : 'on') : '';
      return `<i class="${cls}"></i>`;
    }).join('');
    return `<div class="sec-row"><span class="sec-label">${labels[i]}</span><span class="sec-bars">${bars}</span><span class="sec-num">${v}/5</span></div>`;
  }).join('');
}

function recommendedChips(t) {
  const suggested = TOOLS.filter((tool) => tool.tags.includes(t.weakness)).slice(0, 4);
  if (!suggested.length) return '<span class="rec-chip">NO DIRECT MATCH</span>';
  return suggested.map((tool) => {
    const owned = S.ownedTools.includes(tool.id);
    return `<span class="rec-chip ${owned ? 'owned' : 'need'}">${owned ? '✓ ' : ''}${esc(tool.name)}${owned ? '' : ' · MARKET'}</span>`;
  }).join('');
}

function openTarget(id) {
  const t = TARGET_MAP[id];
  if (!t) return;
  const ts = tstate(t.id);
  const locked = isLocked(t);
  const done = isDone(t);
  const alert = isAlerted(t);
  const recon = !!ts.recon;
  const entryTools = TOOLS.filter((tool) => tool.role === 'entry' && S.ownedTools.includes(tool.id));
  const minEnergy = entryTools.length ? Math.min(...entryTools.map((tool) => 1 + (tool.energy || 1))) : 2;
  let banner = '';
  if (done) banner = `<div class="status-banner done">▣ <b>TARGET ZEROED</b> · CONTRACT CLOSED ON DAY ${pad2(ts.doneDay || '--')}</div>`;
  else if (locked) banner = `<div class="status-banner locked">▣ <b>LOCKED</b> · REQUIRES ${t.reqRep} STREET REPUTATION</div>`;
  else if (alert) banner = `<div class="status-banner alerted">! <b>ALERTED</b> · SECURITY +1 UNTIL DAY ${pad2(ts.alertUntil)}</div>`;
  else banner = `<div class="status-banner open">● <b>TARGET OPEN</b> · ${recon ? 'INTEL ACQUIRED' : 'NO RECON YET'}</div>`;

  const actions = done
    ? `<button class="btn btn-ghost btn-block" data-action="close-overlay">CLOSE FILE</button>`
    : locked
      ? `<button class="btn btn-ghost btn-block" data-action="close-overlay">BUILD MORE REPUTATION</button>`
      : `<button class="btn btn-ghost" data-action="recon" data-id="${t.id}" ${recon || S.energy < 1 ? 'disabled' : ''}>${recon ? 'INTEL ACQUIRED' : 'RECON · 1 PWR'}</button>
         <button class="btn btn-primary" data-action="plan" data-id="${t.id}" ${!entryTools.length || S.energy < minEnergy ? 'disabled' : ''}>PLAN OP · ${minEnergy} PWR</button>`;

  setOverlay(`
    <div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(t.name)} details">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div>
            <div class="eyebrow">${t.category} // DIFFICULTY ${t.difficulty}</div>
            <h2>${esc(t.name)}</h2>
          </div>
          ${closeBtn}
        </div>
        ${banner}
        <p class="lede">${esc(t.desc)}</p>
        <div class="contract-tags">
          <span class="tag ${tagTone(t.category)}">${t.category}</span>
          <span class="tag ${t.weakness === 'web' ? 'cyan' : t.weakness === 'network' ? 'green' : t.weakness === 'auth' ? 'amber' : t.weakness === 'human' ? 'pink' : 'orange'}">WEAK: ${esc(weaknessLabel(t))}</span>
          <span class="tag">${recon ? 'INTEL ✓' : 'UNSCOUTED'}</span>
        </div>
        <div class="two-col">
          <div class="stat-box"><div class="k">EST. PAYOUT</div><div class="v green">¤ ${fmt(t.payout[0])}–${fmt(t.payout[1])}</div></div>
          <div class="stat-box"><div class="k">REPUTATION</div><div class="v">+${t.rep}</div></div>
          <div class="stat-box"><div class="k">BASE HEAT</div><div class="v amber">+${t.heat}</div></div>
          <div class="stat-box"><div class="k">EFFECTIVE DIFF</div><div class="v pink">${effectiveDifficulty(t)} / 5</div></div>
        </div>

        <div class="panel">
          <div class="eyebrow">SECURITY LAYERS</div>
          ${securityBars(t)}
        </div>

        <div class="panel intel-box ${recon ? '' : 'unread'}">
          <div class="eyebrow">${recon ? 'FIELD INTEL // ACQUIRED' : 'FIELD INTEL // UNKNOWN'}</div>
          <div class="intel-text">${recon ? esc(t.intel) : 'No intel. Run recon to reveal the weak layer and gain <b class="green">+10% breach success</b>.'}</div>
        </div>

        <div class="panel">
          <div class="eyebrow">SUGGESTED KIT // MATCHES WEAKNESS</div>
          <div class="recommend">${recommendedChips(t)}</div>
          <p class="gear-tip" style="margin-top:9px">${esc(t.contract)}</p>
        </div>

        <div class="sheet-actions">${actions}</div>
        ${locked ? '' : `<p class="plan-note" style="margin-top:9px">${S.energy < minEnergy ? 'LOW POWER — END THE DAY OR VISIT THE SAFEHOUSE.' : 'ENTRY TOOL REQUIRED. SUPPORT AND PAYLOAD ARE OPTIONAL.'}</p>`}
      </div>
    </div>`);
}

function doRecon(id) {
  const t = TARGET_MAP[id];
  if (!t) return;
  const ts = tstate(id);
  if (isLocked(t) || isDone(t)) return;
  if (ts.recon) { toast('Intel already acquired for this target.', 'warn', '!'); return; }
  if (S.energy < 1) { toast('No power. End the day to recharge.', 'error', '!'); return; }
  S.energy -= 1;
  ts.recon = true;
  const caught = Math.random() < 0.16;
  if (caught) S.heat = clamp(S.heat + 2, 0, 100);
  persist();
  sfx('scan');
  render();
  openTarget(id);
  toast(caught ? 'RECON COMPLETE // +10% success · a sensor noticed you (+2 heat)' : 'RECON COMPLETE // +10% success · weakness mapped', caught ? 'warn' : 'good', '◈');
}

/* ------------------------------------------------------------------ */
/* PLAN                                                               */
/* ------------------------------------------------------------------ */

function bestEntry(t) {
  const owned = TOOLS.filter((tool) => tool.role === 'entry' && S.ownedTools.includes(tool.id));
  if (!owned.length) return null;
  const sorted = [...owned].sort((a, b) => {
    const am = a.tags.includes(t.weakness) ? 1 : 0;
    const bm = b.tags.includes(t.weakness) ? 1 : 0;
    return bm - am || b.power - a.power || a.cost - b.cost;
  });
  return sorted[0].id;
}

function bestSupport(t) {
  const owned = TOOLS.filter((tool) => tool.role === 'support' && S.ownedTools.includes(tool.id));
  if (!owned.length) return null;
  const sorted = [...owned].sort((a, b) => {
    const am = a.tags.includes(t.weakness) ? 8 : 0;
    const bm = b.tags.includes(t.weakness) ? 8 : 0;
    return (b.bonus + bm + b.heat) - (a.bonus + am + a.heat);
  });
  return sorted[0].id;
}

function coverUnlocked(cover) {
  if (!cover.reqUpgrade) return true;
  const [id, level] = cover.reqUpgrade;
  return (S.upgrades[id] || 0) >= level;
}

function planStatsFor(id, d) {
  const t = TARGET_MAP[id];
  const entry = TOOL_MAP[d.entry];
  if (!t || !entry) return null;
  const support = d.support && d.support !== 'none' ? TOOL_MAP[d.support] : null;
  const payload = d.payload && d.payload !== 'none' ? PAYLOAD_MAP[d.payload] : null;
  const cover = COVER_MAP[d.cover] || COVER_MAP.direct;
  const ts = tstate(id);
  const alert = isAlerted(t);
  const diff = t.difficulty + (alert ? 1 : 0);
  const entryMatch = entry.tags.includes(t.weakness);
  const supportMatch = support ? support.tags.includes(t.weakness) : false;
  let chance = 40
    + (entry.power || 0) * 9
    + (entryMatch ? 22 : 0)
    + (support ? support.bonus + (supportMatch ? 8 : 0) : 0)
    + (ts.recon ? 10 : 0)
    + (S.upgrades.rig || 0) * 4
    + (payload ? payload.success : 0)
    + (payload && payload.tags.includes(t.weakness) ? 6 : 0)
    - diff * 9;
  chance = clamp(Math.round(chance), 5, 96);
  let heat = t.heat
    + (entry.heat || 0)
    + (support ? support.heat : 0)
    + (payload ? payload.heat : 0)
    + cover.heat
    + (alert ? 4 : 0);
  heat = Math.max(2, Math.round(heat * (1 - (S.upgrades.scrubber || 0) * 0.08)));
  const energy = 1 + (entry.energy || 1);
  const canAfford = S.credits >= cover.cost;
  const unlocked = coverUnlocked(cover);
  return {
    t, entry, support, payload, cover, chance, heat, energy,
    entryMatch, supportMatch, coverCost: cover.cost,
    canRun: S.energy >= energy && canAfford && unlocked,
    payout: t.payout
  };
}

function openPlan(id) {
  const t = TARGET_MAP[id];
  if (!t || isLocked(t) || isDone(t)) return;
  const entry = bestEntry(t);
  if (!entry) { toast('No entry tool available. Buy one in the market.', 'error', '!'); return; }
  let cover = 'direct';
  if (S.heat >= 35 && S.credits >= 60) cover = 'proxy';
  if (S.heat >= 60 && S.credits >= 180 && (S.upgrades.relay || 0) >= 1) cover = 'burner';
  draft = { target: id, entry, support: bestSupport(t), payload: null, cover };
  renderPlan();
}

function planChoice(selected, name, tagText, detail, badge = '') {
  return `<button class="choice ${selected ? 'selected' : ''}" data-action="${tagText.action}" data-id="${tagText.id}">
    <span class="choice-head"><span class="choice-name">${esc(name)} ${badge}</span>${tagText.tag ? `<span class="choice-tag">${tagText.tag}</span>` : ''}</span>
    <span class="choice-detail">${detail}</span>
  </button>`;
}

function renderPlan() {
  if (!draft) return;
  const t = TARGET_MAP[draft.target];
  const stats = planStatsFor(draft.target, draft);
  if (!t || !stats) return;
  const oldScroll = $('.plan-scroll');
  const scrollTop = oldScroll ? oldScroll.scrollTop : 0;
  const entryTools = TOOLS.filter((tool) => tool.role === 'entry' && S.ownedTools.includes(tool.id));
  const supportTools = TOOLS.filter((tool) => tool.role === 'support' && S.ownedTools.includes(tool.id));
  const payloads = PAYLOADS.filter((p) => S.ownedPayloads.includes(p.id));

  const entryChoices = entryTools.map((tool) => {
    const match = tool.tags.includes(t.weakness);
    return planChoice(draft.entry === tool.id, tool.name, { action: 'select-entry', id: tool.id, tag: tool.role.toUpperCase() },
      `<span>PWR <b>${tool.power}/5</b></span><span>HEAT <b class="${tool.heat >= 6 ? 'red' : ''}">+${tool.heat}</b></span><span>${tool.tags.map((x) => x.toUpperCase()).join(' / ')}</span>`,
      match ? '<span class="choice-badge match">MATCH</span>' : '');
  }).join('');

  const noneSupport = planChoice(!draft.support, 'NONE', { action: 'select-support', id: 'none', tag: 'OPTIONAL' },
    '<span>No support module. Pure entry.</span>');
  const supportChoices = supportTools.map((tool) => {
    const match = tool.tags.includes(t.weakness);
    return planChoice(draft.support === tool.id, tool.name, { action: 'select-support', id: tool.id, tag: 'SUPPORT' },
      `<span>BONUS <b>+${tool.bonus}</b></span><span>HEAT <b class="${tool.heat > 0 ? 'amber' : 'green'}">${tool.heat > 0 ? '+' : ''}${tool.heat}</b></span><span>${tool.tags.map((x) => x.toUpperCase()).join(' / ')}</span>`,
      match ? '<span class="choice-badge match">MATCH</span>' : '');
  }).join('');

  const nonePayload = planChoice(!draft.payload, 'NO PAYLOAD', { action: 'select-payload', id: 'none', tag: 'CLEAN' },
    '<span>Quietest option. No extra heat or reputation.</span>');
  const payloadChoices = payloads.map((p) => planChoice(draft.payload === p.id, p.name, { action: 'select-payload', id: p.id, tag: `${p.year}` },
    `<span>SUCCESS <b class="green">+${p.success}%</b></span><span>HEAT <b class="red">+${p.heat}</b></span><span>REP <b>+${p.rep}</b></span><span>LOOT <b>×${p.lootMult.toFixed(2)}</b></span>`,
    p.tags.includes(t.weakness) ? '<span class="choice-badge match">MATCH</span>' : '')).join('');

  const coverChoices = COVERS.map((cover) => {
    const unlocked = coverUnlocked(cover);
    const affordable = S.credits >= cover.cost;
    const disabled = !unlocked || !affordable;
    const detail = `<span>COST <b class="${cover.cost ? 'amber' : 'green'}">${cover.cost ? `¤${cover.cost}` : 'FREE'}</b></span><span>HEAT <b class="${cover.heat < 0 ? 'green' : 'amber'}">${cover.heat > 0 ? '+' : ''}${cover.heat}</b></span><span>${esc(cover.desc)}</span>`;
    return `<button class="choice ${draft.cover === cover.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}" data-action="select-cover" data-id="${cover.id}" ${disabled ? 'disabled' : ''}>
      <span class="choice-head"><span class="choice-name">${esc(cover.name)} ${!unlocked ? '<span class="choice-tag">LOCKED</span>' : ''}</span>${cover.heat < 0 ? '<span class="choice-badge">STEALTH</span>' : ''}</span>
      <span class="choice-detail">${detail}</span>
    </button>`;
  }).join('');

  const lowPower = S.energy < stats.energy;
  const noCoverCredits = S.credits < stats.coverCost;
  let runNote = 'SUCCESS IS NEVER GUARANTEED. YOU CAN CUT THE LINE MID-RUN.';
  if (lowPower) runNote = `LOW POWER // NEED ${stats.energy}, HAVE ${S.energy}. END THE DAY TO RECHARGE.`;
  else if (noCoverCredits) runNote = `COVER COSTS ¤${stats.coverCost}. YOU HAVE ¤${fmt(S.credits)}.`;
  else if (!coverUnlocked(stats.cover)) runNote = 'THIS COVER IS LOCKED. INSTALL GHOST RELAY IN THE SAFEHOUSE.';

  setOverlay(`
    <div class="sheet-backdrop">
      <div class="sheet plan" role="dialog" aria-modal="true" aria-label="Plan operation">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <div>
            <div class="eyebrow">PLAN OP // ${esc(t.category)}</div>
            <h2>${esc(t.name)}</h2>
          </div>
          ${closeBtn}
        </div>
        <div class="plan-scroll">
          <div class="two-col" style="margin-bottom:12px">
            <div class="stat-box"><div class="k">WEAKNESS</div><div class="v green" style="font-size:10px">${esc(weaknessLabel(t))}</div></div>
            <div class="stat-box"><div class="k">INTEL</div><div class="v ${tstate(t.id).recon ? 'green' : 'amber'}" style="font-size:10px">${tstate(t.id).recon ? 'ACQUIRED +10%' : 'NONE'}</div></div>
          </div>

          <div class="plan-section">
            <div class="plan-section-title"><span class="label">01 · ENTRY TOOL</span><span class="hint">REQUIRED</span></div>
            <div class="choice-grid">${entryChoices || '<div class="empty">No entry tool owned. Buy one in the market.</div>'}</div>
          </div>

          <div class="plan-section">
            <div class="plan-section-title"><span class="label">02 · SUPPORT MODULE</span><span class="hint">OPTIONAL · STACKS</span></div>
            <div class="choice-grid">${noneSupport}${supportChoices}</div>
          </div>

          <div class="plan-section">
            <div class="plan-section-title"><span class="label">03 · PAYLOAD</span><span class="hint">OPTIONAL · LOUD</span></div>
            <div class="choice-grid">${nonePayload}${payloadChoices}</div>
            ${!payloads.length ? '<p class="plan-note" style="text-align:left;margin:7px 0 0">No payloads owned. <button class="link-btn" data-action="go-market" data-market="malware">VISIT THE MALWARE MARKET →</button></p>' : ''}
          </div>

          <div class="plan-section">
            <div class="plan-section-title"><span class="label">04 · COVER</span><span class="hint">HEAT REDUCTION</span></div>
            <div class="choice-grid">${coverChoices}</div>
          </div>
        </div>

        <div class="plan-footer">
          <div class="plan-summary">
            <div><div class="k">SUCCESS</div><div class="v ${stats.chance >= 75 ? 'green' : stats.chance >= 50 ? 'amber' : 'red'}">${stats.chance}%</div></div>
            <div><div class="k">HEAT</div><div class="v ${stats.heat >= 25 ? 'red' : stats.heat >= 12 ? 'amber' : 'green'}">+${stats.heat}</div></div>
            <div><div class="k">POWER</div><div class="v">${stats.energy}</div></div>
          </div>
          <p class="plan-note">${runNote}</p>
          <button class="btn btn-block" data-action="start-breach" ${!stats.canRun ? 'disabled' : ''}>${stats.canRun ? 'INITIATE BREACH →' : 'CANNOT RUN'}</button>
        </div>
      </div>
    </div>`);
  const newScroll = $('.plan-scroll');
  if (newScroll) newScroll.scrollTop = scrollTop;
}

function selectDraft(kind, id) {
  if (!draft) return;
  if (kind === 'entry') draft.entry = id;
  if (kind === 'support') draft.support = id === 'none' ? null : id;
  if (kind === 'payload') draft.payload = id === 'none' ? null : id;
  if (kind === 'cover') {
    const cover = COVER_MAP[id];
    if (!cover || !coverUnlocked(cover) || S.credits < cover.cost) return;
    draft.cover = id;
  }
  sfx('tick');
  renderPlan();
}
/* ------------------------------------------------------------------ */
/* BREACH ENGINE                                                      */
/* ------------------------------------------------------------------ */

function seedFrom(str) {
  let seed = 7;
  for (let i = 0; i < str.length; i += 1) seed = (seed * 31 + str.charCodeAt(i)) % 100000;
  return seed;
}

function netMap(seedStr) {
  const seed = seedFrom(seedStr);
  let state = seed || 1;
  const rnd = () => { state = (state * 9301 + 49297) % 233280; return state / 233280; };
  const points = [];
  for (let i = 0; i < 12; i += 1) {
    points.push({ x: 18 + rnd() * 284, y: 12 + rnd() * 68 });
  }
  points.sort((a, b) => a.x - b.x);
  const lines = points.map((p, i) => {
    if (i === 0) return '';
    const prev = points[i - 1];
    const hot = i >= points.length - 4 ? ' hot' : '';
    return `<line class="n-line${hot}" x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" />`;
  }).join('');
  const dots = points.map((p, i) => `<circle class="n-dot${i >= points.length - 4 ? ' hot' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i === points.length - 1 ? 3.2 : 1.8}" />`).join('');
  const last = points[points.length - 1];
  return `<svg class="netmap" viewBox="0 0 320 92" role="img" aria-label="Network trace visualization">
    <rect x="0" y="0" width="320" height="92" fill="transparent" />
    ${lines}${dots}
    <circle class="n-pulse" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="4" />
  </svg>`;
}

function setTrace(pct) {
  const fill = $('#trace-fill');
  const value = $('#trace-value');
  if (!fill || !value) return;
  const p = clamp(Math.round(pct), 0, 100);
  fill.style.width = `${p}%`;
  fill.classList.toggle('warn', p >= 58 && p < 80);
  fill.classList.toggle('danger', p >= 80);
  value.textContent = `${p}%`;
  value.style.color = p >= 80 ? 'var(--red)' : p >= 58 ? 'var(--amber)' : 'var(--green)';
}

function addLog(text, cls = '') {
  const log = $('#breach-log');
  if (!log) return;
  const line = document.createElement('div');
  line.className = `log-line ${cls}`;
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function breachHTML(run) {
  return `
    <div class="breach-root">
      <div class="breach-wrap">
        <div class="breach-top">
          <div>
            <div class="breach-kicker"><span class="pulse"></span> BREACH IN PROGRESS</div>
            <div class="breach-target">${esc(run.target.name)}</div>
          </div>
          <div class="breach-meta">${esc(run.entry.name)}${run.support ? ` + ${esc(run.support.name)}` : ''}<br>${esc(run.cover.name)}${run.payload ? ` · ${esc(run.payload.name)}` : ''}</div>
        </div>
        ${netMap(run.target.id)}
        <div class="trace-block">
          <div class="trace-top"><span>TRACE LEVEL</span><span id="trace-value">0%</span></div>
          <div class="trace-track"><div class="trace-fill" id="trace-fill"></div></div>
        </div>
        <div class="term">
          <div class="term-bar">
            <span class="lights"><i></i><i></i><i></i></span>
            <span>SESSION // ${esc(run.target.short)}</span>
            <span>ENCRYPTED</span>
          </div>
          <div class="term-log" id="breach-log" aria-live="polite"></div>
        </div>
        <div id="breach-action"></div>
      </div>
    </div>`;
}

const ENTRY_FLAVOR = {
  auth: ['credential table accepted', 'session token minted', 'lockout counter asleep'],
  web: ['endpoint accepted the request', 'staging token reused', 'database cursor opened'],
  network: ['route table accepted', 'management port answered', 'vlan boundary crossed'],
  human: ['cloned page served', 'target opened the message', 'badge photo matched'],
  industrial: ['testbed handshake accepted', 'telemetry feed mirrored', 'operator console answered'],
  recon: ['service map complete', 'exposed surface indexed', 'fingerprint matched']
};

function entryFlavor(run) {
  const tag = run.entry.tags.find((x) => ENTRY_FLAVOR[x]) || 'recon';
  return pick(ENTRY_FLAVOR[tag]);
}

function waitForChoice(run, prompt) {
  const box = $('#breach-action');
  if (!box) return Promise.resolve('bail');
  const canReroute = S.credits >= 40;
  box.innerHTML = `
    <div class="breach-choice" id="breach-choice">
      <div class="prompt"><span class="glyph">!</span><span>${esc(prompt)} <b>RESPONSE REQUIRED.</b></span></div>
      <div class="choice-actions">
        <button class="choice-btn push" data-action="breach-choice" data-choice="push">
          <span>PUSH THROUGH</span><b>+8% success · +8 heat</b>
        </button>
        <button class="choice-btn" data-action="breach-choice" data-choice="reroute" ${canReroute ? '' : 'disabled'}>
          <span>REROUTE</span><b>¤40 · −10 heat${canReroute ? '' : ' · NEED CREDITS'}</b>
        </button>
        <button class="choice-btn safe" data-action="breach-choice" data-choice="bail">
          <span>CUT THE LINE</span><b>No loot · minimal heat</b>
        </button>
      </div>
    </div>`;
  return new Promise((resolve) => {
    run.resolveChoice = resolve;
  });
}

async function animateBreach(run) {
  const t = run.target;
  addLog(`link established :: ${t.name} // ${t.category}`, 'sys');
  setTrace(7);
  await sleep(360);
  addLog(`cover ${run.cover.name} :: ${run.cover.desc}`, 'dim');
  setTrace(15);
  await sleep(420);
  addLog(`entry ${run.entry.name} :: ${run.entry.tags.map((x) => x.toUpperCase()).join(' / ')}`, 'dim');
  if (run.support) addLog(`support ${run.support.name} :: +${run.support.bonus} module bonus`, 'dim');
  setTrace(28);
  await sleep(460);
  addLog(entryFlavor(run), 'good');
  setTrace(38);
  await sleep(400);
  const complication = pick(COMPLICATIONS);
  addLog(complication, 'warn');
  setTrace(52);
  await sleep(520);
  const choice = await waitForChoice(run, complication);
  run.choice = choice;
  if (choice === 'reroute') {
    S.credits = Math.max(0, S.credits - 40);
    addLog('rerouting through secondary exit :: ¤40 burned', 'dim');
    setTrace(36);
    persist();
    sfx('tick');
  } else if (choice === 'push') {
    addLog('holding the session open :: signature risk accepted', 'warn');
    setTrace(74);
    sfx('tick');
  } else {
    addLog('cutting the line before authentication', 'dim');
    setTrace(30);
  }
  await sleep(460);
  const result = resolveRun(run);
  if (result.outcome === 'bail') {
    addLog('connection closed :: no archive extracted', 'dim');
    setTrace(28);
    await sleep(420);
  } else if (result.outcome === 'fail') {
    addLog('IDS signature match', 'bad');
    setTrace(92);
    await sleep(280);
    addLog('session severed by remote endpoint', 'bad');
    setTrace(100);
    await sleep(380);
  } else if (result.outcome === 'partial') {
    addLog('exfil interrupted by a checksum alert', 'warn');
    setTrace(88);
    await sleep(250);
    addLog('partial archive recovered', 'good');
    setTrace(82);
    await sleep(360);
  } else if (result.outcome === 'critical') {
    addLog('no signature match :: archive staged', 'good');
    setTrace(44);
    await sleep(260);
    addLog('exfil complete :: clean disconnect', 'good');
    setTrace(38);
    await sleep(360);
  } else {
    addLog('auth accepted :: archive staged', 'good');
    setTrace(56);
    await sleep(260);
    addLog('exfil complete :: disconnecting', 'good');
    setTrace(50);
    await sleep(360);
  }
  showResult(result);
}

function startBreach() {
  if (!draft) return;
  const stats = planStatsFor(draft.target, draft);
  if (!stats) return;
  if (S.energy < stats.energy) { toast('Not enough power. End the day first.', 'error', '!'); return; }
  if (S.credits < stats.coverCost) { toast('Not enough credits for this cover.', 'error', '!'); return; }
  if (!coverUnlocked(stats.cover)) { toast('Cover is locked. Install Ghost Relay first.', 'error', '!'); return; }
  const run = {
    target: stats.t,
    entry: stats.entry,
    support: stats.support,
    payload: stats.payload,
    cover: stats.cover,
    chance: stats.chance,
    heatBase: stats.heat,
    energy: stats.energy,
    coverCost: stats.coverCost,
    choice: null,
    applied: false,
    resolveChoice: null
  };
  S.energy -= stats.energy;
  S.credits -= stats.coverCost;
  pendingRaid = false;
  pendingEndgame = false;
  pendingNotices = [];
  lastRunOutcome = null;
  persist();
  clearOverlay();
  setOverlay(breachHTML(run));
  overlayLocked = true;
  runSession = run;
  sfx('start');
  animateBreach(run).catch((err) => {
    console.error(err);
    overlayLocked = false;
    clearOverlay();
    render();
    toast('Session error. The line dropped.', 'error', '!');
  });
}

function resolveRun(run) {
  if (run.applied) return run.appliedResult;
  run.applied = true;
  const t = run.target;
  const ts = tstate(t.id);
  const payload = run.payload;
  let chance = run.chance;
  if (run.choice === 'push') chance += 8;
  if (run.choice === 'reroute') chance -= 2;
  chance = clamp(Math.round(chance), 5, 96);
  const roll = Math.random() * 100;
  let outcome;
  if (run.choice === 'bail') outcome = 'bail';
  else if (roll < chance - 24) outcome = 'critical';
  else if (roll < chance) outcome = 'success';
  else if (roll < chance + 12) outcome = 'partial';
  else outcome = 'fail';

  const beforeRep = S.rep;
  const beforeDark = S.darknet;
  let heat;
  let repGain = 0;
  let darkGain = 0;
  let ransom = 0;
  let lootResult = { accepted: [], fenced: [], overflowCredits: 0 };

  if (outcome === 'bail') {
    heat = Math.max(1, Math.round(t.heat * 0.14));
    S.heat = clamp(S.heat + heat, 0, 100);
    S.stats.ops += 1;
    ts.attempts = (ts.attempts || 0) + 1;
    ts.lastResult = 'bail';
    persist();
    const result = {
      outcome, title: 'CLEAN EXIT', kicker: 'SESSION TERMINATED BY OPERATOR',
      sub: 'You cut the line before the target could see your face. No data, no reputation, almost no heat. There will be another door.',
      chance, roll, heat, repGain: 0, darkGain: 0, loot: [], fenced: [], overflowCredits: 0, ransom: 0,
      t, payload: null, note: 'TARGET REMAINS OPEN.'
    };
    run.appliedResult = result;
    return result;
  }

  heat = run.heatBase;
  if (run.choice === 'push') heat += 8;
  if (run.choice === 'reroute') heat -= 10;
  if (outcome === 'fail') heat += 9;
  if (outcome === 'partial') heat += 4;
  if (outcome === 'critical') heat = Math.round(heat * 0.8);
  heat = Math.max(1, Math.round(heat));

  const full = outcome === 'success' || outcome === 'critical';
  const anyData = full || outcome === 'partial';

  if (anyData) {
    const baseRep = t.rep + (payload ? payload.rep : 0);
    repGain = Math.round(baseRep * (outcome === 'critical' ? 1.2 : outcome === 'partial' ? 0.3 : 1));
    darkGain = outcome === 'critical' ? 3 : outcome === 'partial' ? 1 : 2;
    if (payload && payload.ransom && full) {
      ransom = Math.round(rand(payload.ransom[0], payload.ransom[1]));
    }
    const items = generateLoot(run, outcome);
    lootResult = addLoot(items);
  } else {
    repGain = -2;
  }

  if (full) {
    ts.done = true;
    ts.doneDay = S.day;
    ts.lastResult = outcome;
  } else if (outcome === 'fail' || outcome === 'partial') {
    ts.alertUntil = S.day + 2;
    ts.lastResult = outcome;
  }

  S.rep = Math.max(0, S.rep + repGain);
  S.darknet = clamp(S.darknet + darkGain, 0, 100);
  S.heat = clamp(S.heat + heat, 0, 100);
  S.stats.ops += 1;
  if (full) {
    S.stats.success += 1;
    if (outcome === 'critical') S.stats.clean += 1;
  } else {
    S.stats.fail += 1;
  }
  if (payload) {
    S.stats.viruses += 1;
    S.stats.chaos += payload.chaos || 0;
  }
  if (ransom) {
    S.credits += ransom;
    S.stats.ransom += ransom;
    S.stats.earned += ransom;
  }
  S.stats.earned += lootResult.overflowCredits;

  if (full) {
    pushNews('BREACH', outcome === 'critical'
      ? `Clean intrusion at ${t.short}. No signature, no statement, no suspects.`
      : t.newsWin);
  } else if (outcome === 'partial') {
    pushNews('BREACH', `Partial data theft at ${t.short}. Security calls it an "incomplete event".`);
  } else {
    pushNews('BREACH', t.newsFail);
  }
  if (payload && (payload.chaos || 0) >= 5 && anyData) {
    pushNews('DARK', `A destructive payload signature linked to ${payload.name} appears in the ${t.short} incident.`);
  }
  if (!S.flags.firstSuccess && full) {
    S.flags.firstSuccess = true;
    pushNews('WRAITH', 'Not bad. Fence the data before it spoils. Then we talk about better tools.');
  }
  if (!isDone(TARGET_MAP.aegis) && S.rep >= TARGET_MAP.aegis.reqRep && !S.flags.aegisOpen) {
    S.flags.aegisOpen = true;
    pushNews('WRAITH', 'AEGIS just opened. Everything you have done leads to that door. Buy quiet, cool the heat, then take it.');
  }
  announceProgress(beforeRep, beforeDark);
  persist();

  if (t.id === 'aegis' && full) pendingEndgame = true;
  if (S.heat >= 100) pendingRaid = true;

  const statusMap = {
    critical: {
      title: 'ACCESS GRANTED', kicker: 'CONTRACT COMPLETE // CLEAN RUN',
      sub: 'The archive came out clean and the target never saw the shape of you. This is the run people brag about in encrypted rooms.'
    },
    success: {
      title: 'ACCESS GRANTED', kicker: 'CONTRACT COMPLETE',
      sub: 'Data extracted. The target will notice eventually. By then, the trail should be cold and the data should be sold.'
    },
    partial: {
      title: 'PARTIAL EXFIL', kicker: 'CONTRACT STILL OPEN',
      sub: 'You got something before the alarm woke up. The target is alerted for two days; security will be harder on the next attempt.'
    },
    fail: {
      title: 'TRACE COMPLETE', kicker: 'SESSION SEVERED',
      sub: 'The endpoint killed your session and kept a copy of the signature. The target is alerted for two days. No data, no reputation, more heat.'
    }
  };
  const chosen = statusMap[outcome];
  const result = {
    outcome,
    title: chosen.title,
    kicker: chosen.kicker,
    sub: chosen.sub,
    chance,
    roll,
    heat,
    repGain,
    darkGain,
    loot: lootResult.accepted,
    fenced: lootResult.fenced,
    overflowCredits: lootResult.overflowCredits,
    ransom,
    t,
    payload,
    note: full ? 'TARGET ZEROED · THE CONTRACT IS CLOSED.' : 'TARGET REMAINS OPEN.'
  };
  run.appliedResult = result;
  return result;
}

function generateLoot(run, outcome) {
  const t = run.target;
  const payload = run.payload;
  let count = 1;
  if (outcome === 'critical') count = Math.random() < 0.45 ? 3 : 2;
  if (outcome === 'success' && Math.random() < 0.5) count = 2;
  if (outcome === 'partial') count = 1;
  count = clamp(count, 1, 3);
  const names = [...t.loot].sort(() => Math.random() - 0.5).slice(0, count);
  return names.map((name) => {
    let value = (rand(t.payout[0], t.payout[1]) / 2) * (payload ? payload.lootMult : 1) * rand(0.8, 1.2);
    if (outcome === 'critical') value *= 1.2;
    if (outcome === 'partial') value *= 0.55;
    value = Math.max(20, Math.round(value / 10) * 10);
    return {
      id: uid(),
      name,
      value,
      tag: t.lootTag,
      src: t.short,
      day: S.day,
      heat: Math.max(1, Math.round(t.heat / 6))
    };
  });
}

function addLoot(items) {
  const cap = invCap();
  const accepted = [];
  const fenced = [];
  items.forEach((item) => {
    if (S.inventory.length < cap) {
      S.inventory.push(item);
      accepted.push(item);
    } else {
      fenced.push(item);
    }
  });
  const overflowCredits = Math.round(fenced.reduce((sum, item) => sum + item.value * 0.55, 0));
  if (overflowCredits) S.credits += overflowCredits;
  return { accepted, fenced, overflowCredits };
}

function showResult(result) {
  lastRunOutcome = result.outcome;
  const cardClass = result.outcome === 'fail' ? 'fail' : result.outcome === 'partial' ? 'partial' : result.outcome === 'bail' ? '' : 'success';
  const titleClass = result.outcome === 'fail' ? 'red' : result.outcome === 'partial' ? 'amber' : result.outcome === 'bail' ? '' : 'green';
  const lootRows = result.loot.map((item) => `
    <div class="loot-row"><span class="n">${esc(item.name)} <span class="tag cyan">${esc(item.tag)}</span></span><span class="v">¤${fmt(item.value)}</span></div>
  `).join('');
  const fencedText = result.fenced.length
    ? `<div class="loot-row"><span class="n">${result.fenced.length} item(s) auto-fenced · cache full</span><span class="v">¤${fmt(result.overflowCredits)}</span></div>`
    : '';
  const ransomText = result.ransom
    ? `<div class="loot-row"><span class="n">RANSOM PAYOUT · ${esc(result.payload ? result.payload.name : 'PAYLOAD')}</span><span class="v">¤${fmt(result.ransom)}</span></div>`
    : '';
  const action = $('#breach-action');
  if (!action) return;
  action.innerHTML = `
    <div class="result-card ${cardClass}" id="run-result">
      <div class="result-kicker">${esc(result.kicker)}</div>
      <h2 class="result-title ${titleClass}">${esc(result.title)}</h2>
      <p class="result-sub">${esc(result.sub)}</p>
      ${lootRows || ransomText || fencedText ? `<div class="loot-list">${lootRows}${ransomText}${fencedText}</div>` : ''}
      <div class="result-gains">
        <div><div class="k">REP</div><div class="v ${result.repGain >= 0 ? 'green' : 'red'}">${result.repGain >= 0 ? '+' : ''}${result.repGain}</div></div>
        <div><div class="k">HEAT</div><div class="v red">+${result.heat}</div></div>
        <div><div class="k">DARKNET</div><div class="v ${result.darkGain ? 'green' : ''}">${result.darkGain >= 0 ? '+' : ''}${result.darkGain}</div></div>
      </div>
      <p class="plan-note" style="text-align:left">CHANCE ${result.chance}% · ROLL ${Math.round(result.roll)} · ${esc(result.note)}</p>
      <button class="btn btn-block" data-action="finish-run">${result.outcome === 'fail' ? 'GO DARK' : 'DUMP TO SAFEHOUSE'} →</button>
    </div>`;
  if (result.outcome === 'fail' || result.outcome === 'partial') sfx('fail');
  else if (result.outcome === 'bail') sfx('tick');
  else sfx('success');
  const el = $('#run-result');
  if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
}

function finishRun() {
  overlayLocked = false;
  clearOverlay();
  runSession = null;
  screen = 'ops';
  render();
  if (pendingEndgame) {
    pendingEndgame = false;
    openEndgame();
    return;
  }
  if (pendingRaid) {
    pendingRaid = false;
    openRaid();
    return;
  }
  flushNotices();
  if (lastRunOutcome === 'success' || lastRunOutcome === 'critical') {
    toast('CONTRACT CLOSED // fence the data in MARKET', 'good', '▤');
  } else if (lastRunOutcome === 'partial' || lastRunOutcome === 'fail') {
    toast('TARGET ALERTED // security is +1 for two days', 'warn', '!');
  }
}
/* ------------------------------------------------------------------ */
/* MARKET ACTIONS                                                     */
/* ------------------------------------------------------------------ */

function buyTool(id) {
  const tool = TOOL_MAP[id];
  if (!tool || S.ownedTools.includes(id)) return;
  if (S.rep < tool.reqRep) { toast(`Requires ${tool.reqRep} street reputation.`, 'error', '!'); return; }
  if (S.darknet < (tool.reqDark || 0)) { toast(`Requires ${tool.reqDark} darknet reputation.`, 'error', '!'); return; }
  if (S.credits < tool.cost) { toast(`Need ¤${fmt(tool.cost)}. You have ¤${fmt(S.credits)}.`, 'error', '!'); return; }
  S.credits -= tool.cost;
  S.ownedTools.push(id);
  S.stats.spent += tool.cost;
  pushNews('MARKET', `A new ${tool.name} module changes hands through a rotating dead drop.`);
  persist();
  render();
  sfx('cash');
  toast(`ACQUIRED // ${tool.name}`, 'good', '⌁');
}

function buyPayload(id) {
  const payload = PAYLOAD_MAP[id];
  if (!payload || S.ownedPayloads.includes(id)) return;
  if (S.rep < payload.reqRep) { toast(`Requires ${payload.reqRep} street reputation.`, 'error', '!'); return; }
  if (S.darknet < (payload.reqDark || 0)) { toast(`Requires ${payload.reqDark} darknet reputation.`, 'error', '!'); return; }
  if (S.credits < payload.cost) { toast(`Need ¤${fmt(payload.cost)}. You have ¤${fmt(S.credits)}.`, 'error', '!'); return; }
  S.credits -= payload.cost;
  S.ownedPayloads.push(id);
  S.stats.spent += payload.cost;
  pushNews('DARK', `A ${payload.name} payload build is listed, sold, and pulled within the hour.`);
  persist();
  render();
  sfx('cash');
  toast(`PAYLOAD ACQUIRED // ${payload.name}`, 'gold', '☣');
}

function buyUpgrade(id) {
  const up = UPGRADE_MAP[id];
  if (!up) return;
  const level = S.upgrades[id] || 0;
  if (level >= up.max) { toast('Already fully upgraded.', 'warn', '!'); return; }
  const cost = up.costs[level];
  if (S.credits < cost) { toast(`Need ¤${fmt(cost)}. You have ¤${fmt(S.credits)}.`, 'error', '!'); return; }
  S.credits -= cost;
  S.upgrades[id] = level + 1;
  S.stats.spent += cost;
  if (id === 'power') S.energy = Math.min(maxEnergy(), S.energy + 1);
  persist();
  render();
  sfx('cash');
  toast(`INSTALLED // ${up.name} LVL ${level + 1}`, 'good', '⌁');
}

function sellItem(id) {
  const idx = S.inventory.findIndex((item) => item.id === id);
  if (idx === -1) return;
  const item = S.inventory[idx];
  const value = saleValue(item);
  const beforeDark = S.darknet;
  S.inventory.splice(idx, 1);
  S.credits += value;
  S.stats.sold += 1;
  S.stats.earned += value;
  const gain = Math.max(1, Math.round(value / 650));
  S.darknet = clamp(S.darknet + gain, 0, 100);
  const heat = Math.max(1, Math.round(item.heat * 0.6)) + (['MED', 'GOV', 'BLACK'].includes(item.tag) ? 1 : 0);
  S.heat = clamp(S.heat + heat, 0, 100);
  pushNews('MARKET', `${item.name} from ${item.src} surfaces in a private auction and disappears again.`);
  announceProgress(S.rep, beforeDark);
  persist();
  render();
  sfx('cash');
  toast(`SOLD // ${item.name} · +¤${fmt(value)}`, 'gold', '¤');
  maybeRaid();
}

function sellAll() {
  if (!S.inventory.length) return;
  const items = [...S.inventory];
  const beforeDark = S.darknet;
  let total = 0;
  let heat = 0;
  items.forEach((item) => {
    total += saleValue(item);
    heat += Math.max(1, Math.round(item.heat * 0.6)) + (['MED', 'GOV', 'BLACK'].includes(item.tag) ? 1 : 0);
  });
  S.inventory = [];
  S.credits += total;
  S.stats.sold += items.length;
  S.stats.earned += total;
  S.darknet = clamp(S.darknet + Math.max(1, Math.round(total / 650)), 0, 100);
  S.heat = clamp(S.heat + Math.round(heat * 0.85), 0, 100);
  pushNews('MARKET', `${items.length} data package${items.length === 1 ? '' : 's'} cleared through the fence in one session.`);
  announceProgress(S.rep, beforeDark);
  persist();
  render();
  sfx('cash');
  toast(`FENCED ${items.length} ITEM${items.length === 1 ? '' : 'S'} // +¤${fmt(total)}`, 'gold', '¤');
  maybeRaid();
}

/* ------------------------------------------------------------------ */
/* DAY CYCLE                                                          */
/* ------------------------------------------------------------------ */

function endDay() {
  if (!S) return;
  const upkeep = 25;
  const paid = S.credits >= upkeep;
  if (paid) S.credits -= upkeep;
  else S.heat = clamp(S.heat + 3, 0, 100);
  const beforeHeat = S.heat;
  S.day += 1;
  S.energy = maxEnergy();
  S.heat = clamp(S.heat - 7, 0, 100);
  const cooled = Math.max(0, Math.round(beforeHeat - S.heat));
  const headline = pick(WORLD_NEWS);
  pushNews('WIRE', headline);
  const expiredAlerts = TARGETS.filter((t) => {
    const ts = tstate(t.id);
    return ts.alertUntil && ts.alertUntil < S.day && !isDone(t);
  }).length;
  persist();
  render();
  sfx('scan');
  openDay({ paid, upkeep, cooled, headline, expiredAlerts });
}

function openDay(day) {
  setOverlay(`
    <div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-label="End of day">
        <div class="sheet-grip"></div>
        <div class="eyebrow">NIGHTFALL // DAY ${pad2(S.day)}</div>
        <h2 style="margin:6px 0 5px">The trace cools.</h2>
        <p class="lede">You pull the blinds, kill the uplink, and let the city forget your address for a few hours.</p>
        <div class="two-col">
          <div class="stat-box"><div class="k">POWER RESTORED</div><div class="v green">${maxEnergy()}/${maxEnergy()}</div></div>
          <div class="stat-box"><div class="k">HEAT COOLED</div><div class="v green">−${day.cooled}</div></div>
          <div class="stat-box"><div class="k">UPKEEP</div><div class="v ${day.paid ? 'amber' : 'red'}">${day.paid ? `−¤${day.upkeep}` : 'UNPAID +3 HEAT'}</div></div>
          <div class="stat-box"><div class="k">ALERTS EXPIRED</div><div class="v">${day.expiredAlerts}</div></div>
        </div>
        <div class="panel" style="margin-top:11px">
          <div class="eyebrow">MORNING WIRE</div>
          <div class="intel-text">${esc(day.headline)}</div>
        </div>
        <p class="plan-note" style="text-align:left">${day.paid ? 'Rent and bandwidth settled. The safehouse remains off the grid.' : 'You could not cover rent. The landlord talks to people. Heat +3.'}</p>
        <button class="btn btn-block" data-action="finish-day">BACK TO WORK →</button>
      </div>
    </div>`);
}

/* ------------------------------------------------------------------ */
/* RAID                                                               */
/* ------------------------------------------------------------------ */

function maybeRaid() {
  if (!S || S.heat < 100) return;
  if (overlayLocked) { pendingRaid = true; return; }
  openRaid();
}

function raidPreview() {
  const paper = (S.upgrades.papers || 0) * 0.2;
  return {
    burnLoss: Math.round(S.credits * 0.35 * (1 - paper)),
    standLoss: Math.round(S.credits * 0.6 * (1 - paper)),
    items: S.inventory.length,
    third: S.stats.arrests + 1 >= 3
  };
}

function openRaid() {
  if (!S) return;
  sfx('alarm');
  if (navigator.vibrate) navigator.vibrate([120, 60, 120, 60, 220]);
  overlayLocked = true;
  const p = raidPreview();
  setOverlay(`
    <div class="raid-root">
      <div class="raid-card" role="dialog" aria-modal="true" aria-label="Raid">
        <div class="raid-stripe">!! PRIORITY TRAFFIC · FEDERAL WARRANT · SUBLEVEL 3 !!</div>
        <p class="eyebrow" style="color:var(--red)">CASE FILE // RAID ${S.stats.arrests + 1} OF 3</p>
        <h2 class="raid-title">THEY'RE AT<br>THE DOOR.</h2>
        <p class="raid-sub">Heat hit 100. The task force followed the trace to your block. You have seconds before the door comes off the hinges. There is no clean option, only a cheaper one.</p>
        <div class="raid-cost">
          <div class="n">BURN THE RIG</div>
          <div class="v">Lose ${p.items} data item${p.items === 1 ? '' : 's'} and ¤${fmt(p.burnLoss)}. Heat drops to 28. Skip 2 days. Reputation −10.</div>
        </div>
        <div class="raid-cost">
          <div class="n">STAND YOUR GROUND</div>
          <div class="v">Keep your data. Lose ¤${fmt(p.standLoss)}. Heat drops only to 55. Skip 3 days. Reputation −5. Darknet −5.</div>
        </div>
        ${p.third ? '<p class="plan-note" style="color:var(--red);text-align:left">THIS IS THE THIRD RAID. THERE IS NO FOURTH.</p>' : ''}
        <div class="raid-btns">
          <button class="raid-btn burn" data-action="raid-choice" data-choice="burn">
            <strong>BURN THE RIG →</strong>
            <span>Dump the drives, take the cash loss, walk out with a clean pair of hands.</span>
          </button>
          <button class="raid-btn stand" data-action="raid-choice" data-choice="stand">
            <strong>STAND YOUR GROUND →</strong>
            <span>Keep the data and lawyer up. The file stays open and the heat stays high.</span>
          </button>
        </div>
      </div>
    </div>`);
}

function resolveRaid(choice) {
  const p = raidPreview();
  let lostCredits = 0;
  let lostItems = 0;
  let text = '';
  if (choice === 'burn') {
    lostCredits = p.burnLoss;
    lostItems = S.inventory.length;
    S.credits = Math.max(0, S.credits - lostCredits);
    S.inventory = [];
    S.heat = 28;
    S.day += 2;
    S.energy = maxEnergy();
    S.rep = Math.max(0, S.rep - 10);
    text = `You dump the drives into the storm drain and walk out through the service tunnel. The task force finds an empty apartment, a warm chair, and nothing worth logging. You lost ${lostItems} data item${lostItems === 1 ? '' : 's'} and ¤${fmt(lostCredits)}, but the case goes cold.`;
  } else {
    lostCredits = p.standLoss;
    S.credits = Math.max(0, S.credits - lostCredits);
    S.heat = 55;
    S.day += 3;
    S.energy = maxEnergy();
    S.rep = Math.max(0, S.rep - 5);
    S.darknet = Math.max(0, S.darknet - 5);
    text = `Your lawyer arrives before the forensic team finishes imaging the drives. The data stays in play, but the file stays open and the heat follows you into the next room. You lost ¤${fmt(lostCredits)} and three days.`;
  }
  S.stats.arrests += 1;
  S.flags.firstArrest = true;
  pushNews('RAID', `Task force executes a warrant at a sublevel address. The occupant is not named. Case reference sealed.`);
  pushNews('WRAITH', 'You are still breathing. That is the only good news. Cool the heat before you touch another contract.');
  persist();
  sfx('alarm');
  if (S.stats.arrests >= 3) {
    openBadEnding();
    return;
  }
  setOverlay(`
    <div class="raid-root">
      <div class="raid-card" style="border-color:var(--line-2);box-shadow:none">
        <div class="eyebrow">CASE COLD // RAID ${S.stats.arrests}/3</div>
        <h2 class="raid-title" style="color:var(--amber);font-size:28px">YOU'RE STILL<br>HERE.</h2>
        <p class="raid-sub">${esc(text)}</p>
        <div class="result-gains" style="margin-top:0">
          <div><div class="k">HEAT</div><div class="v amber">${Math.round(S.heat)}%</div></div>
          <div><div class="k">CREDITS</div><div class="v green">¤${fmt(S.credits)}</div></div>
          <div><div class="k">RAIDS</div><div class="v red">${S.stats.arrests}/3</div></div>
        </div>
        <button class="btn btn-block" data-action="raid-continue">LAY LOW →</button>
      </div>
    </div>`);
}

function openBadEnding() {
  const score = runScore();
  const grade = scoreGrade(score);
  setOverlay(`
    <div class="ending-root">
      <div class="ending-card bad">
        <div class="ending-kicker">RUN TERMINATED // THREE RAIDS</div>
        <h2 class="ending-title">LIFER.</h2>
        <p class="ending-copy">Three doors, three warrants, one face on six cameras. The state has your rig, your handle, and a folder thick enough to keep you in a small room for a long time. The grid moves on without you.</p>
        <div class="ending-score"><span class="k">FINAL SCORE</span><span class="v">${fmt(score)}</span><span class="r">${grade}</span></div>
        <div class="end-stats">
          <div><div class="k">OPS</div><div class="v">${S.stats.ops}</div></div>
          <div><div class="k">ZEROED</div><div class="v">${S.stats.success}</div></div>
          <div><div class="k">CREDITS</div><div class="v">${fmt(S.credits)}</div></div>
          <div><div class="k">REP</div><div class="v">${fmt(S.rep)}</div></div>
          <div><div class="k">DARKNET</div><div class="v">${S.darknet}</div></div>
          <div><div class="k">CHAOS</div><div class="v">${S.stats.chaos}</div></div>
        </div>
        <button class="btn btn-block btn-danger" data-action="new-run">NEW IDENTITY →</button>
        <p class="disclaimer">THE SAVE IS WIPED WHEN YOU START AGAIN.</p>
      </div>
    </div>`);
}

/* ------------------------------------------------------------------ */
/* ENDGAME                                                            */
/* ------------------------------------------------------------------ */

function runScore() {
  const aegis = S.targets.aegis && S.targets.aegis.done ? 1 : 0;
  return Math.max(0, Math.round(
    S.credits * 0.8
    + S.rep * 14
    + S.darknet * 10
    + S.stats.success * 60
    + S.stats.clean * 40
    + S.stats.chaos * 5
    - S.stats.arrests * 350
    + aegis * 2500
  ));
}
function scoreGrade(score) {
  if (score >= 15000) return 'S';
  if (score >= 9000) return 'A';
  if (score >= 4000) return 'B';
  return 'C';
}

function openEndgame() {
  overlayLocked = true;
  const score = runScore();
  const grade = scoreGrade(score);
  setOverlay(`
    <div class="ending-root">
      <div class="ending-card">
        <div class="ending-kicker">AEGIS DEFENSE // ZEROED</div>
        <h2 class="ending-title">GHOST.</h2>
        <p class="ending-copy">The final door opens into a room with no cameras. Somewhere below the city, a defense contractor's black budget becomes a list of names, and every one of them belongs to someone who thought the wall was enough. You could sell it. You could burn it. You could disappear.</p>
        <div class="ending-score"><span class="k">FINAL SCORE</span><span class="v">${fmt(score)}</span><span class="r">${grade}</span></div>
        <div class="end-stats">
          <div><div class="k">OPS</div><div class="v">${S.stats.ops}</div></div>
          <div><div class="k">CLEAN</div><div class="v">${S.stats.clean}</div></div>
          <div><div class="k">CREDITS</div><div class="v">${fmt(S.credits)}</div></div>
          <div><div class="k">REP</div><div class="v">${fmt(S.rep)}</div></div>
          <div><div class="k">DARKNET</div><div class="v">${S.darknet}</div></div>
          <div><div class="k">RAIDS</div><div class="v">${S.stats.arrests}</div></div>
        </div>
        <div class="raid-btns">
          <button class="raid-btn burn" data-action="endgame-vanish">
            <strong>VANISH INTO THE NOISE →</strong>
            <span>End the run, wipe the save, and let the handle become a rumor.</span>
          </button>
          <button class="raid-btn" data-action="endgame-continue">
            <strong>KEEP THE MACHINE RUNNING →</strong>
            <span>Stay on the grid. There may be no contracts left, but the market is still open.</span>
          </button>
        </div>
      </div>
    </div>`);
  sfx('success');
}

function newRun() {
  S = null;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  window.location.reload();
}
/* ------------------------------------------------------------------ */
/* TOASTS                                                             */
/* ------------------------------------------------------------------ */

function toast(text, tone = '', glyph = '') {
  const wrap = $('#toasts');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.innerHTML = `${glyph ? `<span class="glyph">${esc(glyph)}</span>` : ''}<span>${esc(text)}</span>`;
  wrap.appendChild(el);
  while (wrap.children.length > 3) wrap.firstElementChild.remove();
  setTimeout(() => el.remove(), 3400);
}

/* ------------------------------------------------------------------ */
/* AUDIO                                                              */
/* ------------------------------------------------------------------ */

function ensureAudio() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freq, dur = 0.06, type = 'sine', vol = 0.03, delay = 0) {
  const ac = ensureAudio();
  if (!ac) return;
  try {
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  } catch { /* audio is optional */ }
}

function sfx(kind) {
  if (S && !S.sound) return;
  if (kind === 'click') tone(420, 0.028, 'square', 0.018);
  if (kind === 'tick') tone(760, 0.022, 'sine', 0.015);
  if (kind === 'tab') tone(520, 0.03, 'triangle', 0.02);
  if (kind === 'scan') { tone(320, 0.09, 'sine', 0.025); tone(660, 0.09, 'sine', 0.02, 0.08); }
  if (kind === 'start') { tone(220, 0.09, 'sawtooth', 0.025); tone(330, 0.09, 'sawtooth', 0.022, 0.08); tone(440, 0.12, 'sine', 0.025, 0.16); }
  if (kind === 'success') { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'sine', 0.028, i * 0.075)); }
  if (kind === 'fail') { [190, 140, 95].forEach((f, i) => tone(f, 0.14, 'sawtooth', 0.025, i * 0.09)); }
  if (kind === 'cash') { tone(880, 0.06, 'square', 0.02); tone(1174, 0.08, 'square', 0.02, 0.06); }
  if (kind === 'alarm') { [0, 0.22, 0.44].forEach((d) => { tone(240, 0.16, 'square', 0.03, d); tone(180, 0.16, 'square', 0.025, d + 0.08); }); }
}

/* ------------------------------------------------------------------ */
/* BACKGROUND CANVAS                                                  */
/* ------------------------------------------------------------------ */

function initCanvas() {
  const canvas = $('#bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glyphs = '01<>/\\[]{}#$%&*+=ABCDEF0123456789ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ';
  let width = 0;
  let height = 0;
  let dpr = 1;
  let columns = [];
  let last = 0;

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(12, Math.floor(width / 18));
    columns = Array.from({ length: count }, (_, i) => ({
      x: i * 18 + 4,
      y: Math.random() * height,
      speed: 0.35 + Math.random() * 1.15,
      alpha: 0.1 + Math.random() * 0.35,
      glyph: glyphs[Math.floor(Math.random() * glyphs.length)],
      tone: Math.random()
    }));
  }

  function drawStatic() {
    ctx.clearRect(0, 0, width, height);
    ctx.font = '12px monospace';
    columns.forEach((c) => {
      ctx.fillStyle = c.tone > 0.92 ? 'rgba(255,90,146,0.22)' : 'rgba(90,255,180,0.18)';
      ctx.fillText(c.glyph, c.x, c.y);
    });
  }

  function frame(ts) {
    if (document.hidden) { requestAnimationFrame(frame); return; }
    if (ts - last < 55) { requestAnimationFrame(frame); return; }
    last = ts;
    ctx.fillStyle = 'rgba(4,6,8,0.14)';
    ctx.fillRect(0, 0, width, height);
    ctx.font = '12px monospace';
    columns.forEach((c) => {
      if (Math.random() < 0.025) c.glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
      ctx.fillStyle = c.tone > 0.96
        ? `rgba(255,90,146,${c.alpha * 0.8})`
        : c.tone > 0.9
          ? `rgba(103,230,255,${c.alpha * 0.7})`
          : `rgba(90,255,180,${c.alpha})`;
      ctx.fillText(c.glyph, c.x, c.y);
      c.y += c.speed * 6;
      if (c.y > height + 20) {
        c.y = -20;
        c.x = Math.random() * width;
        c.speed = 0.35 + Math.random() * 1.15;
        c.alpha = 0.1 + Math.random() * 0.35;
        c.tone = Math.random();
      }
    });
    requestAnimationFrame(frame);
  }

  build();
  window.addEventListener('resize', () => { build(); if (reduced) drawStatic(); });
  if (reduced) drawStatic();
  else requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/* START / RESUME                                                     */
/* ------------------------------------------------------------------ */

function sanitizeHandle(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 14);
}

function showGame() {
  $('#start').classList.add('hidden');
  $('#game').classList.remove('hidden');
  window.scrollTo(0, 0);
}

function startGame(handle) {
  S = defaultState(handle);
  screen = 'ops';
  persist();
  showGame();
  render();
  sfx('start');
  toast(`IDENTITY MINTED // @${S.handle}`, 'good', '▚');
  if (!S.flags.tutorial) {
    setTimeout(() => openIntro(), 420);
  }
}

function resumeGame() {
  const loaded = loadSave();
  if (!loaded) { toast('No saved session found.', 'error', '!'); return; }
  S = loaded;
  savedState = null;
  screen = 'ops';
  showGame();
  render();
  sfx('start');
  toast(`SESSION RESTORED // DAY ${pad2(S.day)}`, 'good', '◈');
  if (!S.flags.tutorial) setTimeout(() => openIntro(), 380);
}

/* ------------------------------------------------------------------ */
/* EVENTS                                                             */
/* ------------------------------------------------------------------ */

function handleBreachChoice(choice) {
  if (!runSession || !runSession.resolveChoice) return;
  const resolve = runSession.resolveChoice;
  runSession.resolveChoice = null;
  $$('[data-action="breach-choice"]').forEach((btn) => { btn.disabled = true; });
  sfx('tick');
  resolve(choice);
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('.tab');
  if (tab && tab.dataset.tab) {
    sfx('tab');
    switchTab(tab.dataset.tab);
    return;
  }
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (!action) return;
  const quiet = new Set([
    'select-entry', 'select-support', 'select-payload', 'select-cover',
    'breach-choice', 'finish-run', 'start-breach', 'end-day', 'raid-choice'
  ]);
  if (!quiet.has(action)) sfx('click');

  switch (action) {
    case 'toggle-sound':
      if (!S) return;
      S.sound = !S.sound;
      persist();
      if (S.sound) sfx('tick');
      toast(S.sound ? 'SOUND ONLINE' : 'SOUND MUTED', '', S.sound ? '♪' : '×');
      break;
    case 'open-help': openHelp(); break;
    case 'close-overlay': closeOverlay(); break;
    case 'close-intro':
      if (S) {
        S.flags.tutorial = true;
        persist();
      }
      clearOverlay();
      break;
    case 'open-target': openTarget(el.dataset.id); break;
    case 'recon': doRecon(el.dataset.id); break;
    case 'plan': openPlan(el.dataset.id); break;
    case 'select-entry': selectDraft('entry', el.dataset.id); break;
    case 'select-support': selectDraft('support', el.dataset.id); break;
    case 'select-payload': selectDraft('payload', el.dataset.id); break;
    case 'select-cover': selectDraft('cover', el.dataset.id); break;
    case 'start-breach': startBreach(); break;
    case 'breach-choice': handleBreachChoice(el.dataset.choice); break;
    case 'finish-run': finishRun(); break;
    case 'arsenal-tab':
      arsenalTab = el.dataset.value === 'payloads' ? 'payloads' : 'tools';
      sfx('tick');
      render();
      break;
    case 'market-tab':
      marketTab = ['fence', 'hardware', 'malware'].includes(el.dataset.value) ? el.dataset.value : 'fence';
      sfx('tick');
      render();
      break;
    case 'go-market':
      marketTab = el.dataset.market === 'malware' ? 'malware' : 'hardware';
      screen = 'market';
      overlayLocked = false;
      clearOverlay();
      render();
      toast('MARKET OPEN // prices move with your darknet standing', '', '◈');
      break;
    case 'buy-tool': buyTool(el.dataset.id); break;
    case 'buy-payload': buyPayload(el.dataset.id); break;
    case 'buy-upgrade': buyUpgrade(el.dataset.id); break;
    case 'sell-item': sellItem(el.dataset.id); break;
    case 'sell-all': sellAll(); break;
    case 'end-day': endDay(); break;
    case 'finish-day':
      clearOverlay();
      render();
      break;
    case 'raid-choice': resolveRaid(el.dataset.choice); break;
    case 'raid-continue':
      overlayLocked = false;
      clearOverlay();
      screen = 'safehouse';
      render();
      toast('CASE COLD // lay low and let the heat drop', 'warn', '!');
      break;
    case 'endgame-continue':
      if (S) {
        S.flags.endingSeen = true;
        persist();
      }
      overlayLocked = false;
      clearOverlay();
      screen = 'ops';
      render();
      toast('THE MACHINE KEEPS RUNNING', 'gold', '◈');
      break;
    case 'endgame-vanish': newRun(); break;
    case 'reset-run': openResetConfirm(); break;
    case 'confirm-reset': newRun(); break;
    case 'new-run': newRun(); break;
    default: break;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !overlayLocked) {
    clearOverlay();
  }
});

/* ------------------------------------------------------------------ */
/* BOOT                                                               */
/* ------------------------------------------------------------------ */

function init() {
  initCanvas();
  savedState = loadSave();
  const input = $('#handle-input');
  input.value = savedState && savedState.handle ? savedState.handle : pick(HANDLES);
  if (savedState) {
    $('#continue-btn').classList.remove('hidden');
    const startBtn = $('#start-btn');
    startBtn.innerHTML = 'NEW RUN <span class="btn-arrow">→</span>';
  }

  $('#start-btn').addEventListener('click', () => {
    sfx('start');
    const handle = sanitizeHandle(input.value) || pick(HANDLES);
    startGame(handle);
  });
  $('#continue-btn').addEventListener('click', () => {
    sfx('start');
    resumeGame();
  });
  $('#start-help').addEventListener('click', () => {
    ensureAudio();
    sfx('click');
    openHelp();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      $('#start-btn').click();
    }
  });

  updateHud();
  window.addEventListener('beforeunload', () => { if (S) persist(); });

  // QA hook, only with ?dev=1. No effect on normal play.
  if (new URLSearchParams(window.location.search).has('dev')) {
    window.__RA = {
      getState: () => S,
      set: (patch) => { if (!S) return null; Object.assign(S, patch); persist(); render(); return S; },
      raid: () => openRaid(),
      endgame: () => openEndgame(),
      day: () => endDay(),
      target: (id) => openTarget(id),
      plan: (id) => openPlan(id)
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
