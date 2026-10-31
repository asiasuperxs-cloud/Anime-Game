/* ============================================================
 *  CheckBot — ตัวตรวจ characters.js
 *  ใช้ได้ทั้งในเบราว์เซอร์ (window.CheckBot) และใน Node (require)
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CheckBot = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BUTTONS = ['P', 'K', 'S'];          // ต่อย / เตะ / ท่าพิเศษ
  const DIRS = ['U', 'D', 'F', 'B'];        // ขึ้น / ลง / หน้า / หลัง
  const ARROWS = { '→': 'F', '←': 'B', '↓': 'D', '↑': 'U' };

  const CHAR_REQUIRED = { id: 'string', name: 'string', color: 'string', stats: 'object', moves: 'object' };
  const CHAR_OPTIONAL = { description: 'string' };
  const STAT_RANGES = { hp: [1, 1000], speed: [0.5, 15], jump: [3, 20], defense: [0.2, 3] };

  const MOVE_REQUIRED = { input: 'string', damage: 'number', range: 'number', startup: 'number', active: 'number', recovery: 'number' };
  const MOVE_OPTIONAL = { anim: 'string', knockback: 'number', projectile: 'boolean', projectileSpeed: 'number', description: 'string' };
  const MOVE_RANGES = { damage: [0, 50], range: [0, 4], startup: [1, 60], active: [1, 30], recovery: [0, 90], knockback: [0, 3], projectileSpeed: [2, 30] };
  const ANIMS = ['punch', 'kick', 'uppercut', 'special'];

  const EXAMPLES = {
    id: 'id: "blaze"', name: 'name: "Blaze"', color: 'color: "#e4572e"',
    stats: 'stats: { hp: 100, speed: 5, jump: 9, defense: 1 }', moves: 'moves: { jab: {...} }',
    hp: 'hp: 100', speed: 'speed: 5', jump: 'jump: 9', defense: 'defense: 1',
    input: 'input: "P"  หรือ  input: "D F S"', damage: 'damage: 8', range: 'range: 1.4',
    startup: 'startup: 5', active: 'active: 3', recovery: 'recovery: 10'
  };

  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'number' && Number.isNaN(v)) return 'NaN';
    return typeof v;
  }

  function lev(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  function suggest(word, list) {
    let best = null, bestD = 3;
    list.forEach(w => { const dd = lev(word, w); if (dd < bestD) { bestD = dd; best = w; } });
    return best;
  }

  function validate(chars) {
    const issues = [];
    const add = (level, where, msg, fix) => issues.push({ level, where, msg, fix: fix || '' });
    const errCount = () => issues.filter(x => x.level === 'error').length;

    if (!Array.isArray(chars)) {
      add('error', 'characters.js', 'window.CHARACTERS ต้องเป็น array [ ... ]', 'เขียนเป็น  window.CHARACTERS = [ { ... }, { ... } ];');
      return finish();
    }
    if (chars.length < 2) add('warn', 'characters.js', `มีตัวละครแค่ ${chars.length} ตัว — ต้องมีอย่างน้อย 2 ตัวถึงจะสู้กันได้`);

    const seenIds = {};
    const validIndexes = [];

    chars.forEach((c, i) => {
      const before = errCount();
      const who = (c && typeof c.id === 'string' && c.id) ? `ตัวละคร "${c.id}"` : `ตัวละครลำดับที่ ${i + 1}`;

      if (typeOf(c) !== 'object') {
        add('error', who, `ต้องเป็น object { ... } แต่เจอ ${typeOf(c)}`, 'ดูว่ามี comma เกิน หรือใส่ค่าผิดใน array หรือไม่');
        return;
      }

      checkFields(c, CHAR_REQUIRED, CHAR_OPTIONAL, who);

      if (typeof c.id === 'string') {
        if (!/^[a-z0-9_-]+$/.test(c.id)) add('error', who, `id "${c.id}" ต้องเป็นตัวพิมพ์เล็กภาษาอังกฤษ/ตัวเลข/ขีด เท่านั้น`, 'เช่น  id: "iron_fist"');
        if (seenIds[c.id]) add('error', who, `id "${c.id}" ซ้ำกับตัวละครลำดับที่ ${seenIds[c.id]}`, 'เปลี่ยน id ให้ไม่ซ้ำกัน');
        else seenIds[c.id] = i + 1;
      }
      if (typeof c.color === 'string' && !/^#[0-9a-fA-F]{6}$/.test(c.color))
        add('error', who, `color "${c.color}" ไม่ใช่รหัสสีที่ถูกต้อง`, 'ใช้รูปแบบ #RRGGBB เช่น  color: "#3a86ff"');

      // ---- stats ----
      if (typeOf(c.stats) === 'object') {
        const req = {}; Object.keys(STAT_RANGES).forEach(k => req[k] = 'number');
        checkFields(c.stats, req, {}, `${who} › stats`);
        checkRanges(c.stats, STAT_RANGES, `${who} › stats`);
      }

      // ---- moves ----
      if (typeOf(c.moves) === 'object') {
        const names = Object.keys(c.moves);
        if (names.length === 0) add('error', `${who} › moves`, 'ยังไม่มีท่าเลย', 'เพิ่มอย่างน้อย 1 ท่า เช่น  jab: { input: "P", damage: 6, range: 1.4, startup: 4, active: 3, recovery: 8 }');
        const inputs = {};
        names.forEach(name => {
          const m = c.moves[name];
          const where = `${who} › ท่า "${name}"`;
          if (typeOf(m) !== 'object') { add('error', where, `ท่าต้องเป็น object { ... } แต่เจอ ${typeOf(m)}`); return; }
          checkFields(m, MOVE_REQUIRED, MOVE_OPTIONAL, where);
          checkRanges(m, MOVE_RANGES, where);

          if (typeof m.input === 'string') {
            const norm = checkInput(m.input, where);
            if (norm) {
              if (inputs[norm]) add('error', where, `ปุ่มกด "${norm}" ชนกับท่า "${inputs[norm]}" — เกมจะไม่รู้ว่าจะออกท่าไหน`, 'เปลี่ยน input ของท่าใดท่าหนึ่ง');
              else inputs[norm] = name;
            }
          }
          if (m.anim !== undefined && typeof m.anim === 'string' && !ANIMS.includes(m.anim)) {
            const s = suggest(m.anim, ANIMS);
            add('error', where, `anim "${m.anim}" ไม่มีในเกม${s ? ` — หมายถึง "${s}" ใช่ไหม?` : ''}`, `ใช้ได้: ${ANIMS.join(', ')}`);
          }
          if (m.projectile === true) {
            if (typeof m.projectileSpeed !== 'number') add('error', where, 'เป็นท่ายิง (projectile: true) แต่ขาด projectileSpeed', 'เพิ่ม  projectileSpeed: 9');
          } else {
            if (m.projectileSpeed !== undefined) add('warn', where, 'มี projectileSpeed แต่ไม่ได้ตั้ง projectile: true — ค่านี้จะไม่ถูกใช้');
            if (typeof m.range === 'number' && m.range <= 0) add('error', where, 'range เป็น 0 — ท่าประชิดตัวจะตีไม่โดนใครเลย', 'ตั้ง range ประมาณ 1.2 – 2.0');
          }
          if (typeof m.damage === 'number' && m.damage === 0) add('warn', where, 'damage เป็น 0 — ท่านี้ไม่ทำดาเมจ');
          const total = ['startup', 'active', 'recovery'].reduce((s, k) => s + (typeof m[k] === 'number' ? m[k] : 0), 0);
          if (total > 120) add('warn', where, `ท่านี้ยาว ${total} เฟรม (~${(total / 60).toFixed(1)} วินาที) — ช้ามาก โดนสวนง่าย`);
        });
        if (!Object.keys(inputs).includes('P')) add('warn', `${who} › moves`, 'ไม่มีท่าที่กดปุ่ม "P" ปุ่มเดียว — กดต่อยเฉย ๆ จะไม่มีอะไรเกิดขึ้น');
      }

      if (errCount() === before) validIndexes.push(i);
    });

    return finish(validIndexes);

    // ---------- helpers ----------
    function checkFields(obj, required, optional, where) {
      Object.keys(required).forEach(k => {
        if (!(k in obj)) add('error', where, `ขาด field "${k}" (ต้องเป็น ${required[k]})`, EXAMPLES[k] ? `เพิ่ม  ${EXAMPLES[k]}` : '');
        else if (typeOf(obj[k]) !== required[k]) {
          let fix = EXAMPLES[k] ? `ตัวอย่าง  ${EXAMPLES[k]}` : '';
          if (required[k] === 'number' && typeof obj[k] === 'string' && obj[k].trim() !== '' && !isNaN(+obj[k])) fix = `เอาเครื่องหมายคำพูดออก: ${k}: ${obj[k]}`;
          add('error', where, `"${k}" ต้องเป็น ${required[k]} แต่เจอ ${typeOf(obj[k])} (${JSON.stringify(obj[k])})`, fix);
        }
      });
      Object.keys(optional).forEach(k => {
        if (k in obj && typeOf(obj[k]) !== optional[k]) add('error', where, `"${k}" ต้องเป็น ${optional[k]} แต่เจอ ${typeOf(obj[k])}`);
      });
      const known = Object.keys(required).concat(Object.keys(optional));
      Object.keys(obj).forEach(k => {
        if (known.includes(k)) return;
        const s = suggest(k, known);
        add('warn', where, `ไม่รู้จัก field "${k}"${s ? ` — พิมพ์ผิดจาก "${s}" หรือเปล่า?` : ' (เกมจะไม่สนใจค่านี้)'}`, s ? `แก้เป็น  ${s}: ...` : '');
      });
    }

    function checkRanges(obj, ranges, where) {
      Object.keys(ranges).forEach(k => {
        if (typeof obj[k] !== 'number' || Number.isNaN(obj[k])) return;
        const [lo, hi] = ranges[k];
        if (obj[k] < lo || obj[k] > hi) add('error', where, `"${k}" = ${obj[k]} อยู่นอกช่วงที่เกมรับได้ (${lo} – ${hi})`);
      });
    }

    function checkInput(input, where) {
      const raw = input.trim();
      if (!raw) { add('error', where, 'input ว่างเปล่า', 'เช่น  input: "P"'); return null; }
      const tokens = raw.split(/\s+/);
      const all = BUTTONS.concat(DIRS);
      let ok = true;
      tokens.forEach((t, idx) => {
        if (all.includes(t)) return;
        ok = false;
        let fix = `ใช้ได้เฉพาะ ${DIRS.join(' ')} (ทิศ) และ ${BUTTONS.join(' ')} (ปุ่ม) คั่นด้วยช่องว่าง`;
        if (all.includes(t.toUpperCase())) fix = `ใช้ตัวพิมพ์ใหญ่: "${t.toUpperCase()}"`;
        else if (ARROWS[t]) fix = `ใช้ตัวอักษรแทนลูกศร: "${ARROWS[t]}"`;
        else if (t.length > 1 && t.split('').every(ch => all.includes(ch.toUpperCase()))) fix = `ต้องเว้นวรรคระหว่างปุ่ม: "${t.toUpperCase().split('').join(' ')}"`;
        add('error', where, `input "${input}" มีปุ่ม "${t}" (ตำแหน่งที่ ${idx + 1}) ที่เกมไม่รู้จัก`, fix);
      });
      if (!ok) return null;
      const last = tokens[tokens.length - 1];
      if (!BUTTONS.includes(last)) { add('error', where, `input "${input}" ต้องจบด้วยปุ่มโจมตี P / K / S`, `เช่น  "${tokens.join(' ')} P"`); return null; }
      if (tokens.slice(0, -1).some(t => BUTTONS.includes(t))) { add('error', where, `input "${input}" มีปุ่มโจมตีอยู่กลางคำสั่ง — ปุ่มโจมตีต้องอยู่ท้ายสุดและมีแค่ปุ่มเดียว`); return null; }
      if (tokens.length > 5) add('warn', where, `คำสั่งยาว ${tokens.length} ปุ่ม — กดยากมาก (เกมรับคำสั่งภายใน 0.7 วินาที)`);
      return tokens.join(' ');
    }

    function finish(valid) {
      return {
        issues,
        validIndexes: valid || [],
        errors: issues.filter(x => x.level === 'error').length,
        warnings: issues.filter(x => x.level === 'warn').length
      };
    }
  }

  return { validate, BUTTONS, DIRS, ANIMS };
});
