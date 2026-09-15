import type { ChallengeId, RunConfig, StageId } from '../sim/types';

export type PressureMode = 'easy' | 'hard' | NonNullable<ChallengeId>;
export interface HighPressureTuning {
  composition: number; groupInterval: number; health: number; speed: number;
  bossHealth: number; bossDamage: number; bossInterval: number; escortSpecialists: number;
}
export const pressureMode = (config: Pick<RunConfig, 'difficulty'|'challengeId'>): PressureMode => config.challengeId ?? config.difficulty ?? 'easy';
const MODES: Record<PressureMode, HighPressureTuning> = {
  easy: { composition:.10, groupInterval:.90, health:1.025, speed:1.015, bossHealth:1.06, bossDamage:1.55, bossInterval:.90, escortSpecialists:16 },
  hard: { composition:.15, groupInterval:.85, health:1.035, speed:1.02, bossHealth:1.02, bossDamage:1.65, bossInterval:.94, escortSpecialists:16 },
  four: { composition:.03, groupInterval:.96, health:1.01, speed:1.005, bossHealth:1, bossDamage:1.25, bossInterval:1, escortSpecialists:12 },
  'no-skill': { composition:.04, groupInterval:.95, health:1.01, speed:1.005, bossHealth:1, bossDamage:1.35, bossInterval:1, escortSpecialists:12 },
  'two-evolutions': { composition:.12, groupInterval:.88, health:1.025, speed:1.015, bossHealth:1.02, bossDamage:1.6, bossInterval:.95, escortSpecialists:16 },
};
/** Stage/mode adjustments are explicit and cannot affect archived balance versions. */
export const PRESSURE_OVERRIDES: Partial<Record<StageId, Partial<Record<PressureMode, Partial<HighPressureTuning>>>>> = {
  "S01": {
    "easy": {
      "bossHealth": 1.16,
      "bossDamage": 1.65,
      "bossInterval": 0.85
    },
    "four": {
      "bossDamage": 1.4
    }
  },
  "S02": {
    "easy": {
      "bossDamage": 1.8
    },
    "hard": {
      "bossDamage": 1.5
    }
  },
  "S03": {
    "hard": {
      "bossDamage": 1.4
    }
  },
  "S04": {
    "four": {
      "bossDamage": 1.65
    },
    "no-skill": {
      "bossDamage": 1.55
    }
  },
  "S05": {
    "easy": {
      "bossDamage": 1.8
    }
  },
  "S06": {
    "hard": {
      "bossDamage": 1.4
    },
    "two-evolutions": {
      "bossDamage": 1.35
    }
  },
  "S07": {
    "easy": {
      "bossDamage": 1.8
    },
    "four": {
      "bossDamage": 1.55
    },
    "no-skill": {
      "bossDamage": 1.55
    },
    "two-evolutions": {
      "bossDamage": 1.75
    }
  },
  "S08": { "hard": { "bossDamage": 1.6 } },
  "S09": {
    "easy": {
      "bossDamage": 1.3
    },
    "hard": {
      "bossDamage": 1.35
    },
    "four": {
      "bossDamage": 1.45
    },
    "no-skill": {
      "bossDamage": 1.5
    },
    "two-evolutions": {
      "bossHealth": 1.12,
      "bossDamage": 1.7,
      "bossInterval": 0.9
    }
  },
  "S10": {
    "hard": {
      "composition": 0.04,
      "groupInterval": 0.95,
      "health": 1.01,
      "speed": 1.005,
      "bossDamage": 1.3,
      "escortSpecialists": 12
    },
    "four": {
      "composition": 0.01,
      "groupInterval": 1,
      "health": 1,
      "speed": 1,
      "bossDamage": 1.12
    },
    "two-evolutions": {
      "composition": 0.04,
      "groupInterval": 0.95,
      "health": 1.01,
      "speed": 1.005,
      "bossDamage": 1.5,
      "escortSpecialists": 12
    }
  },
  "S11": {
    "easy": {
      "bossDamage": 1.8
    },
    "four": {
      "bossDamage": 1.35
    },
    "no-skill": {
      "bossDamage": 1.55
    }
  },
  "S12": {
    "easy": {
      "bossHealth": 1.02,
      "bossDamage": 1.25
    },
    "hard": {
      "composition": 0.05,
      "groupInterval": 0.94,
      "health": 1.01,
      "speed": 1.005,
      "bossDamage": 1.25,
      "bossInterval": 0.98
    },
    "four": {
      "bossDamage": 1.65
    },
    "two-evolutions": {
      "composition": 0.06,
      "groupInterval": 0.94,
      "health": 1.015,
      "speed": 1.005,
      "bossDamage": 1.3
    }
  },
  "X02": {
    "easy": {
      "bossDamage": 1.8
    },
    "hard": {
      "bossDamage": 1.3
    }
  },
  "X03": {
    "easy": {
      "bossDamage": 1.3
    },
    "hard": {
      "bossDamage": 1.18,
      "bossInterval": 0.97
    }
  }
};
export function highPressure(stageId: StageId, mode: PressureMode): HighPressureTuning {
  const tuning = { ...MODES[mode], ...PRESSURE_OVERRIDES[stageId]?.[mode] };
  if (!stageId.startsWith('X') && Number(stageId.slice(1)) <= 3) tuning.escortSpecialists = Math.min(tuning.escortSpecialists, mode === 'four' || mode === 'no-skill' ? 6 : 8);
  return tuning;
}
