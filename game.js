/* ============================================================
 *  game.js — เอนจินเกมต่อสู้ 3D (Three.js) เดินได้รอบสนาม
 *  ปกติไม่ต้องแก้ไฟล์นี้ เวลาเพิ่มตัวละครให้แก้ characters.js
 * ============================================================ */
(function () {
  'use strict';

  const DT = 1 / 60, GRAVITY = 26, ARENA_R = 9, ROUND_TIME = 99;
  const REWARD = { win: 30, lose: 10, draw: 15, versus: 15 };
  const $ = id => document.getElementById(id);

  // ---------------- เพชร & การปลดล็อก (เก็บในเบราว์เซอร์) ----------------
  const Store = {
    get(k, d) { try { const v = localStorage.getItem('arena3d.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('arena3d.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  const wallet = { gems: Store.get('gems', 0), unlocked: Store.get('unlocked', []) };
  function saveWallet() { Store.set('gems', wallet.gems); Store.set('unlocked', wallet.unlocked); }
  const isUnlocked = c => !c.price || wallet.unlocked.includes(c.id);

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
    $('select').classList.add('hidden');
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f18);
  scene.fog = new THREE.Fog(0x0d0f18, 18, 45);
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 120);
  camera.position.set(0, 3, 11);

  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x30202a, 0.55));
  const sun = new THREE.DirectionalLight(0xfff1e0, 1.25);
  sun.position.set(5, 12, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6fa8ff, 0.6); rim.position.set(-6, 5, -8); scene.add(rim);

  // พื้นสนามลายหิน (วาดด้วย canvas)
  (function buildArena() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#2a2f3e'; cx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const v = 38 + Math.random() * 14;
      cx.fillStyle = `rgb(${v},${v + 4},${v + 16})`;
      cx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 5); tex.encoding = THREE.sRGBEncoding;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 72), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA_R + 0.4, ARENA_R + 0.7, 96), new THREE.MeshBasicMaterial({ color: 0xff3c6e }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
    const stoneM = new THREE.MeshStandardMaterial({ color: 0x3a3f55, roughness: 0.9 });
    const fireM = new THREE.MeshBasicMaterial({ color: 0xffa040 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const px = Math.cos(a) * 13, pz = Math.sin(a) * 13;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.4, 10), stoneM);
      p.position.set(px, 1.7, pz); p.castShadow = true; p.receiveShadow = true; scene.add(p);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), fireM); f.position.set(px, 3.6, pz); scene.add(f);
      if (i % 2 === 0) { const l = new THREE.PointLight(0xff8a3a, 0.9, 12, 2); l.position.set(px, 3.8, pz); scene.add(l); }
    }
  })();

  // ---------------- คณิตศาสตร์เล็ก ๆ ----------------
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dirOf = ang => ({ x: Math.cos(ang), z: -Math.sin(ang) });
  const angOf = (dx, dz) => Math.atan2(-dz, dx);
  const camState = { right: { x: 1, z: 0 }, n: { x: 0, z: 1 } };

  // ---------------- VFX ----------------
  let fx = [], projectiles = [], shake = 0;
  function addFx(obj, life, update) { scene.add(obj); fx.push({ obj, life, max: life, update }); }
  function glowMat(color, op) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op == null ? 0.9 : op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }
  function spark(x, y, z, color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowMat(color));
    m.position.set(x, y, z);
    addFx(m, 14, (o, k) => { o.scale.setScalar(1 + (1 - k) * 3); o.material.opacity = k; });
  }
  function vfxArc(f, color) {
    const g = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.35, 28, 1, -1.1, 2.2), glowMat(color, 0.85));
    arc.rotation.x = -Math.PI / 2 + 0.35; g.add(arc);
    g.position.set(f.x, f.y + 1.35, f.z); g.rotation.y = f.ang;
    addFx(g, 10, (o, k) => { arc.material.opacity = k * 0.85; o.scale.setScalar(1 + (1 - k) * 0.3); });
  }
  function vfxX(f, color) {
    const g = new THREE.Group();
    [0.8, -0.8].forEach(r => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.06), glowMat(color));
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.4, 0.02), glowMat(0xffffff));
      b.add(core); b.rotation.x = r; g.add(b);
    });
    const d = dirOf(f.ang);
    g.position.set(f.x + d.x * 1.3, f.y + 1.35, f.z + d.z * 1.3); g.rotation.y = f.ang;
    addFx(g, 28, (o, k) => { o.children.forEach(c => { c.material.opacity = k; c.scale.set(1 + (1 - k) * 2, 1, 1 + (1 - k) * 2); }); });
  }
  function vfxRing(f, color, frames) {
    const g = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(f.curRange(), 0.05, 8, 64), glowMat(color, 0.7));
    torus.rotation.x = Math.PI / 2; g.add(torus);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.16), glowMat(i % 2 ? 0xffffff : color, 0.9));
      blade.position.set(Math.cos(a) * f.curRange() * 0.75, 0, Math.sin(a) * f.curRange() * 0.75);
      blade.rotation.y = -a; g.add(blade);
    }
    addFx(g, frames, (o, k) => {
      o.position.set(f.x, f.y + 1.1, f.z); o.rotation.y += 0.45;
      o.children.forEach(c => c.material.opacity = Math.min(1, k * 3) * 0.85);
    });
  }
  function updateFx() {
    fx = fx.filter(e => {
      e.life--; e.update(e.obj, e.life / e.max);
      if (e.life <= 0) scene.remove(e.obj);
      return e.life > 0;
    });
  }

  // ---------------- Fighter ----------------
  class Fighter {
    constructor(def, side) {
      this.def = def; this.side = side;
      this.maxHp = def.stats.hp; this.hp = this.maxHp; this.meter = 0;
      this.x = side === 0 ? -3 : 3; this.z = 0; this.y = 0;
      this.vx = 0; this.vz = 0; this.vy = 0;
      this.ang = side === 0 ? 0 : Math.PI;
      this.move = null; this.moveFrame = 0; this.hitDone = false; this.hitCount = 0;
      this.hitstun = 0; this.kx = 0; this.kz = 0; this.blocking = false; this.flash = 0;
      this.held = { L: false, R: false, U: false, D: false, J: false };
      this.buffer = []; this.dash = null; this.line = null;
      this.moveList = Object.keys(def.moves).map(name => {
        const m = def.moves[name];
        const seq = m.input.trim().split(/\s+/);
        const type = m.type || (m.projectile ? 'projectile' : 'melee');
        const anim = m.anim || { P: 'punch', K: 'kick', S: 'special', E: 'uppercut', R: 'special' }[seq[seq.length - 1]];
        return { name, m, seq, anim, type };
      }).sort((a, b) => b.seq.length - a.seq.length);

      Object.assign(this, window.buildFighterModel(def));
      scene.add(this.g);
    }

    get grounded() { return this.y <= 0 && this.vy <= 0; }
    get busy() { return this.move || this.hitstun > 0 || this.hp <= 0; }
    curRange() { return this.move ? this.move.m.range : 2; }
    dist2(o) { return Math.hypot(o.x - this.x, o.z - this.z); }

    press(k) {
      if (k === 'J') { this.held.J = true; return; }
      if (k in this.held) {
        this.held[k] = true;
        let tok = k;
        if (k === 'L' || k === 'R') {
          const d = dirOf(this.ang), s = k === 'R' ? 1 : -1;
          tok = (camState.right.x * d.x + camState.right.z * d.z) * s > 0 ? 'F' : 'B';
        }
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
        if (mv.m.ultimate && this.meter < 100) continue;
        const need = mv.seq.slice(0, -1);
        const tail = dirs.slice(dirs.length - need.length);
        if (need.length === 0 || (tail.length === need.length && need.every((t, i) => t === tail[i]))) {
          this.start(mv); this.buffer = []; return;
        }
      }
    }
    start(mv) {
      this.move = mv; this.moveFrame = 0; this.hitDone = false; this.hitCount = 0; this.dash = null; this.dashDone = false;
      if (this.grounded) { this.vx = 0; this.vz = 0; }
      if (mv.m.ultimate) { this.meter = 0; banner(`<span style="color:${this.eyeColor}">${esc(mv.name.toUpperCase())}</span>`, 700); }
    }

    takeHit(fromX, fromZ, m, attacker) {
      if (this.hp <= 0) return;
      let dx = this.x - fromX, dz = this.z - fromZ; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const d = dirOf(this.ang);
      const facingAttacker = (-dx * d.x - dz * d.z) > 0.3;
      const blocked = this.blocking && !this.move && facingAttacker && !m.ultimate;
      spark(this.x - dx * 0.3, this.y + 1.4, this.z - dz * 0.3, blocked ? 0xffffff : 0xffd166);
      const kb = (m.knockback || 0.3);
      if (blocked) {
        const dmg = m.damage * 0.15; this.hp = Math.max(0, this.hp - dmg);
        this.hitstun = 8; this.kx = dx * kb * 3; this.kz = dz * kb * 3;
        this.meter = Math.min(100, this.meter + 4);
      } else {
        const dmg = m.damage / this.def.stats.defense;
        this.hp = Math.max(0, this.hp - dmg);
        this.hitstun = 12 + Math.round(m.damage * 0.8); this.kx = dx * kb * 8; this.kz = dz * kb * 8;
        this.move = null; this.dash = null; this.flash = 8; shake = Math.max(shake, m.ultimate ? 0.35 : 0.15);
        if (this.y > 0 || kb > 1) this.vy = Math.max(this.vy, 4 + kb * 1.5);
        this.meter = Math.min(100, this.meter + dmg * 0.8);
        if (attacker) attacker.meter = Math.min(100, attacker.meter + dmg * 1.2);
      }
      this.clearLine();
    }

    clearLine() { if (this.line) { scene.remove(this.line); this.line = null; } }
    drawLine(tx, ty, tz) {
      if (!this.line) {
        this.line = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), new THREE.MeshBasicMaterial({ color: 0xd8dee8 }));
        scene.add(this.line);
      }
      const d = dirOf(this.ang);
      const sx = this.x + d.x * 0.4, sy = this.y + 1.45, sz = this.z + d.z * 0.4;
      const v = new THREE.Vector3(tx - sx, ty - sy, tz - sz); const len = v.length();
      this.line.scale.set(1, len, 1);
      this.line.position.set(sx + v.x / 2, sy + v.y / 2, sz + v.z / 2);
      this.line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    }

    tryHit(m, aoe) {
      const opp = this.opp, dx = opp.x - this.x, dz = opp.z - this.z, dist = Math.hypot(dx, dz) || 0.001;
      const d = dirOf(this.ang);
      const inFront = (dx * d.x + dz * d.z) / dist > 0.25;
      if (dist <= m.range + 0.35 && (aoe || inFront) && Math.abs(opp.y - this.y) < 1.7) { opp.takeHit(this.x, this.z, m, this); return true; }
      return false;
    }

    update() {
      const opp = this.opp;
      if (this.flash > 0) this.flash--;
      if (this.hp <= 0) { this.move = null; this.blocking = false; this.clearLine(); }
      else if (this.hitstun > 0) {
        this.hitstun--; this.vx = this.vz = 0;
        this.x += this.kx * DT; this.z += this.kz * DT; this.kx *= 0.88; this.kz *= 0.88;
        if (this.hitstun <= 0) this.blocking = false;
      } else if (this.move) {
        this.blocking = false;
        const mv = this.move, m = mv.m;
        // ---- สลิง: ค้างเฟรมไว้ระหว่างพุ่งตัว ----
        if (mv.type === 'grapple' && this.dash) {
          const dx = opp.x - this.x, dz = opp.z - this.z, dist = Math.hypot(dx, dz);
          this.drawLine(opp.x, opp.y + 1.3, opp.z);
          this.ang = angOf(dx, dz);
          this.dash.t++;
          if (dist <= m.range || this.dash.t > 45) { this.dash = null; this.clearLine(); this.vx = this.vz = 0; }
          else { const sp = 24; this.x += dx / dist * sp * DT; this.z += dz / dist * sp * DT; this.y = Math.max(this.y, Math.sin(this.dash.t / 6) * 0.6); }
        } else {
          const f = ++this.moveFrame;
          if (mv.type === 'grapple' && f === m.startup && !this.dashDone) {
            this.dashDone = true;
            if (this.dist2(opp) <= (m.reach || 10)) { this.dash = { t: 0 }; this.moveFrame--; }
            else { const d = dirOf(this.ang); this.drawLine(this.x + d.x * m.reach, this.y + 1.45, this.z + d.z * m.reach); setTimeout(() => this.clearLine(), 150); }
          }
          const activeStart = f === m.startup + 1;
          if (activeStart) {
            if (m.vfx === 'arc') vfxArc(this, this.eyeColor);
            if (m.vfx === 'x') vfxX(this, this.eyeColor);
            if (m.vfx === 'ring') vfxRing(this, this.eyeColor, mv.type === 'spin' ? m.active : 20);
          }
          if (mv.type === 'projectile') { if (f === m.startup) shoot(this, m); }
          else if (mv.type === 'spin') {
            const hits = m.hits || 1, every = Math.max(1, Math.floor(m.active / hits));
            if (f > m.startup && f <= m.startup + m.active) {               // หมุนพลางไหลเข้าหาคู่ต่อสู้
              const dx = opp.x - this.x, dz = opp.z - this.z, dd = Math.hypot(dx, dz);
              if (dd > 1) { this.x += dx / dd * 4.5 * DT; this.z += dz / dd * 4.5 * DT; }
            }
            if (f > m.startup && f <= m.startup + m.active && (f - m.startup - 1) % every === 0 && this.hitCount < hits) {
              this.hitCount++; this.tryHit(m, true);
            }
          } else if (!this.hitDone && f > m.startup && f <= m.startup + m.active) {
            if (this.tryHit(m, m.vfx === 'ring')) this.hitDone = true;
          }
          if (this.moveFrame >= m.startup + m.active + m.recovery) { this.move = null; this.clearLine(); }
        }
      } else {
        const h = this.held, R = camState.right, N = camState.n;
        const ax = (h.R ? 1 : 0) - (h.L ? 1 : 0), az = (h.D ? 1 : 0) - (h.U ? 1 : 0);
        let mx = R.x * ax + N.x * az * 0.85, mz = R.z * ax + N.z * az * 0.85;
        const ml = Math.hypot(mx, mz);
        if (this.grounded) {
          const d = dirOf(this.ang);
          this.blocking = ml > 0 && (mx * d.x + mz * d.z) / ml < -0.5;
          const sp = this.def.stats.speed * 0.8 * (this.blocking ? 0.5 : 1);
          this.vx = ml ? mx / ml * sp : 0; this.vz = ml ? mz / ml * sp : 0;
          if (h.J) { this.vy = this.def.stats.jump; this.y = 0.001; h.J = false; }
        }
        this.x += this.vx * DT; this.z += this.vz * DT;
      }
      if (!this.busy || this.hitstun > 0) this.ang = angOf(opp.x - this.x, opp.z - this.z);
      if (this.y > 0 || this.vy > 0) {
        if (!(this.move && this.dash)) { this.vy -= GRAVITY * DT; this.y += this.vy * DT; }
        if (this.y <= 0) { this.y = 0; this.vy = 0; }
      }
      const r = Math.hypot(this.x, this.z);
      if (r > ARENA_R) { this.x *= ARENA_R / r; this.z *= ARENA_R / r; }
    }

    pose(t) {
      this.g.position.set(this.x, this.y, this.z);
      this.g.rotation.y = this.ang;
      this.flashMat.emissive.setHex(this.flash > 0 ? 0x661111 : 0x000000);
      const ult = this.move && this.move.m.ultimate;
      this.eyeMat.emissiveIntensity = lerp(this.eyeMat.emissiveIntensity, ult ? 3 : 0, 0.2);
      let aF = 0.35, aB = 0.55, xF = 0, xB = 0, lF = 0.18, lB = -0.18, lean = 0, spin = 0;
      let bob = Math.sin(t * 4 + this.side) * 0.025;
      if (this.hp <= 0) {
        this.rig.rotation.z = lerp(this.rig.rotation.z, Math.PI / 2, 0.12); this.rig.position.y = 0.25;
        this.armF.rotation.z = lerp(this.armF.rotation.z, 2.6, 0.1);
        return;
      }
      if (this.move) {
        const m = this.move.m, f = this.moveFrame;
        const p = f <= m.startup ? f / m.startup : f <= m.startup + m.active ? 1 : Math.max(0, 1 - (f - m.startup - m.active) / Math.max(1, m.recovery));
        switch (this.move.anim) {
          case 'punch': aF = lerp(0.35, Math.PI / 2, p); lean = -0.12 * p; break;
          case 'kick': lF = lerp(0.18, 1.45, p); lean = 0.25 * p; aB = lerp(0.55, -0.6, p); break;
          case 'uppercut': aF = lerp(0.35, 2.9, p); lean = 0.15 * p; lF = lerp(0.18, 0.6, p); break;
          case 'special': aF = aB = lerp(0.5, Math.PI / 2, p); lean = -0.1 * p; break;
          case 'grapple':
            aF = this.dash ? Math.PI / 2 : lerp(0.35, Math.PI / 2, p); aB = this.dash ? -0.6 : 0.55;
            lF = this.dash ? 1.0 : 0.18; lB = this.dash ? -0.9 : -0.18; lean = this.dash ? -0.45 : 0;
            if (!this.dash && f > m.startup) { aF = lerp(Math.PI / 2, 2.4, p); aB = lerp(-0.6, 2.2, p); }
            break;
          case 'xslash': {
            const s = f <= m.startup ? f / m.startup : 1;
            const cut = f > m.startup ? Math.min(1, (f - m.startup) / Math.max(1, m.active)) : 0;
            aF = aB = lerp(0.35, 2.8, s) - cut * 3.2; xF = -0.5 * cut; xB = 0.5 * cut; lean = -0.25 * cut; break;
          }
          case 'spin':
            aF = aB = 0; xF = lerp(0, -Math.PI / 2, p); xB = lerp(0, Math.PI / 2, p);
            if (f > m.startup && f <= m.startup + m.active) spin = ((f - m.startup) / m.active) * Math.PI * 2 * (m.hits || 3) * 0.5;
            lF = 0.4; lB = -0.4; break;
        }
        bob = 0;
      } else if (this.hitstun > 0) { lean = this.blocking ? 0.05 : 0.4; }
      else if (this.blocking) { aF = 2.3; aB = 2.0; }
      else if (this.y > 0) { lF = 1.1; lB = 0.3; aF = 1.0; }
      else if (Math.hypot(this.vx, this.vz) > 0.1) { const s = Math.sin(t * 13); lF = 0.18 + s * 0.6; lB = -0.18 - s * 0.6; aF = 0.35 - s * 0.4; aB = 0.55 + s * 0.4; lean = -0.08; }
      this.armF.rotation.set(xF, 0, aF); this.armB.rotation.set(xB, 0, aB);
      this.legF.rotation.z = lF; this.legB.rotation.z = lB;
      this.rig.rotation.z = lerp(this.rig.rotation.z, lean, 0.35);
      this.rig.rotation.y = spin;
      this.rig.position.y = bob;
      if (this.cape) {
        const sp = Math.hypot(this.vx, this.vz) + (this.dash ? 20 : 0) + (spin ? 14 : 0);
        this.cape.rotation.z = lerp(this.cape.rotation.z, -(0.08 + Math.min(1.2, sp * 0.06) + Math.sin(t * 3 + this.side) * 0.05), 0.15);
      }
    }
    dispose() { scene.remove(this.g); this.clearLine(); }
  }

  // ---------------- Projectiles ----------------
  function shoot(owner, m) {
    const size = m.ultimate ? 0.55 : 0.28;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 18, 14), glowMat(owner.def.color, 0.95));
    const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    mesh.add(core);
    const light = new THREE.PointLight(new THREE.Color(owner.def.color), 1.2, 6); mesh.add(light);
    const d = dirOf(owner.ang);
    const p = { mesh, owner, m, x: owner.x + d.x * 0.9, y: owner.y + 1.45, z: owner.z + d.z * 0.9, vx: d.x * m.projectileSpeed, vz: d.z * m.projectileSpeed, r: size };
    mesh.position.set(p.x, p.y, p.z); scene.add(mesh); projectiles.push(p);
  }
  function updateProjectiles() {
    for (const p of projectiles) {
      p.x += p.vx * DT; p.z += p.vz * DT; p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.scale.setScalar(1 + Math.sin(performance.now() / 60) * 0.08);
      const tgt = p.owner.opp;
      if (!p.dead && Math.hypot(p.x - tgt.x, p.z - tgt.z) < 0.45 + p.r && p.y - tgt.y > 0 && p.y - tgt.y < 2.4) {
        tgt.takeHit(p.x - p.vx * 0.05, p.z - p.vz * 0.05, p.m, p.owner); p.dead = true;
      }
      if (Math.hypot(p.x, p.z) > ARENA_R + 4) p.dead = true;
    }
    for (let i = 0; i < projectiles.length; i++) for (let j = i + 1; j < projectiles.length; j++) {
      const a = projectiles[i], b = projectiles[j];
      if (a.owner !== b.owner && Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r) {
        if (!a.m.ultimate) a.dead = true; if (!b.m.ultimate) b.dead = true;
        spark((a.x + b.x) / 2, a.y, (a.z + b.z) / 2, 0xffffff);
      }
    }
    projectiles = projectiles.filter(p => { if (p.dead) scene.remove(p.mesh); return !p.dead; });
  }

  // ---------------- CPU ----------------
  function cpuThink(f) {
    const h = f.held;
    if (f.busy || game.state !== 'fight') { h.L = h.R = h.U = h.D = false; return; }
    const opp = f.opp, d = f.dist2(opp);
    if (f.cpuHold > 0) { f.cpuHold--; return; }
    h.L = h.R = h.U = h.D = false;
    // แปลงทิศในโลก → ปุ่มตามมุมกล้อง
    const steer = (wx, wz) => {
      const a = wx * camState.right.x + wz * camState.right.z, b = wx * camState.n.x + wz * camState.n.z;
      if (a > 0.3) h.R = true; else if (a < -0.3) h.L = true;
      if (b > 0.3) h.D = true; else if (b < -0.3) h.U = true;
    };
    const tx = (opp.x - f.x) / (d || 1), tz = (opp.z - f.z) / (d || 1);
    const r = Math.random();
    const ult = f.moveList.find(mv => mv.m.ultimate);
    if (ult && f.meter >= 100 && (ult.type === 'projectile' || d < ult.m.range + 0.5) && r < 0.08) { f.start(ult); return; }
    if (opp.move && d < 2.4 && r < 0.3) { steer(-tx, -tz); f.cpuHold = 12; return; }
    if (opp.move && d < 2.4 && r < 0.4) { steer(-tz, tx); f.cpuHold = 10; return; }         // หลบด้านข้าง
    const usable = f.moveList.filter(mv => !mv.m.ultimate && mv.seq.length === 1);
    const melee = usable.filter(mv => mv.type === 'melee' && mv.m.range + 0.3 >= d);
    const ranged = usable.filter(mv => mv.type === 'projectile' || (mv.type === 'grapple' && d <= (mv.m.reach || 10)));
    if (melee.length && r < 0.07) { f.start(melee[Math.floor(Math.random() * melee.length)]); return; }
    if (d > 3 && ranged.length && r < 0.015) { f.start(ranged[Math.floor(Math.random() * ranged.length)]); return; }
    if (r > 0.995) { h.J = true; return; }
    if (d > 1.5) steer(tx, tz);
  }

  // ---------------- Game flow ----------------
  const game = { state: 'select', fighters: [], timer: ROUND_TIME, cpu: true, picks: [0, 1] };

  function banner(text, ms) {
    const b = $('banner'); b.innerHTML = text; b.style.opacity = 1;
    clearTimeout(banner.t); if (ms) banner.t = setTimeout(() => b.style.opacity = 0, ms);
  }
  function clearArena() {
    game.fighters.forEach(f => f.dispose()); game.fighters = [];
    projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
    fx.forEach(e => scene.remove(e.obj)); fx = [];
  }

  function startRound() {
    clearPreviews(); clearArena();
    const [a, b] = game.picks;
    const f1 = new Fighter(ROSTER[a], 0), f2 = new Fighter(ROSTER[b], 1);
    f1.opp = f2; f2.opp = f1; f2.cpuHold = 0;
    camState.right = { x: 1, z: 0 }; camState.n = { x: 0, z: 1 };
    game.fighters = [f1, f2]; game.timer = ROUND_TIME; game.state = 'fight';
    $('select').classList.add('hidden'); $('hud').classList.remove('hidden');
    $('n1').textContent = f1.def.name; $('n2').textContent = f2.def.name + (game.cpu ? ' (CPU)' : '');
    banner('FIGHT!', 900);
  }

  function endRound(reason) {
    game.state = 'end';
    const [f1, f2] = game.fighters;
    const w = f1.hp === f2.hp ? null : (f1.hp > f2.hp ? f1 : f2);
    let got = REWARD.versus;
    if (game.cpu) got = !w ? REWARD.draw : (w === f1 ? REWARD.win : REWARD.lose);
    wallet.gems += got; saveWallet(); updateGems();
    banner(`${reason}<small>${w ? esc(w.def.name) + ' ชนะ!' : 'เสมอ'} · ได้ 💎 ${got}<br>Enter = เล่นใหม่ · Esc = เลือกตัวละคร</small>`);
  }

  function step() {
    if (game.state === 'select') return;
    const [f1, f2] = game.fighters;
    if (game.cpu) cpuThink(f2);
    f1.update(); f2.update(); updateProjectiles();
    const dx = f2.x - f1.x, dz = f2.z - f1.z, d = Math.hypot(dx, dz) || 0.001;
    if (d < 0.75 && Math.abs(f1.y - f2.y) < 1.5) {
      const push = (0.75 - d) / 2;
      f1.x -= dx / d * push; f1.z -= dz / d * push; f2.x += dx / d * push; f2.z += dz / d * push;
    }
    if (game.state === 'fight') {
      game.timer -= DT;
      if (f1.hp <= 0 || f2.hp <= 0) endRound('K.O.!');
      else if (game.timer <= 0) { game.timer = 0; endRound('TIME UP'); }
    }
  }

  // ---------------- หน้าเลือกตัวละคร ----------------
  const N = ROSTER.length;                    // ช่องสุดท้าย (index N) = สุ่ม
  const COLS = Math.min(N + 1, 6);
  const sel = { cur: [0, Math.min(1, N - 1)], locked: [false, false], previews: [null, null], startT: null, shop: null };
  const STAT_MAX = { hp: 150, speed: 9, jump: 12, defense: 1.5 };
  const STAT_TH = { hp: 'พลังชีวิต', speed: 'ความเร็ว', jump: 'กระโดด', defense: 'ป้องกัน' };
  const TOKEN_TH = { U: '↑', D: '↓', F: '→', B: '←', P: 'ต่อย', K: 'เตะ', S: 'สกิล1', E: 'สกิล2', R: 'อัลติ' };

  function updateGems() { $('gems').textContent = '💎 ' + wallet.gems; }

  function buildGrid() {
    const grid = $('grid');
    grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    grid.innerHTML = ROSTER.map((c, i) =>
      `<button class="ch" data-i="${i}" style="--c:${c.color}"><span class="face">${esc(c.name[0])}</span><span class="nm">${esc(c.name)}</span>` +
      `<span class="lock">🔒 💎${c.price || 0}</span><i class="b1">1P</i><i class="b2">2P</i></button>`
    ).join('') + `<button class="ch rnd" data-i="${N}" style="--c:#666"><span class="face">?</span><span class="nm">สุ่ม</span><i class="b1">1P</i><i class="b2">2P</i></button>`;
    grid.querySelectorAll('.ch').forEach(btn => {
      btn.onclick = () => {
        if (sel.shop !== null) return;
        const slot = activeSlotForMouse(); if (slot < 0) return;
        sel.cur[slot] = +btn.dataset.i; refresh(slot); lock(slot);
      };
      btn.onmouseenter = () => {
        if (sel.shop !== null) return;
        const slot = activeSlotForMouse(); if (slot < 0 || sel.cur[slot] === +btn.dataset.i) return;
        sel.cur[slot] = +btn.dataset.i; refresh(slot);
      };
    });
  }

  function activeSlotForMouse() { return !sel.locked[0] ? 0 : !sel.locked[1] ? 1 : -1; }
  function slotForKeys(kp) {
    if (game.cpu) return kp === 0 ? (sel.locked[0] ? 1 : 0) : -1;
    return kp;
  }

  function sidePanel(slot) {
    const i = sel.cur[slot], el = $(slot ? 'side2' : 'side1');
    const tag = slot === 0 ? '1P' : (game.cpu ? 'CPU' : '2P');
    const status = sel.locked[slot] ? '<div class="st ok">พร้อม!</div>'
      : (activeSlotForMouse() === slot || !game.cpu) ? '<div class="st">กำลังเลือก…</div>' : '<div class="st dim">รอ</div>';
    if (i === N) { el.innerHTML = `<div class="tag">${tag}</div><h2>สุ่มตัวละคร</h2><p>สุ่มจากตัวที่ปลดล็อกแล้ว</p>${status}`; el.style.setProperty('--c', '#888'); return; }
    const c = ROSTER[i];
    el.style.setProperty('--c', c.color);
    const bars = Object.keys(STAT_MAX).map(k =>
      `<div class="stat"><span>${STAT_TH[k]}</span><div class="sb"><div style="width:${Math.min(100, c.stats[k] / STAT_MAX[k] * 100)}%"></div></div><b>${c.stats[k]}</b></div>`).join('');
    const moves = Object.keys(c.moves).map(n => {
      const m = c.moves[n];
      const keys = m.input.trim().split(/\s+/).map(t => `<kbd>${TOKEN_TH[t] || t}</kbd>`).join('');
      return `<li${m.ultimate ? ' class="ult"' : ''}><span>${esc(n)}</span><span>${keys}</span><em>${m.damage}${m.hits ? '×' + m.hits : ''}</em></li>`;
    }).join('');
    const lockLine = isUnlocked(c) ? '' : `<div class="st lk">🔒 ต้องใช้ 💎 ${c.price} ปลดล็อก</div>`;
    el.innerHTML = `<div class="tag">${tag}${c.role ? ' · ' + esc(c.role) : ''}</div><h2>${esc(c.name)}</h2>${c.description ? `<p>${esc(c.description)}</p>` : ''}${bars}<ul class="mv"><li class="hd"><span>ท่า</span><span>ปุ่ม</span><em>ดาเมจ</em></li>${moves}</ul>${lockLine}${status}`;
  }

  function refresh(changedSlot) {
    $('grid').querySelectorAll('.ch').forEach(btn => {
      const i = +btn.dataset.i;
      btn.classList.toggle('p1', sel.cur[0] === i);
      btn.classList.toggle('p2', sel.cur[1] === i && (sel.locked[0] || !game.cpu));
      btn.classList.toggle('lk1', sel.locked[0] && sel.cur[0] === i);
      btn.classList.toggle('lk2', sel.locked[1] && sel.cur[1] === i);
      btn.classList.toggle('locked', i < N && !isUnlocked(ROSTER[i]));
    });
    $('grid').querySelectorAll('.b2').forEach(b => b.textContent = game.cpu ? 'CPU' : '2P');
    sidePanel(0); sidePanel(1); updateGems();
    $('modeCpu').classList.toggle('on', game.cpu); $('modeVs').classList.toggle('on', !game.cpu);
    $('selHelp').innerHTML = game.cpu
      ? 'เลือกด้วย <kbd>A</kbd><kbd>D</kbd><kbd>W</kbd><kbd>S</kbd> หรือเมาส์ · ยืนยัน <kbd>F</kbd> / คลิก · ยกเลิก <kbd>G</kbd> — เลือกตัวเองก่อน แล้วเลือกคู่ต่อสู้'
      : '1P: <kbd>A</kbd><kbd>D</kbd><kbd>W</kbd><kbd>S</kbd> ยืนยัน <kbd>F</kbd> ยกเลิก <kbd>G</kbd> · 2P: ลูกศร ยืนยัน <kbd>,</kbd> ยกเลิก <kbd>.</kbd>';
    if (changedSlot !== undefined) setPreview(changedSlot);
  }

  function setPreview(slot) {
    if (sel.previews[slot]) sel.previews[slot].dispose();
    sel.previews[slot] = null;
    const i = sel.cur[slot];
    if (i === N || (slot === 1 && game.cpu && !sel.locked[0])) return;
    const f = new Fighter(ROSTER[i], slot);
    f.x = slot ? 1.7 : -1.7; f.z = 0; f.ang = slot ? -2.4 : -0.75;
    sel.previews[slot] = f;
  }
  function clearPreviews() { sel.previews.forEach(f => f && f.dispose()); sel.previews = [null, null]; }

  // ---- ร้านแลกเพชร ----
  function openShop(slot) {
    const c = ROSTER[sel.cur[slot]]; sel.shop = slot;
    const enough = wallet.gems >= c.price;
    $('shopBody').innerHTML = `<h3>ปลดล็อก <span style="color:${c.color}">${esc(c.name)}</span></h3>` +
      `<p>ราคา 💎 ${c.price} · คุณมี 💎 ${wallet.gems}</p>` +
      (enough ? '' : `<p class="warn">เพชรไม่พอ ขาดอีก 💎 ${c.price - wallet.gems} — ชนะ CPU ได้ 💎 ${REWARD.win} ต่อรอบ</p>`);
    $('shopYes').disabled = !enough;
    $('shop').classList.remove('hidden');
  }
  function closeShop() { sel.shop = null; $('shop').classList.add('hidden'); }
  function buyShop() {
    if (sel.shop === null) return;
    const slot = sel.shop, c = ROSTER[sel.cur[slot]];
    if (wallet.gems < c.price) return;
    wallet.gems -= c.price; wallet.unlocked.push(c.id); saveWallet();
    closeShop(); refresh(); banner(`ปลดล็อก ${esc(c.name)}!`, 1200);
  }
  $('shopYes').onclick = buyShop; $('shopNo').onclick = closeShop;

  function lock(slot) {
    const i = sel.cur[slot];
    if (i < N && !isUnlocked(ROSTER[i])) { openShop(slot); return; }
    sel.locked[slot] = true;
    refresh(slot);
    if (game.cpu && slot === 0) refresh(1);
    const f = sel.previews[slot];
    if (f && f.moveList.length) { f.start(f.moveList.find(mv => mv.type === 'melee') || f.moveList[0]); }
    if (sel.locked[0] && sel.locked[1]) {
      $('selHelp').innerHTML = '<b class="ready">READY!</b>';
      const pool = ROSTER.map((c, k) => k).filter(k => isUnlocked(ROSTER[k]));
      sel.startT = setTimeout(() => {
        game.picks = sel.cur.map(k => k === N ? pool[Math.floor(Math.random() * pool.length)] : k);
        startRound();
      }, 900);
    }
  }
  function unlock(slot) {
    clearTimeout(sel.startT);
    sel.locked[slot] = false; refresh(slot);
    if (game.cpu && slot === 0) refresh(1);
  }

  function selectKey(kp, k) {
    if (sel.shop !== null) { if (k === 'P') buyShop(); else if (k === 'K') closeShop(); return; }
    const slot = slotForKeys(kp);
    if (k === 'K') {
      if (game.cpu) { if (sel.locked[1]) unlock(1); else if (sel.locked[0]) unlock(0); }
      else if (sel.locked[kp]) unlock(kp);
      return;
    }
    if (slot < 0 || sel.locked[slot]) return;
    if (k === 'P' || k === 'S') { lock(slot); return; }
    const total = N + 1, step = { L: -1, R: 1, U: -COLS, D: COLS }[k];
    if (!step) return;
    let n = sel.cur[slot] + step;
    if (k === 'L' || k === 'R') n = (n + total) % total;
    else if (n < 0 || n >= total) return;
    sel.cur[slot] = n; refresh(slot);
  }

  function openSelect() {
    game.state = 'select';
    clearArena(); closeShop();
    clearTimeout(sel.startT);
    sel.locked = [false, false];
    $('select').classList.remove('hidden'); $('hud').classList.add('hidden'); $('banner').style.opacity = 0;
    refresh(0); refresh(1);
  }

  $('modeCpu').onclick = () => { game.cpu = true; openSelect(); };
  $('modeVs').onclick = () => { game.cpu = false; openSelect(); };
  if (N < 1) { $('selHelp').textContent = 'ไม่มีตัวละครที่ผ่าน CheckBot — ดูรายการ error มุมซ้ายล่าง'; }
  else { buildGrid(); openSelect(); }

  // ---------------- Input ----------------
  const KEYMAP = {
    KeyA: [0, 'L'], KeyD: [0, 'R'], KeyW: [0, 'U'], KeyS: [0, 'D'], Space: [0, 'J'],
    KeyF: [0, 'P'], KeyG: [0, 'K'], KeyH: [0, 'S'], KeyJ: [0, 'E'], KeyR: [0, 'R!'],
    ArrowLeft: [1, 'L'], ArrowRight: [1, 'R'], ArrowUp: [1, 'U'], ArrowDown: [1, 'D'], ShiftRight: [1, 'J'],
    Comma: [1, 'P'], Period: [1, 'K'], Slash: [1, 'S'], Semicolon: [1, 'E'], Quote: [1, 'R!']
  };
  // 'R!' = ปุ่มอัลติ (แยกจาก 'R' ที่แปลว่าเดินขวา)
  const btnOf = k => k === 'R!' ? 'R' : k;
  addEventListener('keydown', e => {
    if (e.code === 'Enter' && game.state === 'end') return startRound();
    if (e.code === 'Escape') { if (sel.shop !== null) return closeShop(); if (game.state !== 'select') return openSelect(); }
    const k = KEYMAP[e.code]; if (!k) return;
    e.preventDefault(); if (e.repeat) return;
    if (game.state === 'select') { if (N > 0 && k[1] !== 'R!' && k[1] !== 'J') selectKey(k[0], k[1]); return; }
    if (k[0] === 1 && game.cpu) return;
    const f = game.fighters[k[0]];
    if (k[1] === 'R!') f.tryMove('R'); else f.press(btnOf(k[1]));
  });
  addEventListener('keyup', e => {
    const k = KEYMAP[e.code]; if (!k || game.state === 'select') return;
    if (k[0] === 1 && game.cpu) return;
    game.fighters[k[0]].release(btnOf(k[1]));
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  });

  // ---------------- Loop ----------------
  let last = performance.now(), acc = 0;
  function updateCamera() {
    const [f1, f2] = game.fighters;
    let ux = f2.x - f1.x, uz = f2.z - f1.z; const d = Math.hypot(ux, uz) || 1; ux /= d; uz /= d;
    let nx = -uz, nz = ux;
    if (nx * camState.n.x + nz * camState.n.z < 0) { nx = -nx; nz = -nz; }        // ไม่ให้กล้องสลับฝั่ง
    camState.n.x = lerp(camState.n.x, nx, 0.04); camState.n.z = lerp(camState.n.z, nz, 0.04);
    const nl = Math.hypot(camState.n.x, camState.n.z) || 1; camState.n.x /= nl; camState.n.z /= nl;
    camState.right = { x: camState.n.z, z: -camState.n.x };
    const mx = (f1.x + f2.x) / 2, mz = (f1.z + f2.z) / 2;
    const s = shake > 0 ? (Math.random() - 0.5) * shake : 0; shake = Math.max(0, shake - 0.012);
    const back = (innerWidth / innerHeight < 1 ? 13 : 8.5) + d * 0.5;
    camera.position.x = lerp(camera.position.x, mx + camState.n.x * back + s, 0.1);
    camera.position.y = lerp(camera.position.y, 3.2 + d * 0.08 + s, 0.1);
    camera.position.z = lerp(camera.position.z, mz + camState.n.z * back, 0.1);
    camera.lookAt(mx, 1.3, mz);
  }
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= DT) {
      step(); updateFx(); acc -= DT;
      if (game.state === 'select') sel.previews.forEach(f => {
        if (f && f.move && ++f.moveFrame >= f.move.m.startup + f.move.m.active + f.move.m.recovery) f.move = null;
      });
    }
    const t = now / 1000;
    if (game.state === 'select') {
      sel.previews.forEach(f => f && f.pose(t));
      const wide = innerWidth / innerHeight < 1 ? 11 : 7;
      camera.position.set(Math.sin(t * 0.3) * 0.5, 2.3, wide); camera.lookAt(0, 1.4, 0);
    } else {
      const [f1, f2] = game.fighters;
      f1.pose(t); f2.pose(t); updateCamera();
      $('hp1').style.width = (f1.hp / f1.maxHp * 100) + '%';
      $('hp2').style.width = (f2.hp / f2.maxHp * 100) + '%';
      $('mt1').style.width = f1.meter + '%'; $('mt2').style.width = f2.meter + '%';
      $('mt1').classList.toggle('full', f1.meter >= 100); $('mt2').classList.toggle('full', f2.meter >= 100);
      $('timer').textContent = Math.ceil(game.timer);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
