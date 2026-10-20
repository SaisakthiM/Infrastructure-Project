// FreshMart — 3D market hall wired to the grocery API and the city bank.
import City from '/city-core/city-core.js';
import {
  createStage, THREE, PALETTE, skyDome, floor, groundGrid, particles, glowMat, labelSprite, loadRobot, loadSkyline,
} from '/city-core/city-3d.js';

const API = '/grocery/api';
City.mountHud({ service: 'grocery', title: 'FreshMart Grocery', accent: '#72b66f' });

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ───────────── state ───────────── */
let products = [];
let category = 'all';
const cart = new Map(); // product id -> qty

/* ───────────── scene ───────────── */
const stage = createStage(document.body, {
  camera: { pos: [0, 3.8, 10.5], look: [0, 2.1, -4] },
  fog: { color: 0x07110c, density: 0.02 },
  parallax: 0.9,
});

const shelfGroup = new THREE.Group();
const slots = new Map(); // product id -> { group, p }
let shelfOffs = []; // unsubscribe handles for shelf click targets (crates/robot keep theirs)
const palletGroup = new THREE.Group();

if (stage.ok) buildStore();

function buildStore() {
  const { scene } = stage;
  skyDome(stage, 0x0b1a12, 0x050a07);
  floor(stage, { size: 70, color: 0x0c1511 });
  groundGrid(stage, { color: PALETTE.grocery, opacity: 0.16, size: 90, divisions: 90 });
  particles(stage, { count: 160, color: PALETTE.grocery, area: [40, 10, 30], size: 0.14, drift: 0.1 });

  const warm = new THREE.PointLight(0xffe2b0, 60, 40);
  warm.position.set(0, 7, 2);
  const green = new THREE.PointLight(PALETTE.grocery, 35, 30);
  green.position.set(-8, 4, -3);
  scene.add(warm, green);

  // back wall + sign
  const wall = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 0.4), new THREE.MeshStandardMaterial({ color: 0x101a15, roughness: 0.8 }));
  wall.position.set(0, 4, -7.5);
  scene.add(wall);
  const sign = labelSprite('FRESHMART', { size: 1.6, color: '#b9f0b4', bg: 'rgba(8,16,11,0.85)', font: '800 54px Syne, sans-serif' });
  sign.position.set(0, 7.1, -7.2);
  scene.add(sign);

  // three shelf levels
  const metal = new THREE.MeshStandardMaterial({ color: 0x1d2a23, roughness: 0.5, metalness: 0.6 });
  [0.35, 1.75, 3.15].forEach((y) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(17, 0.14, 1.9), metal);
    board.position.set(0, y, -5);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(17, 0.04, 0.05), glowMat(PALETTE.grocery, 2));
    strip.position.set(0, y + 0.1, -4.03);
    scene.add(board, strip);
  });
  [-8.4, 8.4].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.2, 0.18), metal);
    post.position.set(x, 2.1, -5);
    scene.add(post);
  });
  scene.add(shelfGroup, palletGroup);

  loadRobot(stage, { position: [-6.5, 0, 1.5], rotationY: 0.6, scale: 0.85, clip: 'Idle', tint: PALETTE.grocery }).then((r) => {
    if (!r) return;
    r.play('Wave', { once: true });
    stage.interactive(r.root, { label: 'Shopkeeper bot', onClick: () => r.play('ThumbsUp', { once: true }) });
  });
  loadSkyline(stage, { span: 170, z: -95, tint: 0.45 });
}

/* procedural produce so the shelves look stocked without any model downloads */
function makeItem(p) {
  const n = p.name.toLowerCase();
  const g = new THREE.Group();
  const mat = (c, r = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const sphere = (r, c, sy = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat(c));
    m.scale.y = sy;
    m.position.y = r * sy;
    return m;
  };
  if (/apple/.test(n)) g.add(sphere(0.32, 0xd62f2f));
  else if (/orange/.test(n)) g.add(sphere(0.32, 0xf08a1c, 0.95));
  else if (/tomato/.test(n)) g.add(sphere(0.3, 0xe03a2c, 0.85));
  else if (/avocado/.test(n)) g.add(sphere(0.3, 0x3d5a2a, 1.3));
  else if (/banana/.test(n)) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 6, 10), mat(0xf2d13a));
    m.rotation.z = Math.PI / 2.4;
    m.position.y = 0.2;
    g.add(m);
  } else if (/carrot/.test(n)) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 12), mat(0xf07a1a));
    m.rotation.z = Math.PI / 2;
    m.position.y = 0.16;
    g.add(m);
  } else if (/milk/.test(n)) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.34), mat(0xf4f7fb));
    b.position.y = 0.3;
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.36), mat(0x3b82f6));
    c.position.y = 0.45;
    g.add(b, c);
  } else if (/bread/.test(n)) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 6, 12), mat(0xc98a4b, 0.8));
    m.rotation.z = Math.PI / 2;
    m.position.y = 0.22;
    g.add(m);
  } else if (/croissant/.test(n)) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.1, 10, 18, Math.PI * 1.4), mat(0xd9a24f, 0.8));
    m.rotation.x = Math.PI / 2;
    m.position.y = 0.12;
    g.add(m);
  } else if (/cheese/.test(n)) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.26, 3), mat(0xf2c744));
    m.position.y = 0.13;
    g.add(m);
  } else if (/egg/.test(n)) {
    [-0.14, 0.14].forEach((x) => {
      const e = sphere(0.14, 0xf1e6d0, 1.25);
      e.position.x = x;
      g.add(e);
    });
  } else if (/drink|cola|soda/.test(n)) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 16), mat(0xc4252f, 0.35));
    b.position.y = 0.28;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), mat(0xdddddd, 0.3));
    c.position.y = 0.58;
    g.add(b, c);
  } else {
    // unknown product: a crate (new products added in the admin still appear)
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), mat(0x7a5a3a, 0.9));
    b.position.y = 0.2;
    g.add(b);
  }
  return g;
}

function slotPosition(i, total) {
  const perLevel = Math.ceil(total / 3);
  const level = Math.floor(i / perLevel);
  const col = i % perLevel;
  const x = (col - (perLevel - 1) / 2) * 3.7;
  return [x, 0.45 + level * 1.4, -5];
}

function renderShelves() {
  if (!stage.ok) return;
  shelfOffs.forEach((off) => off());
  shelfOffs = [];
  slots.forEach((s) => {
    shelfGroup.remove(s.group);
    s.group.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material?.map) o.material.map.dispose();
      o.material?.dispose?.();
    });
  });
  slots.clear();

  const list = products.filter((p) => category === 'all' || p.category === category);
  list.forEach((p, i) => {
    const group = new THREE.Group();
    const [x, y, z] = slotPosition(i, list.length);
    group.position.set(x, y, z);
    const shown = Math.min(p.stock, 9);
    for (let k = 0; k < shown; k += 1) {
      const item = makeItem(p);
      const col = k % 3;
      const row = Math.floor(k / 3);
      item.position.set((col - 1) * 0.62, 0, (row - 1) * 0.5);
      item.rotation.y = (k * 1.7) % 6.28;
      group.add(item);
    }
    const label = labelSprite(`${p.emoji} ${p.name} · ₹${p.price}${p.stock === 0 ? ' · SOLD OUT' : ''}`, {
      size: 0.5,
      color: p.stock === 0 ? '#f87171' : '#f1f5f9',
    });
    label.position.y = 1.1;
    group.add(label);
    // invisible hit box so clicking anywhere on the slot works
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.5;
    group.add(hit);
    shelfGroup.add(group);
    slots.set(p.id, { group, p });
    shelfOffs.push(stage.interactive(group, {
      label: () => `${p.name} — ₹${p.price} · ${p.stock} left (click to add)`,
      onClick: () => addToCart(p.id, 1),
    }));
  });
}

/* ───────────── catalogue + basket ───────────── */
async function loadProducts() {
  try {
    products = await fetch(`${API}/products/`).then((r) => {
      if (!r.ok) throw new Error('bad status');
      return r.json();
    });
    const units = products.reduce((n, p) => n + p.stock, 0);
    $('stock-note').textContent = `${units} items in stock`;
    // drop basket lines that are no longer available
    cart.forEach((qty, id) => {
      const p = products.find((x) => x.id === id);
      if (!p || p.stock === 0) cart.delete(id);
      else if (qty > p.stock) cart.set(id, p.stock);
    });
    renderCats();
    renderShelves();
    renderBasket();
  } catch {
    $('stock-note').textContent = 'store offline';
    City.toast('The store could not be reached.', 'bad');
  }
}

function renderCats() {
  const box = $('cats');
  box.replaceChildren();
  ['all', ...new Set(products.map((p) => p.category))].forEach((c) => {
    const b = el('button', 'btn sm' + (c === category ? ' primary' : ''), c);
    b.onclick = () => {
      category = c;
      renderCats();
      renderShelves();
    };
    box.append(b);
  });
}

function addToCart(id, delta) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  const next = (cart.get(id) || 0) + delta;
  if (next <= 0) cart.delete(id);
  else if (next > p.stock) return City.toast(`Only ${p.stock} × ${p.name} left.`, 'warn');
  else cart.set(id, Math.min(next, 20));
  renderBasket();
}

const cartTotal = () => [...cart].reduce((n, [id, q]) => n + (products.find((p) => p.id === id)?.price || 0) * q, 0);

function renderBasket() {
  const box = $('basket');
  box.replaceChildren();
  if (!cart.size) box.append(el('div', 'empty', 'Nothing yet.'));
  cart.forEach((qty, id) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const row = el('div', 'line');
    row.append(el('span', null, `${p.emoji} ${p.name}`));
    const q = el('span', 'qty');
    const minus = el('button', null, '−');
    const plus = el('button', null, '+');
    minus.onclick = () => addToCart(id, -1);
    plus.onclick = () => addToCart(id, 1);
    q.append(minus, el('span', null, String(qty)), plus);
    row.append(q, el('span', null, City.money(p.price * qty)));
    box.append(row);
  });
  const total = cartTotal();
  $('basket-total').textContent = City.money(total);
  $('basket-count').textContent = cart.size ? `${[...cart.values()].reduce((a, b) => a + b, 0)} items` : 'empty';
  $('checkout').disabled = total === 0;
}

$('checkout').onclick = async () => {
  const total = cartTotal();
  if (!total) return;
  const items = [...cart].map(([product, quantity]) => ({ product, quantity }));
  $('checkout').disabled = true;
  try {
    const paid = await City.spend('grocery', total, `Groceries (${items.length} lines)`);
    if (!paid.ok) return City.toast(paid.message || 'Payment failed.', 'bad');
    try {
      await City.api(`${API}/checkout/`, { method: 'POST', body: { items, expected_total: total } });
      cart.clear();
      City.toast(`Order placed — ${City.money(total)} paid.`, 'ok');
    } catch (e) {
      await City.earn('grocery', total, 'Refund: order was not accepted');
      City.toast(`${e.message} You were refunded.`, 'bad');
    }
    await loadProducts();
    if (!$('tab-orders').classList.contains('hidden')) loadOrders();
  } finally {
    renderBasket();
  }
};

/* ───────────── tabs ───────────── */
document.querySelectorAll('[data-tab]').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    ['shop', 'work', 'orders'].forEach((t) => $('tab-' + t).classList.toggle('hidden', t !== b.dataset.tab));
    if (b.dataset.tab === 'orders') loadOrders();
  };
});

async function loadOrders() {
  const box = $('orders');
  if (!City.snapshot().loggedIn) {
    box.textContent = 'Log in to see your orders.';
    return;
  }
  try {
    const orders = await City.api(`${API}/orders/`);
    box.replaceChildren();
    if (!orders.length) return void (box.textContent = 'No orders yet.');
    orders.forEach((o) => {
      const d = el('div', 'order');
      d.append(el('strong', null, `${City.money(o.total)} · ${new Date(o.created_at).toLocaleString()}`));
      d.append(el('div', 'muted', o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')));
      box.append(d);
    });
  } catch (e) {
    box.textContent = e.status === 401 ? 'Could not verify your account with the bank.' : e.message;
  }
}

/* ───────────── shift: carry crates to the shelves ───────────── */
let shift = null;
const SHELF_TARGET = new THREE.Vector3(0, 1.8, -5);

$('work-start').onclick = async () => {
  if (!City.snapshot().loggedIn) return City.openLogin();
  try {
    const s = await City.api(`${API}/shift/start/`, { method: 'POST' });
    shift = { ...s, count: 0, t0: performance.now(), crates: [], over: false };
    $('work-rules').textContent = '';
    $('work-max').textContent = s.max_items;
    $('work-count').textContent = '0';
    $('work-idle').classList.add('hidden');
    $('work-live').classList.remove('hidden');
    spawnCrates(s.max_items);
    tickShift();
  } catch (e) {
    City.toast(e.message, e.status === 429 ? 'warn' : 'bad');
  }
};
$('work-end').onclick = () => endShift();

function spawnCrates(n) {
  if (!stage.ok) {
    // no WebGL: a click counter keeps the job playable
    $('work-end').textContent = 'Stock a crate (+1)';
    $('work-end').onclick = () => carried({ fake: true });
    return;
  }
  for (let i = 0; i < n; i += 1) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), glowMat(0x72b66f, 1.4, { roughness: 0.6 }));
    const a = (i / n) * Math.PI * 2;
    crate.position.set(Math.cos(a) * 4.5, 0.25, 2.5 + Math.sin(a) * 1.8);
    palletGroup.add(crate);
    shift.crates.push(crate);
    stage.interactive(crate, { label: 'Carry to the shelf', onClick: () => carried(crate) });
  }
}

function carried(crate) {
  if (!shift || shift.over) return;
  shift.count += 1;
  $('work-count').textContent = String(shift.count);
  if (!crate.fake) {
    const from = crate.position.clone();
    const t0 = performance.now();
    const off = stage.onFrame(() => {
      const k = Math.min(1, (performance.now() - t0) / 500);
      crate.position.lerpVectors(from, SHELF_TARGET, k);
      crate.position.y += Math.sin(k * Math.PI) * 1.4;
      crate.scale.setScalar(1 - k * 0.7);
      if (k >= 1) {
        off();
        palletGroup.remove(crate);
      }
    });
  }
  if (shift.count >= shift.max_items) endShift();
}

function tickShift() {
  if (!shift || shift.over) return;
  const left = Math.max(0, shift.seconds - (performance.now() - shift.t0) / 1000);
  $('work-left').textContent = String(Math.ceil(left));
  $('work-bar').style.transform = `scaleX(${left / shift.seconds})`;
  if (left <= 0) return endShift();
  requestAnimationFrame(tickShift);
}

async function endShift() {
  if (!shift || shift.over) return;
  shift.over = true;
  const s = shift;
  // the server refuses suspiciously fast shifts, so never report earlier than its minimum
  const wait = Math.max(0, 9000 - (performance.now() - s.t0));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  s.crates.forEach((c) => palletGroup.remove(c));
  try {
    const res = await City.api(`${API}/shift/finish/`, { method: 'POST', body: { token: s.token, stocked: s.count } });
    if (res.wage > 0) {
      const paid = await City.earn('grocery', res.wage, `Shelf-stocking shift (${res.stocked} crates)`);
      City.toast(paid.ok ? `Shift over — you earned ${City.money(res.wage)}.` : paid.message, paid.ok ? 'ok' : 'warn');
    } else City.toast('Shift over — no pay this time.', 'warn');
    await loadProducts();
  } catch (e) {
    City.toast(e.message, 'bad');
  } finally {
    shift = null;
    $('work-live').classList.add('hidden');
    $('work-idle').classList.remove('hidden');
    $('work-end').textContent = 'Clock out now';
    $('work-end').onclick = () => endShift();
  }
}

/* ───────────── boot ───────────── */
$('work-rules').textContent = 'Each crate pays ₹8, a full shift pays a bonus, and the crates really land on the emptiest shelves.';
loadProducts();
setInterval(loadProducts, 30000);
City.ready.then(loadOrders);
