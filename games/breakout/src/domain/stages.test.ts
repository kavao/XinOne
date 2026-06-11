import { describe, expect, it } from 'vitest';
import { FIELD, STAGE_COUNT } from './breakout';
import { STAGES } from './stages';

describe('STAGES', () => {
  it('defines exactly STAGE_COUNT stages with sequential ids', () => {
    expect(STAGES.length).toBe(STAGE_COUNT);
    STAGES.forEach((stage, index) => {
      expect(stage.id).toBe(index + 1);
    });
  });

  it('uses rows matching the field column count', () => {
    for (const stage of STAGES) {
      for (const row of stage.grid) {
        expect(row.length).toBe(FIELD.cols);
      }
    }
  });

  it('contains at least one normal brick per stage', () => {
    for (const stage of STAGES) {
      const hasNormalBrick = stage.grid.some((row) => row.includes('#'));
      expect(hasNormalBrick).toBe(true);
    }
  });

  it('gradually introduces item drops before the festival stage and omits them on the finale', () => {
    const itemStages = STAGES.filter((stage) => stage.itemsEnabled);
    expect(itemStages.map((stage) => stage.id)).toEqual([1, 2, 3, 4]);

    const dropChances = itemStages.map((stage) => stage.itemDropChance ?? 0);
    for (let i = 1; i < dropChances.length; i += 1) {
      expect(dropChances[i]).toBeGreaterThan(dropChances[i - 1]);
    }

    const finaleStage = STAGES[STAGES.length - 1];
    expect(finaleStage.itemsEnabled).toBeUndefined();
  });
});
