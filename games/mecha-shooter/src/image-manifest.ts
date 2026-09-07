export const MECHA_SHOOTER_IMAGES = {
  player: { key: 'mecha-shooter:player', url: new URL('../assets/player.webp', import.meta.url).href },
  bossStage1: { key: 'mecha-shooter:boss-stage1', url: new URL('../assets/boss-stage1-cutout.webp', import.meta.url).href },
  bossStage1Charge: { key: 'mecha-shooter:boss-stage1-charge', url: new URL('../assets/boss-stage1-charge.webp', import.meta.url).href },
  bossStage2: { key: 'mecha-shooter:boss-stage2', url: new URL('../assets/stage2-armor-crab.png', import.meta.url).href },
  scout: { key: 'mecha-shooter:scout', url: new URL('../assets/scout.webp', import.meta.url).href },
  striker: { key: 'mecha-shooter:striker', url: new URL('../assets/striker.webp', import.meta.url).href },
  guard: { key: 'mecha-shooter:guard', url: new URL('../assets/guard.webp', import.meta.url).href },
  stage2Armor: { key: 'mecha-shooter:stage2-armor', url: new URL('../assets/stage2-armor-crab.png', import.meta.url).href },
  stage2Turret: { key: 'mecha-shooter:stage2-turret', url: new URL('../assets/stage2-turret-crab.png', import.meta.url).href },
  stage2Splitter: { key: 'mecha-shooter:stage2-splitter', url: new URL('../assets/stage2-splitter-ray.png', import.meta.url).href },
} as const;
