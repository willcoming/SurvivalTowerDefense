// The A/B regression suite deliberately exercises the previous supported ruleset.
import { RANGE_CONTENT_VERSION } from '../../src/data/content';
import { createRun as createVersionedRun } from '../../src/sim/engine';
import type { RunConfig } from '../../src/sim/types';
export const createRun = (config: RunConfig) => createVersionedRun(config, RANGE_CONTENT_VERSION);
