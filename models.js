/* ============================================================
 *  models.js — สร้างโมเดลตัวละคร 3D จากค่า look ใน characters.js
 *  ทุกชิ้นสร้างจากรูปทรงพื้นฐานของ Three.js (ไม่ต้องใช้ไฟล์โมเดล)
 * ============================================================ */
(function () {
  'use strict';

  const DEFAULT_LOOK = {
    skin: '#e8b996', hair: '#2a1d16', hairStyle: 'short', eyes: '#3a2a20',
    top: null, bottom: '#2b2f3a', boots: '#1b1b1f', accent: '#d9d9d9',
    cape: null, scarf: null, weapon: 'none', build: 'normal'
  };
  const BUILD = { slim: [0.92, 0.95], normal: [1, 1], heavy: [1.22, 1.08] }; // [ความกว้าง, ความสูง]

  function mat(hex, rough, metal) {
    const c = new THREE.Color(hex); if (c.convertSRGBToLinear) c.convertSRGBToLinear();
    return new THREE.MeshStandardMaterial({ color: c, roughness: rough == null ? 0.6 : rough, metalness: metal || 0 });
  }
  function mesh(geo, m, parent, x, y, z) {
    const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  function group(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); parent.add(g); return g; }
  // ทรงกระบอกที่ "ห้อยลง" จากจุดหมุน
  function limb(parent, rTop, rBot, len, m, y0) {
    return mesh(new THREE.CylinderGeometry(rTop, rBot, len, 14), m, parent, 0, (y0 || 0) - len / 2, 0);
  }

  function buildHair(head, L, m) {
    const s = L.hairStyle;
    if (s === 'bald') return;
    // หมวกผมครึ่งบน
    const cap = mesh(new THREE.SphereGeometry(0.218, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), m, head, -0.01, 0.02, 0);
    cap.scale.set(1.04, 1.06, 1.04);
    if (s === 'short' || s === 'spiky') {
      // ผมหน้าม้าเป็นแฉก
      for (let i = -2; i <= 2; i++) {
        const fr = mesh(new THREE.ConeGeometry(0.05, 0.16, 6), m, head, 0.17, 0.08, i * 0.06);
        fr.rotation.z = Math.PI * 0.62; fr.rotation.x = i * 0.12;
      }
      // ผมข้าง
      [-1, 1].forEach(sd => { const sb = mesh(new THREE.BoxGeometry(0.16, 0.16, 0.05), m, head, -0.02, -0.02, sd * 0.2); sb.rotation.x = sd * 0.1; });
    }
    if (s === 'spiky') {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const sp = mesh(new THREE.ConeGeometry(0.06, 0.24, 6), m, head, Math.cos(a) * 0.1 - 0.03, 0.2, Math.sin(a) * 0.1);
        sp.rotation.z = -Math.cos(a) * 0.7; sp.rotation.x = Math.sin(a) * 0.7;
      }
    }
    if (s === 'long') {
      const back = mesh(new THREE.BoxGeometry(0.1, 0.55, 0.38), m, head, -0.15, -0.22, 0); back.rotation.z = -0.12;
      [-1, 1].forEach(sd => mesh(new THREE.BoxGeometry(0.12, 0.42, 0.05), m, head, 0.02, -0.16, sd * 0.2));
    }
    if (s === 'topknot') {
      mesh(new THREE.SphereGeometry(0.09, 14, 10), m, head, -0.08, 0.24, 0);
      mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), mat('#c0392b'), head, -0.06, 0.18, 0).rotation.x = Math.PI / 2;
    }
  }

  function buildWeapon(hand, kind, metal, grip) {
    if (kind === 'dagger2' || kind === 'sword') {
      const len = kind === 'sword' ? 0.95 : 0.5;
      const w = group(hand, 0.02, -0.04, 0);
      mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8), grip, w, 0, 0, 0).rotation.z = Math.PI / 2;
      mesh(new THREE.BoxGeometry(0.03, 0.12, 0.05), metal, w, 0.08, 0, 0);
      const blade = mesh(new THREE.BoxGeometry(len, 0.05, 0.012), metal, w, 0.08 + len / 2, 0, 0);
      const tip = mesh(new THREE.ConeGeometry(0.025, 0.1, 4), metal, w, 0.13 + len, 0, 0);
      tip.rotation.z = -Math.PI / 2; tip.scale.z = 0.3;
      blade.userData.blade = true;
      return w;
    }
    if (kind === 'gauntlet') {
      mesh(new THREE.BoxGeometry(0.17, 0.15, 0.17), metal, hand, 0, 0, 0);
      return null;
    }
    return null;
  }

  window.buildFighterModel = function (def) {
    const L = Object.assign({}, DEFAULT_LOOK, { top: def.color }, def.look || {});
    const [bw, bh] = BUILD[L.build] || BUILD.normal;
    const M = {
      skin: mat(L.skin, 0.55), hair: mat(L.hair, 0.45), top: mat(L.top, 0.55), bottom: mat(L.bottom, 0.7),
      boots: mat(L.boots, 0.4, 0.1), accent: mat(L.accent, 0.4, 0.2), metal: mat('#dfe6ee', 0.2, 0.95),
      grip: mat('#2a2a2e', 0.6), eyeWhite: mat('#f4f4f4', 0.3),
      eyes: new THREE.MeshStandardMaterial({ color: new THREE.Color(L.eyes), emissive: new THREE.Color(L.eyes), emissiveIntensity: 0 })
    };

    const g = new THREE.Group();
    const rig = group(g); rig.scale.set(bw, bh, bw);

    // ---- ลำตัว ----
    const torsoProfile = [[0.001, 0], [0.2, 0], [0.22, 0.12], [0.25, 0.4], [0.3, 0.6], [0.27, 0.7], [0.13, 0.76], [0.001, 0.77]]
      .map(p => new THREE.Vector2(p[0], p[1]));
    const torso = mesh(new THREE.LatheGeometry(torsoProfile, 20), M.top, rig, 0, 0.95, 0);
    torso.scale.z = 1.25; torso.scale.x = 0.72;
    mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.07, 20), M.accent, rig, 0, 0.98, 0).scale.set(0.74, 1, 1.27); // เข็มขัด
    mesh(new THREE.BoxGeometry(0.03, 0.06, 0.08), M.metal, rig, 0.155, 0.98, 0);                                    // หัวเข็มขัด
    const pelvis = mesh(new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.bottom, rig, 0, 0.96, 0);
    pelvis.scale.set(0.75, 0.6, 1.25);
    // คอปกเสื้อ + คอ
    mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.08, 14), M.top, rig, 0, 1.72, 0);
    mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 12), M.skin, rig, 0, 1.79, 0);

    // ---- หัว ----
    const head = group(rig, 0.01, 1.98, 0);
    const skull = mesh(new THREE.SphereGeometry(0.2, 24, 18), M.skin, head); skull.scale.set(1, 1.12, 0.95);
    mesh(new THREE.SphereGeometry(0.11, 14, 10), M.skin, head, 0.06, -0.1, 0).scale.set(1, 0.8, 1.2);   // คาง
    mesh(new THREE.ConeGeometry(0.025, 0.06, 6), M.skin, head, 0.2, -0.01, 0).rotation.z = -Math.PI / 2; // จมูก
    const eyeMeshes = [];
    [-1, 1].forEach(sd => {
      mesh(new THREE.SphereGeometry(0.034, 12, 8), M.eyeWhite, head, 0.17, 0.03, sd * 0.07).scale.set(0.5, 0.8, 1.2);
      eyeMeshes.push(mesh(new THREE.SphereGeometry(0.02, 10, 8), M.eyes, head, 0.188, 0.03, sd * 0.07));
      const brow = mesh(new THREE.BoxGeometry(0.02, 0.018, 0.07), M.hair, head, 0.185, 0.085, sd * 0.07);
      brow.rotation.x = -sd * 0.18;
    });
    [-1, 1].forEach(sd => mesh(new THREE.SphereGeometry(0.04, 10, 8), M.skin, head, -0.01, -0.01, sd * 0.19).scale.set(0.6, 1, 0.5)); // หู
    buildHair(head, L, M.hair);

    // ---- ผ้าพันคอ ----
    if (L.scarf) {
      const sm = mat(L.scarf, 0.8);
      mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 18), sm, rig, 0, 1.75, 0).rotation.x = Math.PI / 2;
      const tail = mesh(new THREE.BoxGeometry(0.04, 0.4, 0.12), sm, rig, -0.13, 1.55, 0.08); tail.rotation.z = 0.25;
    }

    // ---- แขน ----
    function arm(z) {
      const sh = group(rig, 0, 1.64, z);
      mesh(new THREE.SphereGeometry(0.095, 14, 10), M.top, sh);          // หัวไหล่
      limb(sh, 0.075, 0.065, 0.33, M.top, 0);                            // ต้นแขน
      mesh(new THREE.SphereGeometry(0.063, 12, 8), M.top, sh, 0, -0.34, 0);
      limb(sh, 0.062, 0.05, 0.3, M.top, -0.34);                          // ปลายแขน
      mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.06, 12), M.accent, sh, 0, -0.62, 0); // ข้อมือ
      const hand = group(sh, 0, -0.7, 0);
      const palm = mesh(new THREE.SphereGeometry(0.06, 12, 10), M.skin, hand); palm.scale.set(1.1, 1.2, 0.8);
      if (L.build === 'heavy') mesh(new THREE.SphereGeometry(0.11, 14, 10), M.accent, sh, 0, 0.02, 0).scale.set(1, 0.7, 1); // เกราะไหล่
      return { sh, hand };
    }
    const aF = arm(0.31), aB = arm(-0.31);
    const weapons = [];
    if (L.weapon === 'dagger2') { weapons.push(buildWeapon(aF.hand, 'dagger2', M.metal, M.grip), buildWeapon(aB.hand, 'dagger2', M.metal, M.grip)); }
    else if (L.weapon === 'sword') weapons.push(buildWeapon(aF.hand, 'sword', M.metal, M.grip));
    else if (L.weapon === 'gauntlet') { buildWeapon(aF.hand, 'gauntlet', M.accent); buildWeapon(aB.hand, 'gauntlet', M.accent); }

    // ---- ขา ----
    function leg(z) {
      const hip = group(rig, 0, 0.93, z);
      limb(hip, 0.105, 0.08, 0.44, M.bottom, 0);                          // ต้นขา
      mesh(new THREE.SphereGeometry(0.08, 12, 8), M.bottom, hip, 0, -0.45, 0);
      limb(hip, 0.078, 0.06, 0.2, M.bottom, -0.45);                       // หน้าแข้งส่วนบน
      limb(hip, 0.085, 0.075, 0.24, M.boots, -0.62);                      // บูท
      const foot = mesh(new THREE.BoxGeometry(0.26, 0.08, 0.13), M.boots, hip, 0.06, -0.89, 0);
      foot.geometry.translate(0, 0, 0);
      return hip;
    }
    const lF = leg(0.12), lB = leg(-0.12);

    // ---- ผ้าคลุม (ครึ่งไหล่) ----
    let cape = null;
    if (L.cape) {
      const cm = mat(L.cape, 0.85); cm.side = THREE.DoubleSide;
      cape = group(rig, -0.2, 1.7, 0.04);
      const geo = new THREE.PlaneGeometry(0.62, 0.95, 4, 6);
      geo.translate(0, -0.475, 0);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {                                // ตัดชายผ้าให้เฉียง + โค้งรับหลัง
        const y = pos.getY(i), z = pos.getX(i);
        pos.setY(i, y + (z > 0 ? z * 0.35 : 0));
        pos.setZ(i, -Math.abs(z) * 0.18);
      }
      geo.computeVertexNormals();
      const cl = mesh(geo, cm, cape); cl.rotation.y = Math.PI / 2;
      mesh(new THREE.SphereGeometry(0.035, 10, 8), M.metal, rig, 0.12, 1.66, 0.2);   // กระดุมผ้าคลุม
    }

    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    return {
      g, rig, armF: aF.sh, armB: aB.sh, legF: lF, legB: lB, head, cape, weapons,
      flashMat: M.top, eyeMat: M.eyes, eyeColor: L.eyes
    };
  };
})();
