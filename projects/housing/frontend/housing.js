// Housing district — a 3D neighbourhood. Everything with money in it goes through the city bank.
import City from '/city-core/city-core.js';
import {
  createStage, THREE, PALETTE, skyDome, floor, groundGrid, particles, glowMat, glassMat, tower, streetLight,
  labelSprite, loadRobot, loadSkyline,
} from '/city-core/city-3d.js';

const API = '/housing/api';
City.mountHud({ service: 'housing', title: 'Housing District', accent: '#d9a066' });

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let catalog = null;
let grid = { width: 6, height: 4, plots: [] };
let me = null;
let selectedId = null;
const SPACING = 4.6;

/* ───────────── 3D ───────────── */
const stage = createStage(document.body, {
  camera: { pos: [0, 15, 19], look: [0, 0, 0] },
  fog: { color: 0x0a0807, density: 0.011 },
  exposure: 1.1,
});
const plotNodes = new Map(); // id -> { group, pad, ring, house, label }
const offs = [];

if (stage.ok) {
  skyDome(stage, 0x1a120d, 0x080605);
  floor(stage, { size: 90, color: 0x0e0b09 });
  groundGrid(stage, { color: PALETTE.housing, opacity: 0.12, size: 120, divisions: 120 });
  particles(stage, { count: 160, color: 0xffd9a8, area: [60, 14, 50], size: 0.13, drift: 0.1 });
  stage.orbit({ target: [0, 0.5, 0], min: 10, max: 42, maxPolar: Math.PI * 0.47, autoRotate: true, speed: 0.25 });

  const warm = new THREE.PointLight(0xffc891, 70, 50);
  warm.position.set(0, 12, 6);
  stage.scene.add(warm);

  loadRobot(stage, { position: [-16, 0, 9], rotationY: 0.9, scale: 1.1, clip: 'Idle', tint: PALETTE.housing }).then((r) => {
    if (!r) return;
    r.play('Wave', { once: true });
    stage.interactive(r.root, { label: 'Estate agent bot', onClick: () => r.play('ThumbsUp', { once: true }) });
  });
  loadSkyline(stage, { span: 190, z: -80, tint: 0.45 });
}

const posOf = (p) => [(p.x - (grid.width - 1) / 2) * SPACING, (p.y - (grid.height - 1) / 2) * SPACING];

function buildHouse(tier) {
  const g = new THREE.Group();
  const wall = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
  switch (tier) {
    case 'checkpoint': {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.4, 4), wall(0xc2763a));
      tent.rotation.y = Math.PI / 4;
      tent.position.y = 0.7;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), glowMat(0xffd27a, 4));
      lamp.position.set(1.1, 0.6, 1.1);
      g.add(tent, lamp);
      break;
    }
    case 'cottage': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 1.8), wall(0xd9c3a0));
      body.position.y = 0.6;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1, 4), wall(0x8a3b2e));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 1.7;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.05), glowMat(0xffb55a, 1.8));
      door.position.set(0, 0.35, 0.92);
      g.add(body, roof, door);
      break;
    }
    case 'apartment': {
      g.add(tower({ w: 2.2, h: 3.8, d: 2.2, color: 0x8ab4e0, seed: 3, glow: 0.9 }));
      break;
    }
    case 'villa': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 1.8), wall(0xe8e2d6));
      base.position.set(0, 0.55, -0.2);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.4), wall(0xd6cfc1));
      top.position.set(0.4, 1.55, -0.2);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 0.05), glassMat(0x3a8fb7, 0.7));
      glass.position.set(0.4, 1.55, 0.52);
      const pool = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.8), glowMat(0x2ec4ff, 1.4));
      pool.position.set(-0.4, 0.05, 1.2);
      g.add(base, top, glass, pool);
      break;
    }
    case 'tower': {
      g.add(tower({ w: 1.8, h: 8, d: 1.8, color: 0x00f0c8, seed: 7, glow: 1.1 }));
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.4, 6), glowMat(0xff3b5c, 2));
      mast.position.y = 8.9;
      g.add(mast);
      break;
    }
    default:
  }
  return g;
}

function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((m) => {
      Object.values(m).forEach((v) => v && v.isTexture && v.dispose());
      m.dispose();
    });
  });
}

function ownerColor(p) {
  if (!p.owner) return 0x3ddc84;
  return me && p.owner === me.user ? 0xf5c542 : 0x8892a6;
}

function renderMap() {
  if (!stage.ok) return;
  offs.splice(0).forEach((off) => off());
  plotNodes.forEach((n) => {
    stage.scene.remove(n.group);
    disposeTree(n.group);
  });
  plotNodes.clear();

  grid.plots.forEach((p) => {
    const [x, z] = posOf(p);
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.16, 3.9), new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.9 }));
    pad.position.y = 0.08;
    const col = ownerColor(p);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.04, 8, 4), glowMat(col, p.owner ? 1.2 : 2));
    ring.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    ring.position.y = 0.2;
    group.add(pad, ring);

    if (p.tier) {
      const house = buildHouse(p.tier);
      house.position.y = 0.16;
      group.add(house);
    }
    const text = p.owner ? p.owner : 'FOR SALE';
    const label = labelSprite(text, { size: 0.55, color: p.owner ? '#f1f5f9' : '#7dffb0' });
    label.position.y = p.tier === 'tower' ? 10.2 : p.tier === 'apartment' ? 5.2 : p.tier === 'villa' ? 3.2 : p.tier ? 3 : 1.4;
    group.add(label);

    stage.scene.add(group);
    plotNodes.set(p.id, { group, ring, p });
    offs.push(
      stage.interactive(group, {
        label: () => (p.owner ? `Plot ${p.id} · ${p.owner}'s ${p.tier}` : `Plot ${p.id} · for sale`),
        onClick: () => select(p.id),
      }),
    );
  });
  highlight();
}

function highlight() {
  plotNodes.forEach((n, id) => {
    n.ring.scale.setScalar(id === selectedId ? 1.12 : 1);
    n.ring.material.emissiveIntensity = id === selectedId ? 4 : n.p.owner ? 1.2 : 2;
  });
}

/* ───────────── data ───────────── */
async function loadAll() {
  try {
    const [cat, g, stats] = await Promise.all([
      catalog ? Promise.resolve(catalog) : fetch(`${API}/catalog/`).then((r) => r.json()),
      fetch(`${API}/plots/`).then((r) => r.json()),
      fetch(`${API}/stats/`).then((r) => r.json()),
    ]);
    catalog = cat;
    grid = g;
    $('stats-line').textContent = `${stats.occupied}/${stats.plots} homes · ${stats.residents} residents`;
  } catch {
    $('stats-line').textContent = 'housing office offline';
    return;
  }
  await loadMe();
  renderMap();
  renderLeft();
  renderPlot();
}

async function loadMe() {
  if (!City.snapshot().loggedIn) {
    me = null;
    return;
  }
  try {
    me = await City.api(`${API}/me/`);
  } catch {
    me = null;
  }
}

function select(id) {
  selectedId = id;
  highlight();
  renderPlot();
}

/* ───────────── panels ───────────── */
const tierById = (id) => catalog?.tiers.find((t) => t.id === id);

function renderLeft() {
  $('claimable').textContent = City.money(me?.claimable ?? 0);
  $('rent-note').textContent = me ? me.user : 'log in';
  $('collect').disabled = !me || me.claimable < 1;
  $('homes-count').textContent = me ? `${me.properties.length}` : '';
  const box = $('homes');
  box.replaceChildren();
  if (!me) return void box.append(el('div', 'empty', 'Log in to see your homes.'));
  if (!me.properties.length) {
    return void box.append(el('div', 'empty', 'You have no home yet. Pick a free plot — your first shelter is free.'));
  }
  me.properties.forEach((p) => {
    const row = el('div', 'prop');
    const left = el('div');
    left.append(el('strong', null, `${tierById(p.tier)?.label ?? p.tier}`), el('div', 'muted', `Plot ${p.id} · ${City.money(p.accrued)} rent waiting`));
    row.append(left, el('span', 'pill', `#${p.id}`));
    row.onclick = () => select(p.id);
    box.append(row);
  });
}

function renderPlot() {
  const body = $('plot-body');
  body.replaceChildren();
  const p = grid.plots.find((x) => x.id === selectedId);
  if (!p || !catalog) {
    $('plot-title').textContent = 'click a plot';
    return void body.append(el('div', 'empty', 'Select a plot on the map to see what you can do with it.'));
  }
  $('plot-title').textContent = `#${p.id}`;
  const loggedIn = City.snapshot().loggedIn;

  if (!p.owner) {
    body.append(el('p', 'muted', 'This plot is free. Build something:'));
    if (loggedIn && me && !me.hasCheckpoint) {
      const row = el('div', 'tier');
      row.append(el('div', null, 'Checkpoint shelter — free starter home'));
      const b = el('button', 'btn sm primary', 'Claim free');
      b.onclick = () => act(() => claimCheckpoint(p.id));
      row.append(b);
      body.append(row);
    }
    catalog.tiers.filter((t) => t.id !== 'checkpoint').forEach((t) => {
      const row = el('div', 'tier');
      const info = el('div');
      info.append(el('strong', null, t.label), el('small', null, `${City.money(t.price)} · earns ${City.money(t.rent_per_hour)}/h`));
      const b = el('button', 'btn sm', 'Buy');
      b.onclick = () => (loggedIn ? act(() => buy(p.id, t)) : City.openLogin());
      row.append(info, b);
      body.append(row);
    });
    return;
  }

  const mine = me && p.owner === me.user;
  const t = tierById(p.tier);
  body.append(el('strong', null, `${t?.label ?? p.tier}`), el('p', 'muted', mine ? 'This is your property.' : `Owned by ${p.owner}.`));
  if (!mine) return;

  const prop = me.properties.find((x) => x.id === p.id);
  body.append(el('p', null, `Rent waiting: ${City.money(prop?.accrued ?? 0)} · earns ${City.money(t.rent_per_hour)}/h`));

  const better = catalog.tiers.filter((x) => x.id !== 'checkpoint' && x.price > t.price);
  if (better.length) body.append(el('div', 'eyebrow', 'Upgrade'));
  better.forEach((x) => {
    const row = el('div', 'tier');
    const info = el('div');
    info.append(el('strong', null, x.label), el('small', null, `+${City.money(x.price - t.price)} · earns ${City.money(x.rent_per_hour)}/h`));
    const b = el('button', 'btn sm', 'Upgrade');
    b.onclick = () => act(() => upgrade(p.id, t, x));
    row.append(info, b);
    body.append(row);
  });
  if (p.tier !== 'checkpoint') {
    const s = el('button', 'btn danger block', `Sell back for ${City.money(Math.floor((t.price * catalog.sellBackPercent) / 100) + (prop?.accrued ?? 0))}`);
    s.style.marginTop = '12px';
    s.onclick = () => act(() => sell(p.id));
    body.append(s);
  }
}

/* ───────────── actions: money moves through the bank, ownership through the housing API ───────────── */
async function act(fn) {
  document.querySelectorAll('#plot-body button, #collect').forEach((b) => (b.disabled = true));
  try {
    await fn();
  } finally {
    await loadAll();
  }
}

async function claimCheckpoint(id) {
  try {
    await City.api(`${API}/plots/${id}/checkpoint/`, { method: 'POST' });
    City.toast('Welcome home — your checkpoint shelter is ready.', 'ok');
  } catch (e) {
    City.toast(e.message, 'bad');
  }
}

async function buy(id, tier) {
  const paid = await City.spend('housing', tier.price, `Bought a ${tier.label} (plot ${id})`);
  if (!paid.ok) return City.toast(paid.message || 'Payment failed.', 'bad');
  try {
    await City.api(`${API}/plots/${id}/buy/`, { method: 'POST', body: { tier: tier.id, price: tier.price } });
    City.toast(`${tier.label} built on plot ${id}.`, 'ok');
  } catch (e) {
    await City.earn('housing', tier.price, 'Refund: purchase was not accepted');
    City.toast(`${e.message} You were refunded.`, 'bad');
  }
}

async function upgrade(id, from, to) {
  const cost = to.price - from.price;
  const paid = await City.spend('housing', cost, `Upgrade to ${to.label} (plot ${id})`);
  if (!paid.ok) return City.toast(paid.message || 'Payment failed.', 'bad');
  try {
    await City.api(`${API}/plots/${id}/upgrade/`, { method: 'POST', body: { tier: to.id, cost } });
    City.toast(`Upgraded to ${to.label}.`, 'ok');
  } catch (e) {
    await City.earn('housing', cost, 'Refund: upgrade was not accepted');
    City.toast(`${e.message} You were refunded.`, 'bad');
  }
}

async function sell(id) {
  if (!window.confirm('Sell this property back to the city?')) return;
  try {
    const res = await City.api(`${API}/plots/${id}/sell/`, { method: 'POST' });
    const paid = await City.earn('housing', res.refund, `Sold plot ${id} back to the city`);
    City.toast(paid.ok ? `Sold for ${City.money(res.refund)}.` : paid.message, paid.ok ? 'ok' : 'warn');
  } catch (e) {
    City.toast(e.message, 'bad');
  }
}

$('collect').onclick = () =>
  act(async () => {
    try {
      const { amount } = await City.api(`${API}/collect/`, { method: 'POST' });
      if (!amount) return City.toast('No rent to collect yet.', 'info');
      const paid = await City.earn('housing', amount, 'Rent collected');
      City.toast(paid.ok ? `${City.money(amount)} rent collected.` : paid.message, paid.ok ? 'ok' : 'warn');
    } catch (e) {
      City.toast(e.message, 'bad');
    }
  });

/* ───────────── boot ───────────── */
let lastUser;
City.on((s) => {
  // only a login/logout needs a redraw; balance changes do not
  if (s.username === lastUser) return;
  lastUser = s.username;
  if (!grid.plots.length) return;
  loadMe().then(() => {
    renderMap();
    renderLeft();
    renderPlot();
  });
});
loadAll();
setInterval(loadAll, 20000);
