/* ============================================================
 *  characters.js — ไฟล์เดียวที่ต้องแก้เวลาเพิ่มตัวละคร
 *  แก้เสร็จให้รัน:  node check-bot.js   (หรือดูแท็บ Actions บน GitHub)
 *
 *  ปุ่มใน input (คั่นด้วยช่องว่าง, ปุ่มโจมตีต้องอยู่ท้ายสุด):
 *    ทิศ:  U = เดินเข้าจอ  D = เดินออกจอ  F = เข้าหาคู่ต่อสู้  B = ถอยหลัง
 *    ปุ่ม: P = ต่อย  K = เตะ  S = สกิล1  E = สกิล2  R = อัลติ
 *    เช่น  "P"  |  "S"  |  "D F S"  (ออกจอ → หน้า → สกิล1)
 *
 *  ค่าในแต่ละท่า
 *    anim     : punch, kick, uppercut, special, grapple, xslash, spin
 *    type     : melee (ปกติ), projectile (ยิง), grapple (ยิงสลิงพุ่งเข้าหา), spin (หมุนตีรอบตัวหลายครั้ง)
 *    vfx      : none, arc (แสงฟัน), x (แสงรูปตัว X), ring (วงแหวนใบมีด)
 *    ultimate : true = ใช้ได้เมื่อเกจอัลติเต็ม
 *    เฟรม: เกมวิ่ง 60 เฟรม/วินาที  startup = ก่อนท่าออก  active = ช่วงที่ตีโดน  recovery = ค้างหลังตี
 *
 *  ค่าตัวละคร
 *    price : จำนวนเพชรที่ต้องใช้ปลดล็อก (ไม่ใส่ = ฟรี)
 *    look  : หน้าตาโมเดล — hairStyle: short | spiky | long | topknot | bald
 *            weapon: none | dagger2 | sword | gauntlet   build: slim | normal | heavy
 *            สี: skin hair eyes top bottom boots accent cape scarf  (cape/scarf ใส่ null = ไม่มี)
 * ============================================================ */

window.CHARACTERS = [
  {
    id: "blaze",
    name: "Blaze",
    color: "#e4572e",
    role: "สายบุก",
    description: "สายบุกสมดุล มีลูกไฟ",
    look: { hair: "#3b2416", hairStyle: "spiky", top: "#c8452a", bottom: "#2d2d38", boots: "#1a1a1a", accent: "#ffd166", scarf: "#ffd166", weapon: "gauntlet" },
    stats: { hp: 100, speed: 5, jump: 9, defense: 1.0 },
    moves: {
      jab:      { input: "P",     anim: "punch",    vfx: "arc", damage: 6,  range: 1.4, startup: 4,  active: 3, recovery: 8,  knockback: 0.2 },
      kick:     { input: "K",     anim: "kick",     damage: 9,  range: 1.7, startup: 7,  active: 4, recovery: 14, knockback: 0.5 },
      fireball: { input: "S",     anim: "special",  type: "projectile", damage: 12, range: 0, startup: 12, active: 2, recovery: 22, projectileSpeed: 9 },
      rising:   { input: "E",     anim: "uppercut", vfx: "arc", damage: 14, range: 1.5, startup: 5,  active: 6, recovery: 24, knockback: 1.2 },
      inferno:  { input: "R",     anim: "special",  type: "projectile", ultimate: true, damage: 30, range: 0, startup: 14, active: 2, recovery: 26, projectileSpeed: 12, knockback: 2 }
    }
  },
  {
    id: "frost",
    name: "Frost",
    color: "#3a86ff",
    role: "สายเร็ว",
    description: "ตัวเร็ว ดาเมจเบา ระยะดาบไกล",
    look: { skin: "#f1d3bd", hair: "#cfe3ff", hairStyle: "long", eyes: "#3a86ff", top: "#2f6fd6", bottom: "#1d2a4a", boots: "#e8eef7", accent: "#cfe3ff", weapon: "sword", build: "slim" },
    stats: { hp: 90, speed: 6.5, jump: 10, defense: 0.9 },
    moves: {
      jab:       { input: "P",     anim: "punch",   vfx: "arc", damage: 5,  range: 1.6, startup: 3, active: 3, recovery: 6,  knockback: 0.15 },
      longkick:  { input: "K",     anim: "kick",    damage: 8,  range: 2.1, startup: 8, active: 4, recovery: 13, knockback: 0.6 },
      iceshard:  { input: "S",     anim: "special", type: "projectile", damage: 8, range: 0, startup: 9, active: 2, recovery: 18, projectileSpeed: 13 },
      dashpunch: { input: "F F P", anim: "punch",   vfx: "arc", damage: 11, range: 2.4, startup: 6, active: 5, recovery: 16, knockback: 0.9 },
      blizzard:  { input: "R",     anim: "spin",    type: "spin", vfx: "ring", ultimate: true, hits: 5, damage: 6, range: 2.6, startup: 8, active: 45, recovery: 18, knockback: 0.4 }
    }
  },
  {
    id: "titan",
    name: "Titan",
    color: "#8ac926",
    role: "สายถึก",
    description: "ตัวใหญ่ ช้า แต่ตีแรงและถึก",
    look: { skin: "#c98d64", hairStyle: "bald", eyes: "#2d1f12", top: "#6f9e22", bottom: "#3b3b2f", boots: "#2b2219", accent: "#8a8f98", weapon: "gauntlet", build: "heavy" },
    stats: { hp: 130, speed: 3.6, jump: 7, defense: 1.3 },
    moves: {
      hammer:   { input: "P",     anim: "punch",    damage: 10, range: 1.6, startup: 8,  active: 4, recovery: 14, knockback: 0.7 },
      stomp:    { input: "K",     anim: "kick",     damage: 13, range: 1.5, startup: 11, active: 5, recovery: 18, knockback: 1.0 },
      quake:    { input: "D D S", anim: "uppercut", vfx: "ring", damage: 20, range: 1.8, startup: 16, active: 6, recovery: 30, knockback: 1.8 },
      earthcut: { input: "R",     anim: "uppercut", vfx: "ring", ultimate: true, damage: 35, range: 2.4, startup: 20, active: 8, recovery: 30, knockback: 2.5 }
    }
  },
  {
    id: "kage",
    name: "KAGE",
    color: "#7a1f2b",
    role: "นักฆ่า",
    price: 300,
    description: "นักฆ่าเงา เร็วและแรงที่สุด แต่เลือดน้อย — ยิงสลิงพุ่งเข้าหา ฟันตัว X และหมุนพายุใบมีด",
    look: { skin: "#e9c3a4", hair: "#b8bcc6", hairStyle: "short", eyes: "#ff2a3d", top: "#1b2238", bottom: "#141a2c", boots: "#0d0f17", accent: "#5a6275", cape: "#7a1f2b", scarf: "#7a1f2b", weapon: "dagger2", build: "slim" },
    stats: { hp: 80, speed: 8.5, jump: 11, defense: 0.8 },
    moves: {
      slash:      { input: "P", anim: "punch",   vfx: "arc", damage: 8,  range: 1.7, startup: 3,  active: 3,  recovery: 7,  knockback: 0.25 },
      kick:       { input: "K", anim: "kick",    damage: 10, range: 1.8, startup: 5,  active: 4,  recovery: 11, knockback: 0.6 },
      grapple:    { input: "S", anim: "grapple", type: "grapple", vfx: "arc", reach: 10, damage: 16, range: 1.6, startup: 8, active: 4, recovery: 16, knockback: 0.9 },
      xslash:     { input: "E", anim: "xslash",  vfx: "x", damage: 22, range: 2.0, startup: 9, active: 5, recovery: 20, knockback: 1.4 },
      bladestorm: { input: "R", anim: "spin",    type: "spin", vfx: "ring", ultimate: true, hits: 6, damage: 7, range: 2.8, startup: 10, active: 60, recovery: 20, knockback: 0.5 }
    }
  }

  /* ---------- แม่แบบสำหรับตัวละครใหม่ (ลบเครื่องหมายคอมเมนต์เปิด-ปิดออก ตัวนี้มี comma นำหน้าให้แล้ว) ----------
  ,{
    id: "newguy",
    name: "New Guy",
    color: "#ffbe0b",
    price: 100,
    look: { hairStyle: "topknot", hair: "#222222", top: "#ffbe0b", weapon: "none" },
    stats: { hp: 100, speed: 5, jump: 9, defense: 1 },
    moves: {
      jab:  { input: "P", anim: "punch", damage: 6, range: 1.4, startup: 4, active: 3, recovery: 8 },
      kick: { input: "K", anim: "kick",  damage: 9, range: 1.7, startup: 7, active: 4, recovery: 14 }
    }
  }
  ------------------------------------------------------------------------------------------------- */
];
