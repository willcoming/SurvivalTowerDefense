// Freeze the shipped 70-node ruleset for backwards-compatibility regression.
import { PREVIOUS_TREE_VERSION } from '../../src/data/content';
import { createRun as createVersionedRun } from '../../src/sim/engine';
import type { RunConfig } from '../../src/sim/types';
export const createRun = (config: RunConfig, version = PREVIOUS_TREE_VERSION) => createVersionedRun(config, version);
