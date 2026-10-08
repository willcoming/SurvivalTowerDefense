import type Phaser from 'phaser';
import { NaturalEffects } from './natural-effects';
import { hasUltimate } from '../sim/ultimates';
import { ultimateForForm, usesReworkedSkills } from '../data/reworked-skills';
import { attackType } from '../data/forms';
import type { CharacterId, DamageType, RunState, VisualEvent } from '../sim/types';

const ELEMENT_COLORS: Record<DamageType, number> = {
  thermal: 0xff8c42,
  plasma: 0x9b8fff,
  arc: 0x70d8ff,
  gravity: 0x5fe0bf,
  kinetic: 0xffdf88,
};

const ELEMENT_SPARK_COLORS: Record<DamageType, number> = {
  thermal: 0xffbe6b,
  plasma: 0xb8e3ff,
  arc: 0x9eecff,
  gravity: 0x8affdc,
  kinetic: 0xfff3c4,
};

interface CastBurst {
  x: number;
  y: number;
  born: number;
  duration: number;
  color: number;
}

export class UltimateEnergyEffects {
  private g: Phaser.GameObjects.Graphics;
  private glow: NaturalEffects;
  private bursts: CastBurst[] = [];
  private chargedCount = 0;
  private readyCount = 0;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(8);
    this.glow = new NaturalEffects(scene, 6, 64);
  }

  update(run: RunState, fresh: VisualEvent[], now: number, reduced: boolean) {
    this.g.clear();
    this.glow.begin();
    this.chargedCount = 0;
    this.readyCount = 0;

    // Detect fresh ultimate casts from squad members
    for (const e of fresh) {
      if (e.kind === 'tactical' && e.skill === 'ultimate' && e.source) {
        const ids = run.config.squadIds;
        const i = ids.indexOf(e.source as CharacterId);
        if (i >= 0) {
          const x = 195 + (i - (ids.length - 1) / 2) * 70;
          const type = attackType(run, e.source as CharacterId);
          this.bursts.push({
            x,
            y: 480,
            born: now,
            duration: 480,
            color: ELEMENT_COLORS[type] ?? 0xffdf6a,
          });
        }
      }
    }

    // Render ally ultimate cast bursts
    this.bursts = this.bursts.filter(b => now - b.born < b.duration);
    for (const b of this.bursts) {
      const t = (now - b.born) / b.duration;
      const alpha = 1 - t;
      this.glow.glow(b.x, b.y, 24 + t * 80, b.color, alpha * (reduced ? 0.45 : 0.85));
      this.glow.glow(b.x, b.y, 12 + t * 45, 0xffffff, alpha * (reduced ? 0.55 : 0.95));
      // Ring particle flare
      if (!reduced) {
        const flareCount = 6;
        for (let f = 0; f < flareCount; f++) {
          const a = f * Math.PI * 2 / flareCount + t * 2;
          const r = 16 + t * 48;
          this.g.fillStyle(0xfff8d6, alpha * 0.85).fillCircle(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 2.5);
        }
      }
    }

    if (!usesReworkedSkills(run)) {
      this.glow.end();
      return;
    }

    const squadIds = run.config.squadIds;
    squadIds.forEach((id, i) => {
      const x = 195 + (i - (squadIds.length - 1) / 2) * 70;
      const weapon = run.weapons.find(w => w.id === id);
      if (!weapon) return;

      const acquired = hasUltimate(run, id);
      if (!acquired) return;

      const duration = ultimateForForm(id, run.config.forms?.[id]).cooldown * 30;
      const progress = Math.max(0, Math.min(1, 1 - ((weapon.ultimateReadyAt ?? 0) - run.tick) / duration));
      const type = attackType(run, id);
      const color = ELEMENT_COLORS[type] ?? 0xffdf6a;
      const sparkColor = ELEMENT_SPARK_COLORS[type] ?? 0xffffff;

      if (progress < 1) {
        // CD Charging Phase: accumulating energy visual feedback
        this.chargedCount++;

        // 1. Floor energy pool (expands & brightens with progress)
        const poolSize = 22 + 24 * progress;
        const poolAlpha = (0.15 + 0.35 * progress) * (reduced ? 0.6 : 1);
        this.glow.glow(x, 506, poolSize, color, poolAlpha);

        // 2. Character body aura (subtle ambient glow building up)
        if (progress > 0.25) {
          const bodyGlowSize = 28 + 20 * progress;
          const bodyGlowAlpha = (0.08 + 0.22 * progress) * (reduced ? 0.5 : 0.8);
          this.glow.glow(x, 480, bodyGlowSize, color, bodyGlowAlpha);
        }

        // 3. Rising energy sparks (density and height increase with charge)
        if (!reduced) {
          const sparkCount = Math.floor(4 + 6 * progress);
          for (let s = 0; s < sparkCount; s++) {
            const seed = i * 13 + s * 19;
            const cycleRate = 0.0011 + 0.0009 * progress;
            const phase = (now * cycleRate + seed * 0.17) % 1;
            const sway = Math.sin(phase * Math.PI * 3 + seed) * (10 + 4 * progress);
            const sparkX = x + sway;
            const sparkY = 506 - phase * (24 + 32 * progress);
            const sparkAlpha = Math.sin(phase * Math.PI) * (0.45 + 0.55 * progress);
            const sparkSize = 1.6 + 1.2 * progress;

            // Outer soft glow for each spark
            this.g.fillStyle(color, sparkAlpha * 0.35).fillCircle(sparkX, sparkY, sparkSize * 1.8);
            // Core hot center
            this.g.fillStyle(sparkColor, sparkAlpha).fillCircle(sparkX, sparkY, sparkSize);
          }
        }

        // 4. Enhanced energy bar (48px wide, 5px high)
        // Background track
        this.g.fillStyle(0x0a161e, 0.9).fillRoundedRect(x - 24, 513, 48, 5, 2.5);
        // Border highlight
        this.g.fillStyle(0x1d3644, 0.6).fillRoundedRect(x - 24, 513, 48, 1, 0.5);

        // Filled energy
        const fillW = Math.max(4, Math.floor(48 * progress));
        this.g.fillStyle(color, 0.95).fillRoundedRect(x - 24, 513, fillW, 5, 2.5);

        // Dynamic shimmer wave running across the filled energy bar
        if (!reduced && fillW > 8) {
          const shimmerPos = ((now * 0.0018) % 1.2) * 48;
          if (shimmerPos <= fillW) {
            this.g.fillStyle(0xffffff, 0.65).fillRoundedRect(Math.max(x - 24, x - 24 + shimmerPos - 4), 513, 5, 5, 2);
          }
        }
      } else {
        // 100% Ready Phase: Primed golden energy pulse
        this.readyCount++;
        const pulse = 0.5 + 0.5 * Math.sin(now / 150);
        const auraAlpha = (0.35 + 0.25 * pulse) * (reduced ? 0.65 : 1);

        // Full body golden energy pulse
        this.glow.glow(x, 480, 42 + 10 * pulse, 0xffde65, auraAlpha);
        this.glow.glow(x, 506, 34 + 8 * pulse, 0xffea85, auraAlpha * 1.2);
        this.glow.glow(x, 460, 24 + 6 * pulse, 0xfff6b8, auraAlpha * 0.9);

        // Orbiting golden energy orbs
        if (!reduced) {
          for (let s = 0; s < 4; s++) {
            const angle = now / 340 + s * (Math.PI / 2);
            const orbX = x + Math.cos(angle) * 18;
            const orbY = 480 + Math.sin(angle) * 14;
            // Glow
            this.g.fillStyle(0xffe87a, 0.4).fillCircle(orbX, orbY, 4);
            // Core
            this.g.fillStyle(0xfffff0, 0.95).fillCircle(orbX, orbY, 2.2);
          }
        }

        // Ready badge / star cue above character head
        const starY = 452 - pulse * 3;
        this.g.fillStyle(0xffe570, 0.9 + 0.1 * pulse).fillCircle(x, starY, 3);
        this.g.fillStyle(0xffffff, 1).fillCircle(x, starY, 1.5);
        this.glow.glow(x, starY, 16 + 6 * pulse, 0xffeb8a, 0.5 + 0.3 * pulse);

        // Golden primed energy bar
        this.g.fillStyle(0x0a161e, 0.95).fillRoundedRect(x - 24, 513, 48, 5, 2.5);
        this.g.fillStyle(0xffd545, 1).fillRoundedRect(x - 24, 513, 48, 5, 2.5);
        // Golden glow below bar
        this.glow.glow(x, 515, 30 + 8 * pulse, 0xffea7a, 0.45 + 0.25 * pulse);
      }
    });

    this.glow.end();
  }

  diagnostics() {
    return {
      ultimateEnergy: {
        chargedCount: this.chargedCount,
        readyCount: this.readyCount,
        activeBursts: this.bursts.length,
      },
    };
  }
}
