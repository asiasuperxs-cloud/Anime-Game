/* ============================================================
 *  characters.js — ไฟล์เดียวที่ต้องแก้เวลาเพิ่มตัวละคร
 *  แก้เสร็จให้รัน:  node check-bot.js   (หรือ npm run check)
 *
 *  ปุ่มใน input (คั่นด้วยช่องว่าง, ปุ่มโจมตีต้องอยู่ท้ายสุด):
 *    ทิศ:  U = ขึ้น   D = ลง   F = เดินหน้า (เข้าหาคู่ต่อสู้)   B = ถอยหลัง
 *    ปุ่ม: P = ต่อย   K = เตะ   S = ท่าพิเศษ
 *    เช่น  "P"  |  "K"  |  "D F S"  (ลง → หน้า → พิเศษ)
 *
 *  anim ที่มีให้ใช้: punch, kick, uppercut, special
 *  เฟรม: เกมวิ่ง 60 เฟรม/วินาที
 *    startup  = เฟรมก่อนท่าออก   active = เฟรมที่ตีโดนได้   recovery = เฟรมค้างหลังตี
 * ============================================================ */

window.CHARACTERS = [
  {
    id: "blaze",
    name: "Blaze",
    color: "#e4572e",
    description: "สายบุกสมดุล มีลูกไฟ",
    stats: { hp: 100, speed: 5, jump: 9, defense: 1.0 },
    moves: {
      jab:      { input: "P",     anim: "punch",    damage: 6,  range: 1.4, startup: 4,  active: 3, recovery: 8,  knockback: 0.2 },
      kick:     { input: "K",     anim: "kick",     damage: 9,  range: 1.7, startup: 7,  active: 4, recovery: 14, knockback: 0.5 },
      fireball: { input: "D F S", anim: "special",  damage: 12, range: 0,   startup: 12, active: 2, recovery: 22, projectile: true, projectileSpeed: 9 },
      rising:   { input: "F D P", anim: "uppercut", damage: 14, range: 1.5, startup: 5,  active: 6, recovery: 24, knockback: 1.2 }
    }
  },
  {
    id: "frost",
    name: "Frost",
    color: "#3a86ff",
    description: "ตัวเร็ว ดาเมจเบา ระยะเตะไกล",
    stats: { hp: 90, speed: 6.5, jump: 10, defense: 0.9 },
    moves: {
      jab:       { input: "P",   anim: "punch",   damage: 5,  range: 1.3, startup: 3, active: 3, recovery: 6,  knockback: 0.15 },
      longkick:  { input: "K",   anim: "kick",    damage: 8,  range: 2.1, startup: 8, active: 4, recovery: 13, knockback: 0.6 },
      iceshard:  { input: "S",   anim: "special", damage: 8,  range: 0,   startup: 9, active: 2, recovery: 18, projectile: true, projectileSpeed: 13 },
      dashpunch: { input: "F F P", anim: "punch", damage: 11, range: 2.4, startup: 6, active: 5, recovery: 16, knockback: 0.9 }
    }
  },
  {
    id: "titan",
    name: "Titan",
    color: "#8ac926",
    description: "ตัวใหญ่ ช้า แต่ตีแรงและถึก",
    stats: { hp: 130, speed: 3.6, jump: 7, defense: 1.3 },
    moves: {
      hammer: { input: "P",     anim: "punch",    damage: 10, range: 1.6, startup: 8,  active: 4, recovery: 14, knockback: 0.7 },
      stomp:  { input: "K",     anim: "kick",     damage: 13, range: 1.5, startup: 11, active: 5, recovery: 18, knockback: 1.0 },
      quake:  { input: "D D S", anim: "uppercut", damage: 20, range: 1.8, startup: 16, active: 6, recovery: 30, knockback: 1.8 }
    }
  }

  /* ---------- แม่แบบสำหรับตัวละครใหม่ (ลบเครื่องหมายคอมเมนต์เปิด-ปิดออก ตัวนี้มี comma นำหน้าให้แล้ว) ----------
  ,{
    id: "newguy",
    name: "New Guy",
    color: "#ffbe0b",
    stats: { hp: 100, speed: 5, jump: 9, defense: 1 },
    moves: {
      jab:  { input: "P", anim: "punch", damage: 6, range: 1.4, startup: 4, active: 3, recovery: 8 },
      kick: { input: "K", anim: "kick",  damage: 9, range: 1.7, startup: 7, active: 4, recovery: 14 }
    }
  }
  ------------------------------------------------------------------------------------------------- */
];
