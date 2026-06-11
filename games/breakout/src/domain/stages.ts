import { FIELD, STAGE_COUNT, type StageDefinition } from './breakout';

export const STAGES: StageDefinition[] = [
  {
    id: 1,
    title: 'Liftoff',
    grid: [
      '##########',
      '##########',
      '##########',
    ],
    itemsEnabled: true,
    itemDropChance: 0.05,
  },
  {
    id: 2,
    title: 'Twin Stars',
    grid: [
      '####..####',
      '##.####.##',
      '#..####..#',
      '##.####.##',
    ],
    itemsEnabled: true,
    itemDropChance: 0.06,
  },
  {
    id: 3,
    title: 'Asteroid Belt',
    grid: [
      '####..####',
      '###XXXX###',
      '####..####',
      '##XXXXXX##',
      '####..####',
    ],
    itemsEnabled: true,
    itemDropChance: 0.07,
  },
  {
    id: 4,
    title: 'Star Festival',
    grid: [
      '##########',
      '##########',
      '..........',
      'X########X',
      'X########X',
    ],
    itemsEnabled: true,
    itemDropChance: 0.18,
  },
  {
    id: 5,
    title: 'Nova Face',
    grid: [
      '...####...',
      '..######..',
      '##.####.##',
      '##########',
      '###....###',
      '..######..',
      '...####...',
    ],
  },
];

if (STAGES.length !== STAGE_COUNT) {
  throw new Error(`STAGES length (${STAGES.length}) must equal STAGE_COUNT (${STAGE_COUNT})`);
}

for (const stage of STAGES) {
  for (const row of stage.grid) {
    if (row.length !== FIELD.cols) {
      throw new Error(`Stage ${stage.id} row "${row}" must have ${FIELD.cols} columns`);
    }
  }
}
