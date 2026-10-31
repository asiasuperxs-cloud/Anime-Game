#!/usr/bin/env node
/* ============================================================
 *  CheckBot (CLI) — ตรวจ characters.js ว่าขาดอะไร / ผิดตรงไหน
 *    node check-bot.js          ตรวจครั้งเดียว
 *    node check-bot.js --watch  ตรวจใหม่อัตโนมัติทุกครั้งที่กดเซฟ
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const CheckBot = require('./validator.js');

const FILE = path.join(__dirname, 'characters.js');
const C = { red: s => `\x1b[31m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m` };

function load() {
  const code = fs.readFileSync(FILE, 'utf8');
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(code, sandbox, { filename: 'characters.js', timeout: 1000 });
  } catch (e) {
    const m = String(e.stack || '').match(/characters\.js:(\d+)/);
    const line = m ? +m[1] : null;
    const lines = code.split('\n');
    let snippet = '';
    if (line) for (let i = Math.max(1, line - 2); i <= Math.min(lines.length, line + 1); i++)
      snippet += `${i === line ? '>' : ' '} ${String(i).padStart(4)} | ${lines[i - 1]}\n`;
    return { fatal: { line, msg: e.message, snippet } };
  }
  return { chars: sandbox.window.CHARACTERS };
}

function run() {
  const stamp = new Date().toLocaleTimeString('th-TH');
  console.log(C.bold(`\n== CheckBot ${stamp} ==`));
  const { chars, fatal } = load();
  if (fatal) {
    console.log(C.red(`ERROR  characters.js อ่านไม่ได้${fatal.line ? ` (บรรทัด ${fatal.line})` : ''}: ${fatal.msg}`));
    if (fatal.snippet) console.log(C.dim(fatal.snippet));
    console.log(C.green('  วิธีแก้: เช็ก comma ระหว่างตัวละคร/ท่า, วงเล็บ { } [ ] ให้ครบคู่, และเครื่องหมาย " ให้ปิดครบ'));
    console.log(C.dim('  (ถ้าบรรทัดที่ชี้ดูถูก ให้ดูบรรทัดก่อนหน้า — มักลืม comma ตรงนั้น)'));
    return 1;
  }
  const r = CheckBot.validate(chars);
  r.issues.forEach(i => {
    const tag = i.level === 'error' ? C.red('ERROR') : C.yellow('WARN ');
    console.log(`${tag}  ${i.where}: ${i.msg}`);
    if (i.fix) console.log(C.green(`       วิธีแก้: ${i.fix}`));
  });
  const n = Array.isArray(chars) ? chars.length : 0;
  console.log(r.errors
    ? C.red(`\nไม่ผ่าน: ${r.errors} error, ${r.warnings} คำเตือน — ใช้ได้ ${r.validIndexes.length}/${n} ตัว`)
    : C.green(`\nผ่าน ✓ ตัวละคร ${n} ตัว` + (r.warnings ? C.yellow(` (มี ${r.warnings} คำเตือน)`) : '')));
  return r.errors ? 1 : 0;
}

if (process.argv.includes('--watch')) {
  run();
  console.log(C.dim('กำลังเฝ้าดู characters.js ... (Ctrl+C เพื่อหยุด)'));
  fs.watchFile(FILE, { interval: 400 }, () => run());
} else {
  process.exit(run());
}
