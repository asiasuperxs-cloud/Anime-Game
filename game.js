/* ============================================================
 *  game.js — เอนจินเกมต่อสู้ 3D (Three.js)
 *  ปกติไม่ต้องแก้ไฟล์นี้ เวลาเพิ่มตัวละครให้แก้ characters.js
 * ============================================================ */
(function () {
  'use strict';

  const DT = 1 / 60, GRAVITY = 26, ARENA = 9, ROUND_TIME = 99;
  const $ = id => document.getElementById(id);

  // ---------------- CheckBot ในเบราว์เซอร์ ----------------
  function renderChecker(issues) {
    const box = $('checker');
    const errs = issues.filter(i => i.level === 'error').length;
    const warns = issues.length - errs;
    box.className = errs ? 'bad' : warns ? 'warn' : 'good';
    const head = errs
      ? `CheckBot: พบ ${errs} error, ${warns} คำเตือน — ตัวละครที่มี error จะไม่ถูกโหลด`
      : warns ? `CheckBot: ผ่าน แต่มี ${warns} คำเตือน` : 'CheckBot: ตัวละครทุกตัวผ่าน ✓';
    box.innerHTML = `<button id="ckToggle">${head}</button><ul>` + issues.map(i =>
      `<li class="${i.level}"><b>${i.level === 'error' ? 'ERROR' : 'WARN'}</b> ${esc(i.where)}: ${esc(i.msg)}` +
      (i.fix ? `<div class="fix">วิธีแก้: ${esc(i.fix)}</div>` : '') + '</li>').join('') + '</ul>';
    $('ckToggle').onclick = () => box.classList.toggle('open');
    if (errs) box.classList.add('open');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  if (window.__charErr || !Array.isArray(window.CHARACTERS)) {
    const e = window.__charErr;
    renderChecker([{
      level: 'error', where: 'characters.js',
      msg: e ? `อ่านไฟล์ไม่ได้ (บรรทัด ${e.line}): ${e.msg}` : 'ไม่พบ window.CHARACTERS',
      fix: 'มักเกิดจากลืม comma, วงเล็บ { } [ ] ไม่ครบ หรือเครื่องหมายคำพูดไม่ปิด — รัน  node check-bot.js  เพื่อดูตำแหน่ง'
    }]);
    $('startBtn').disabled = true;
    return;
  }
  const report = CheckBot.validate(window.CHARACTERS);
  renderChecker(report.issues);
  const ROSTER = report.validIndexes.map(i => window.CHARACTERS[i]);

  // ---------------- Scene ----------------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12141c);
  scene.fog = new THREE.Fog(0x12141c, 16, 40);
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 3.2, 11);

  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2030, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(4, 10, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 8, bottom: -4 });
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(13, 64), new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(9.6, 10, 64), new THREE.MeshBasicMaterial({ color: 0xff3c6e }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, h = 3 + (i % 3);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, h, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a3f55 }));
    p.position.set(Math.cos(a) * 15, h / 2, Math.sin(a) * 15 - 4); p.castShadow = true; scene.add(p);
  }

  // ---------------- Fighter ----------------
  const lerp = (a, b, t) => a + (b - a) * t;
  function std(c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }); }
  function part(geo, m, x, y, z, parent) {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  function pivot(x, y, z, parent) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

  class Fighter {
    constructor(def, side) {
      this.def = def; this.side = side;
      this.maxHp = def.stats.hp; this.hp = this.maxHp;
      this.x = side === 0 ? -3 : 3; this.y = 0; this.vx = 0; this.vy = 0;
      this.facing = side === 0 ? 1 : -1;
      this.move = null; this.moveFrame = 0; this.hitDone = false;
      this.hitstun = 0; this.knock = 0; this.blocking = false; this.flash = 0;
      this.held = { L: false, R: false, U: false, D: false };
      this.buffer = [];
      this.moveList = Object.keys(def.moves).map(name => {
        const m = def.moves[name];
        const seq = m.input.trim().split(/\s+/);
        const anim = m.anim || { P: 'punch', K: 'kick', S: 'special' }[seq[seq.length - 1]];
        return { name, m, seq, anim };
      }).sort((a, b) => b.seq.length - a.seq.length);

      const c = new THREE.Color(def.color);
      this.bodyMat = std(c); const limb = std(c.clone().multiplyScalar(0.55)); const skin = std(0xf1c9a5);
      const big = def.stats.hp >= 120 ? 1.15 : 1;
      this.g = new THREE.Group(); this.rig = new THREE.Group(); this.g.add(this.rig);
      this.rig.scale.setScalar(big);
      part(new THREE.BoxGeometry(0.75, 0.95, 0.5), this.bodyMat, 0, 1.38, 0, this.rig);
      part(new THREE.SphereGeometry(0.28, 20, 16), skin, 0.02, 2.1, 0, this.rig);
      part(new THREE.BoxGeometry(0.62, 0.12, 0.08), limb, 0.1, 2.18, 0, this.rig).rotation.y = Math.PI / 2;
      const arm = new THREE.BoxGeometry(0.2, 0.78, 0.2), leg = new THREE.BoxGeometry(0.26, 0.86, 0.26);
      this.armF = pivot(0.05, 1.78, 0.5, this.rig); part(arm, limb, 0, -0.38, 0, this.armF); part(new THREE.SphereGeometry(0.15, 12, 10), skin, 0, -0.8, 0, this.armF);
      this.armB = pivot(0.05, 1.78, -0.5, this.rig); part(arm, limb, 0, -0.38, 0, this.armB); part(new THREE.SphereGeometry(0.15, 12, 10), skin, 0, -0.8, 0, this.armB);
      this.legF = pivot(0, 0.9, 0.18, this.rig); part(leg, limb, 0, -0.43, 0, this.legF);
      this.legB = pivot(0, 0.9, -0.18, this.rig); part(leg, limb, 0, -0.43, 0, this.legB);
      scene.add(this.g);
    }

    get grounded() { return this.y <= 0 && this.vy <= 0; }
    get busy() { return this.move || this.hitstun > 0 || this.hp <= 0; }

    press(k) {
      if (k in this.held) {
        this.held[k] = true;
        const tok = (k === 'U' || k === 'D') ? k : ((k === 'R') === (this.facing > 0) ? 'F' : 'B');
        this.buffer.push({ t: performance.now(), tok });
        if (this.buffer.length > 12) this.buffer.shift();
      } else this.tryMove(k);
    }
    release(k) { if (k in this.held) this.held[k] = false; }

    tryMove(btn) {
      if (this.busy || game.state !== 'fight') return;
      const now = performance.now();
      const dirs = this.buffer.filter(b => now - b.t < 700).map(b => b.tok);
      for (const mv of this.moveList) {
        if (mv.seq[mv.seq.length - 1] !== btn) continue;
        const need = mv.seq.slice(0, -1);
        const tail = dirs.slice(dirs.length - need.length);
        if (need.length === 0 || (tail.length === need.length && need.every((t, i) => t === tail[i]))) {
          this.start(mv); this.buffer = []; return;
        }
      }
    }
    start(mv) { this.move = mv; this.moveFrame = 0; this.hitDone = false; if (this.grounded) this.vx = 0; }

    takeHit(fromX, m) {
      if (this.hp <= 0) return;
      const dir = Math.sign(this.x - fromX) || 1;
      const blocked = this.blocking && !this.move && Math.sign(fromX - this.x) === this.facing;
      spark(this.x - dir * 0.3, this.y + 1.5, blocked ? 0xffffff : 0xffd166);
      if (blocked) { this.hp = Math.max(0, this.hp - m.damage * 0.15); this.hitstun = 8; this.knock = dir * (m.knockback || 0.3) * 3; }
      else {
        this.hp = Math.max(0, this.hp - m.damage / this.def.stats.defense);
        this.hitstun = 14 + Math.round(m.damage); this.knock = dir * (m.knockback || 0.3) * 8;
        this.move = null; this.flash = 8; shake = 0.15;
        if (this.y > 0 || (m.knockback || 0) > 1) this.vy = Math.max(this.vy, 5);
      }
    }

    update() {
      const opp = this.opp;
      if (this.flash > 0) this.flash--;
      if (this.hp <= 0) { this.move = null; this.blocking = false; }
      else if (this.hitstun > 0) {
        this.hitstun--; this.vx = 0; this.blocking = this.hitstun > 0 && this.blocking;
        this.x += this.knock * DT; this.knock *= 0.88;
      } else if (this.move) {
        this.blocking = false;
        const mv = this.move, m = mv.m, f = ++this.moveFrame;
        if (m.projectile) { if (f === m.startup) shoot(this, m); }
        else if (!this.hitDone && f > m.startup && f <= m.startup + m.active) {
          const dx = (opp.x - this.x) * this.facing;
          if (dx > 0 && dx <= m.range + 0.35 && Math.abs(opp.y - this.y) < 1.6) { opp.takeHit(this.x, m); this.hitDone = true; }
        }
        if (f >= m.startup + m.active + m.recovery) this.move = null;
        this.x += this.vx * DT;
      } else {
        const dir = (this.held.R ? 1 : 0) - (this.held.L ? 1 : 0);
        if (this.grounded) {
          this.blocking = dir !== 0 && dir === -this.facing;
          this.vx = dir * this.def.stats.speed * 0.8 * (this.blocking ? 0.5 : 1);
          if (this.held.U) { this.vy = this.def.stats.jump; this.y = 0.001; }
          this.facing = Math.sign(opp.x - this.x) || this.facing;
        }
        this.x += this.vx * DT;
      }
      if (this.y > 0 || this.vy > 0) {
        this.vy -= GRAVITY * DT; this.y += this.vy * DT;
        if (this.y <= 0) { this.y = 0; this.vy = 0; }
      }
      this.x = Math.max(-ARENA, Math.min(ARENA, this.x));
    }

    pose(t) {
      this.g.position.set(this.x, this.y, 0);
      this.g.rotation.y = this.facing > 0 ? 0 : Math.PI;
      this.bodyMat.emissive.setHex(this.flash > 0 ? 0x992222 : 0x000000);
      let aF = 0.45, aB = 0.7, lF = 0.22, lB = -0.22, lean = 0, sy = 1, bob = Math.sin(t * 4 + this.side) * 0.03;
      if (this.hp <= 0) { this.rig.rotation.z = lerp(this.rig.rotation.z, Math.PI / 2, 0.12); this.rig.position.y = 0.3; return; }
      if (this.move) {
        const m = this.move.m, f = this.moveFrame;
        const p = f <= m.startup ? f / m.startup : f <= m.startup + m.active ? 1 : Math.max(0, 1 - (f - m.startup - m.active) / Math.max(1, m.recovery));
        switch (this.move.anim) {
          case 'punch': aF = lerp(0.45, Math.PI / 2, p); lean = -0.12 * p; break;
          case 'kick': lF = lerp(0.22, 1.45, p); lean = 0.25 * p; aB = lerp(0.7, -0.6, p); break;
          case 'uppercut': aF = lerp(0.45, 2.9, p); lean = 0.15 * p; lF = lerp(0.22, 0.6, p); break;
          case 'special': aF = aB = lerp(0.5, Math.PI / 2, p); lean = -0.1 * p; break;
        }
        bob = 0;
      } else if (this.hitstun > 0) { lean = this.blocking ? 0.05 : 0.4; }
      else if (this.blocking) { aF = 2.3; aB = 2.0; }
      else if (this.y > 0) { lF = 1.1; lB = 0.3; aF = 1.0; }
      else if (Math.abs(this.vx) > 0.1) { const s = Math.sin(t * 13); lF = 0.22 + s * 0.55; lB = -0.22 - s * 0.55; }
      if (!this.move && this.grounded && this.held.D && this.hitstun <= 0) sy = 0.75;
      this.armF.rotation.z = aF; this.armB.rotation.z = aB;
      this.legF.rotation.z = lF; this.legB.rotation.z = lB;
      this.rig.rotation.z = lerp(this.rig.rotation.z, lean, 0.35);
      this.rig.position.y = bob; this.g.scale.y = lerp(this.g.scale.y, sy, 0.3);
    }
    dispose() { scene.remove(this.g); }
  }

  // ---------------- Projectiles & sparks ----------------
  let projectiles = [], sparks = [], shake = 0;
  function shoot(owner, m) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12),
      new THREE.MeshStandardMaterial({ color: owner.def.color, emissive: owner.def.color, emissiveIntensity: 0.9 }));
    const p = { mesh, owner, m, x: owner.x + owner.facing * 0.9, y: owner.y + 1.6, vx: owner.facing * m.projectileSpeed };
    mesh.position.set(p.x, p.y, 0); scene.add(mesh); projectiles.push(p);
  }
  function spark(x, y, color) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true }));
    mesh.position.set(x, y, 0.4); scene.add(mesh); sparks.push({ mesh, life: 14 });
  }
  function updateFx() {
    for (const p of projectiles) {
      p.x += p.vx * DT; p.mesh.position.x = p.x; p.mesh.rotation.y += 0.3;
      const tgt = p.owner.opp;
      if (!p.dead && Math.abs(p.x - tgt.x) < 0.55 && p.y - tgt.y > 0 && p.y - tgt.y < 2.4) { tgt.takeHit(p.x - Math.sign(p.vx), p.m); p.dead = true; }
      if (Math.abs(p.x) > ARENA + 3) p.dead = true;
    }
    for (let i = 0; i < projectiles.length; i++) for (let j = i + 1; j < projectiles.length; j++) {
      const a = projectiles[i], b = projectiles[j];
      if (a.owner !== b.owner && Math.abs(a.x - b.x) < 0.5) { a.dead = b.dead = true; spark((a.x + b.x) / 2, a.y, 0xffffff); }
    }
    projectiles = projectiles.filter(p => { if (p.dead) scene.remove(p.mesh); return !p.dead; });
    sparks = sparks.filter(s => {
      s.life--; s.mesh.scale.setScalar(1 + (14 - s.life) * 0.25); s.mesh.material.opacity = s.life / 14;
      if (s.life <= 0) scene.remove(s.mesh); return s.life > 0;
    });
  }

  // ---------------- CPU ----------------
  function cpuThink(f) {
    if (f.busy || game.state !== 'fight') { f.held.L = f.held.R = f.held.U = false; return; }
    const opp = f.opp, d = Math.abs(opp.x - f.x);
    const toward = opp.x > f.x ? 'R' : 'L', away = toward === 'R' ? 'L' : 'R';
    f.held.U = false;
    if (f.cpuHold > 0) { f.cpuHold--; return; }
    f.held.L = f.held.R = false;
    const melee = f.moveList.filter(mv => !mv.m.projectile && mv.m.range + 0.3 >= d);
    const ranged = f.moveList.filter(mv => mv.m.projectile);
    const r = Math.random();
    if (opp.move && d < 2.2 && r < 0.35) { f.held[away] = true; f.cpuHold = 12; return; }
    if (melee.length && r < 0.07) { f.start(melee[Math.floor(Math.random() * melee.length)]); return; }
    if (d > 3 && ranged.length && r < 0.012) { f.start(ranged[0]); return; }
    if (r > 0.995) { f.held.U = true; return; }
    if (d > 1.5) f.held[toward] = true;
  }

  // ---------------- Game flow ----------------
  const game = { state: 'menu', fighters: [], timer: ROUND_TIME, cpu: true, picks: [0, 1] };

  const sel1 = $('p1'), sel2 = $('p2');
  ROSTER.forEach((c, i) => { sel1.add(new Option(c.name, i)); sel2.add(new Option(c.name, i)); });
  if (ROSTER.length > 1) sel2.value = 1;
  if (ROSTER.length < 1) $('startBtn').disabled = true;
  $('startBtn').onclick = () => { game.picks = [+sel1.value, +sel2.value]; game.cpu = $('cpu').checked; startRound(); };

  function banner(text, ms) {
    const b = $('banner'); b.innerHTML = text; b.style.opacity = 1;
    clearTimeout(banner.t); if (ms) banner.t = setTimeout(() => b.style.opacity = 0, ms);
  }

  function startRound() {
    game.fighters.forEach(f => f.dispose());
    projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
    const [a, b] = game.picks;
    const f1 = new Fighter(ROSTER[a], 0), f2 = new Fighter(ROSTER[b], 1);
    f1.opp = f2; f2.opp = f1; f2.cpuHold = 0;
    game.fighters = [f1, f2]; game.timer = ROUND_TIME; game.state = 'fight';
    $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
    $('n1').textContent = f1.def.name; $('n2').textContent = f2.def.name + (game.cpu ? ' (CPU)' : '');
    banner('FIGHT!', 900);
  }

  function endRound(reason) {
    game.state = 'end';
    const [f1, f2] = game.fighters;
    const w = f1.hp === f2.hp ? null : (f1.hp > f2.hp ? f1 : f2);
    banner(`${reason}<small>${w ? w.def.name + ' ชนะ!' : 'เสมอ'}<br>Enter = เล่นใหม่ · Esc = เลือกตัวละคร</small>`);
  }

  function step() {
    if (game.state === 'menu') return;
    const [f1, f2] = game.fighters;
    if (game.cpu) cpuThink(f2);
    f1.update(); f2.update(); updateFx();
    const dx = f2.x - f1.x;
    if (Math.abs(dx) < 0.75 && Math.abs(f1.y - f2.y) < 1.5) {
      const push = (0.75 - Math.abs(dx)) / 2 * (Math.sign(dx) || 1);
      f1.x -= push; f2.x += push;
    }
    if (game.state === 'fight') {
      game.timer -= DT;
      if (f1.hp <= 0 || f2.hp <= 0) endRound('K.O.!');
      else if (game.timer <= 0) { game.timer = 0; endRound('TIME UP'); }
    }
  }

  // ---------------- Input ----------------
  const KEYMAP = {
    KeyA: [0, 'L'], KeyD: [0, 'R'], KeyW: [0, 'U'], KeyS: [0, 'D'], KeyF: [0, 'P'], KeyG: [0, 'K'], KeyH: [0, 'S'],
    ArrowLeft: [1, 'L'], ArrowRight: [1, 'R'], ArrowUp: [1, 'U'], ArrowDown: [1, 'D'], Comma: [1, 'P'], Period: [1, 'K'], Slash: [1, 'S']
  };
  addEventListener('keydown', e => {
    if (e.code === 'Enter' && game.state === 'end') return startRound();
    if (e.code === 'Escape' && game.state !== 'menu') {
      game.state = 'menu'; $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); $('banner').style.opacity = 0; return;
    }
    const k = KEYMAP[e.code]; if (!k || game.state === 'menu') return;
    e.preventDefault(); if (e.repeat) return;
    if (k[0] === 1 && game.cpu) return;
    game.fighters[k[0]].press(k[1]);
  });
  addEventListener('keyup', e => {
    const k = KEYMAP[e.code]; if (!k || game.state === 'menu') return;
    if (k[0] === 1 && game.cpu) return;
    game.fighters[k[0]].release(k[1]);
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  });

  // ---------------- Loop ----------------
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= DT) { step(); acc -= DT; }
    const t = now / 1000;
    if (game.state === 'menu' || !game.fighters.length) {
      camera.position.set(Math.sin(t * 0.2) * 11, 4, Math.cos(t * 0.2) * 11); camera.lookAt(0, 1, 0);
    } else {
      const [f1, f2] = game.fighters;
      f1.pose(t); f2.pose(t);
      const mid = (f1.x + f2.x) / 2, dist = Math.abs(f1.x - f2.x);
      const s = shake > 0 ? (Math.random() - 0.5) * shake : 0; shake = Math.max(0, shake - 0.01);
      camera.position.x = lerp(camera.position.x, mid + s, 0.1);
      camera.position.y = lerp(camera.position.y, 3 + s, 0.1);
      camera.position.z = lerp(camera.position.z, 8.5 + dist * 0.45, 0.1);
      camera.lookAt(camera.position.x, 1.3, 0);
      $('hp1').style.width = (f1.hp / f1.maxHp * 100) + '%';
      $('hp2').style.width = (f2.hp / f2.maxHp * 100) + '%';
      $('timer').textContent = Math.ceil(game.timer);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
