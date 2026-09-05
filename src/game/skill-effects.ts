import type Phaser from 'phaser';
import type { ActiveEffect, Detail } from './presentation';
import { bolt, burst, colorOf, glow, laser, line, polygon, reticle, type Origin } from './effects';

/** Immediate release, sustained signature, then an afterglow. Damage timing stays in the simulation. */
export function drawSkill(g: Phaser.GameObjects.Graphics, fx: ActiveEffect, now: number, detail: Detail, origin: Origin) {
  const e = fx.event, t = Math.max(0, Math.min(1, (now - fx.born) / fx.duration));
  const a = t < .6 ? 1 : (1 - t) / .4, release = Math.max(0, 1 - t / .28);
  const c = e.color?parseInt(e.color.slice(1),16):colorOf(e.source), compact = detail === 'compact', r = e.radius ?? 90;
  // A steady peripheral signal, with the top warning area left open.
  for (const x of [7, 383]) {
    line(g, [{ x, y: 92 }, { x, y: 309 }], c, 4, a * .45);
    line(g, [{ x: x < 195 ? 27 : 363, y: 92 }, { x, y: 92 }, { x, y: 118 }], 0xeaffeb, 3, a);
  }
  if (e.source === 'C01') {
    reticle(g, e.x, e.y, r * (.8 + t * .2), 0xffdfaf, a);
    g.lineStyle(4, c, a * .65).strokeEllipse(e.x, e.y, r * 2, r * 1.1);
    // Four moving lanes identify the barrage; actual hits still come from its four scheduled pulses.
    for (let i = 0; i < 4; i++) {
      const x = e.x + (i - 1.5) * 26, y = e.y - 30 + Math.min(1, t * 1.6) * 65;
      laser(g, { x: x - 45, y: y - 130 }, { x, y }, e.damageType?c:0xffa16d, 7 + release * 5, a);
      glow(g, x, y, 15, c, a);
    }
    burst(g, e.x, e.y, r * (1 + t * .3), 0xffecc1, a * .8, compact ? 6 : 10);
  } else if (e.source === 'C02') {
    const rows = compact ? 4 : 6;
    for (let i = 0; i < rows; i++) {
      const y = 102 + i * 39;
      bolt(g, { x: 24, y }, { x: 366, y: y + 22 }, c, a, i + t * 7, compact);
      if (i % 2 === 0) glow(g, 85 + i * 38, y, 19, 0xe3c3ff, a);
    }
    const y = 95 + t * 215;
    laser(g, { x: 18, y }, { x: 372, y }, 0xe4caff, 9, a * .85);
    polygon(g, 195, 208, 66 + t * 68, 6, c, a * .8, Math.PI / 6, 4);
  } else if (e.source === 'C03') {
    const from = origin(e.source, e.x);
    laser(g, from, e, e.damageType?c:0x9ddcff, 12 + release * 16, a);
    glow(g, e.x, e.y, 30 + release * 20, 0xd2f3ff, a);
    reticle(g, e.x, e.y, 32 + t * 44, 0xe1faff, a);
    polygon(g, e.x, e.y, 40 + t * 38, 4, 0x8acfff, a, Math.PI / 4, 4);
    laser(g, { x: e.x - 48, y: e.y + 48 }, { x: e.x + 48, y: e.y - 48 }, 0xe2ffff, 5, a);
    burst(g, e.x, e.y, 48 + t * 55, 0xc3eaff, a, compact ? 6 : 10, Math.PI / 8);
  } else if (e.source === 'C04') {
    glow(g, 195, 250, 55, c, a * .7);
    for (let i = 0; i < 3; i++) {
      const radius = 55 + i * 35 + t * 48;
      g.fillStyle(c, a * .035).fillEllipse(195, 245, radius * 2, radius);
      g.lineStyle(i === 1 ? 5 : 3, i === 1 ? 0xbeffea : c, a * .85).strokeEllipse(195, 245, radius * 2, radius);
    }
    polygon(g, 195, 245, 42 + t * 12, 6, 0xd0fff0, a, -t * 1.1, 3);
    for (let x = 55; x <= 335; x += 70) {
      const y = 292 - t * 130;
      line(g, [{ x: x - 13, y: y + 17 }, { x, y }, { x: x + 13, y: y + 17 }], 0xc0ffee, 5, a);
      line(g, [{ x, y: y + 48 }, { x, y: y + 18 }], c, 3, a * .7);
    }
  } else if (e.source === 'C05') {
    const radius = r * (.45 + Math.sqrt(t) * .9);
    laser(g, { x: e.x, y: Math.min(72, e.y - 90) }, e, 0xffb144, 10 + release * 24, a * .8);
    glow(g, e.x, e.y, r * (.48 + release * .3), 0xffa231, a);
    g.fillStyle(0xffcc70, a * .16).fillCircle(e.x, e.y, radius * .8);
    g.lineStyle(6, 0xffe7aa, a).strokeCircle(e.x, e.y, radius);
    g.lineStyle(3, c, a).strokeEllipse(e.x, e.y, radius * 2.3, radius * .7);
    for (let i = 0; i < (compact ? 8 : 12); i++) {
      const angle = i * Math.PI * 2 / (compact ? 8 : 12), ux = Math.cos(angle), uy = Math.sin(angle);
      const base = radius * .38, tip = radius * (1.05 + i % 3 * .12), width = 6 * (1 - t) + 2;
      g.fillStyle(i % 2 ? c : 0xffe8a5, a).fillTriangle(e.x + ux * base - uy * width, e.y + uy * base + ux * width, e.x + ux * base + uy * width, e.y + uy * base - ux * width, e.x + ux * tip, e.y + uy * tip);
    }
  } else if (e.source === 'C07') {
    for(let i=0;i<(compact?4:7);i++){const x=55+i*280/(compact?3:6),y=190+(i%2)*72;polygon(g,x,y,20+t*38,6,c,a,Math.PI/6,3);burst(g,x,y,12+t*48,c,a,6);line(g,[{x:195,y:410},{x,y}],c,2,a*.6);}
  } else if (e.source === 'C08') {
    const from=origin(e.source,e.x);glow(g,from.x,from.y,28+release*35,c,a);for(let i=0;i<5;i++){const x=from.x+(i-2)*20;line(g,[{x,y:from.y},{x:x+(i-2)*12,y:from.y-85-t*85}],c,4,a);}
    polygon(g,from.x,from.y,28+t*42,8,c,a,-t*2,4);
  } else if (e.source === 'C06') {
    // Raise the canopy above the portrait strip so the defensive skill remains visible.
    g.fillStyle(0x8dffe6, a * .10).fillRect(15, 271, 360, 160);
    for (let row = 0; row < (compact ? 2 : 3); row++) for (let i = 0; i < 7; i++) {
      polygon(g, 30 + i * 55, 294 + row * 47 - t * 12, 28, 6, 0xc4fff3, a * (row ? .55 : 1), Math.PI / 6, row ? 2 : 4);
    }
    laser(g, { x: 14, y: 268 }, { x: 376, y: 268 }, 0xafffe8, 5 + release * 5, a);
    for (const x of [55, 335]) {
      polygon(g, x, 244, 18, 3, 0xe9ffe7, a, -Math.PI / 2, 3);
      laser(g, { x, y: 244 }, { x: 195, y: 268 }, c, 3, a);
      glow(g, x, 244, 16, c, a);
    }
  }
}
