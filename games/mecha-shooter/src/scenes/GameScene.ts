import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playClickSound, playOutcomeSound, playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { BOMB_RADIUS, FIELD, MechaShooterMatch, type ShooterSnapshot } from '../domain/mecha-shooter';
import { MECHA_SHOOTER_IMAGES } from '../image-manifest';
import { MECHA_SHOOTER_GAME_SCENE } from './TitleScene';

interface ImpactParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  startRadius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: number;
}

export class MechaShooterGameScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  private match!: MechaShooterMatch;
  private graphics!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private resultShown = false;
  private fireCooldown = 0;
  private particles: ImpactParticle[] = [];
  private damageFlash = 0;
  private bossSprite?: Phaser.GameObjects.Image;
  private bossHpGraphics?: Phaser.GameObjects.Graphics;
  private enemySprites: Phaser.GameObjects.Image[] = [];
  private shockwaves: Shockwave[] = [];
  private bossDefeatCountdown = 0;
  private bossDefeatPosition = { x: 640, y: 120 };
  private bossBurstTimer = 0;
  private gameOverCountdown = 0;
  private gameOverBurstTimer = 0;
  private backgroundScroll = 0;
  private bossWarningSeconds = 0;
  private stage = 1;
  private stageLabel!: Phaser.GameObjects.Text;
  private clearAnnouncement?: Phaser.GameObjects.Text;
  constructor() { super(MECHA_SHOOTER_GAME_SCENE); }
  init(data: GameSceneData): void { this.runtime = data.runtime; this.match = new MechaShooterMatch(); this.stage = 1; this.resultShown = false; this.fireCooldown = 0; this.particles = []; this.shockwaves = []; this.clearAnnouncement = undefined; this.damageFlash = 0; this.backgroundScroll = 0; this.bossWarningSeconds = 0; this.bossSprite = undefined; this.bossHpGraphics = undefined; this.enemySprites = []; this.bossDefeatCountdown = 0; this.gameOverCountdown = 0; }
  preload(): void {
    if (!this.textures.exists(MECHA_SHOOTER_IMAGES.player.key)) this.load.image(MECHA_SHOOTER_IMAGES.player.key, MECHA_SHOOTER_IMAGES.player.url);
    if (!this.textures.exists(MECHA_SHOOTER_IMAGES.bossStage1.key)) this.load.image(MECHA_SHOOTER_IMAGES.bossStage1.key, MECHA_SHOOTER_IMAGES.bossStage1.url);
    if (!this.textures.exists(MECHA_SHOOTER_IMAGES.bossStage1Charge.key)) this.load.image(MECHA_SHOOTER_IMAGES.bossStage1Charge.key, MECHA_SHOOTER_IMAGES.bossStage1Charge.url);
    if (!this.textures.exists(MECHA_SHOOTER_IMAGES.bossStage2.key)) this.load.image(MECHA_SHOOTER_IMAGES.bossStage2.key, MECHA_SHOOTER_IMAGES.bossStage2.url);
    for (const image of [MECHA_SHOOTER_IMAGES.scout, MECHA_SHOOTER_IMAGES.striker, MECHA_SHOOTER_IMAGES.guard]) {
      if (!this.textures.exists(image.key)) this.load.image(image.key, image.url);
    }
    for (const image of [MECHA_SHOOTER_IMAGES.stage2Armor, MECHA_SHOOTER_IMAGES.stage2Turret, MECHA_SHOOTER_IMAGES.stage2Splitter]) {
      if (!this.textures.exists(image.key)) this.load.image(image.key, image.url);
    }
  }
  create(): void {
    playSharedBgm(this, 'active');
    this.cameras.main.setBackgroundColor(0x070b16);
    this.graphics = this.add.graphics();
    this.hud = this.add.text(28, 18, '', { fontFamily: 'Arial', fontSize: '19px', color: '#d9e7ff' });
    this.stageLabel = this.add.text(640, 18, 'STAGE 1 — ORBITAL ELEVATOR', { fontFamily: 'Arial Black', fontSize: '20px', color: '#ffd166' }).setOrigin(0.5, 0);
    this.add.text(1150, 690, 'Launcher', { fontFamily: 'Arial Black', fontSize: '18px', color: '#ffffff', backgroundColor: '#18243d', padding: { left: 16, right: 16, top: 8, bottom: 8 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.runtime.returnToLauncher());
    this.add.rectangle(105, 610, 150, 64, 0x263759, 0.95).setStrokeStyle(3, 0x65d8ff, 1).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.triggerBomb());
    this.add.text(105, 610, 'BOMB', { fontFamily: 'Arial Black', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(105, 650, 'RIGHT CLICK / TOUCH', { fontFamily: 'Arial', fontSize: '11px', color: '#9eb6d8' }).setOrigin(0.5);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 2 && this.isInField(pointer.x, pointer.y)) this.triggerBomb();
    });
    this.input.mouse?.disableContextMenu();
    this.render(this.match.snapshot());
  }
  update(_time: number, delta: number): void {
    if (this.match.status !== 'playing') {
      if (this.bossDefeatCountdown > 0) {
        this.bossDefeatCountdown -= delta / 1000;
        this.bossBurstTimer -= delta / 1000;
        this.spawnImpactParticles(this.bossDefeatPosition.x + (Math.random() - 0.5) * 120, this.bossDefeatPosition.y + (Math.random() - 0.5) * 80, 12, Math.random() < 0.5 ? 0xff8066 : 0xffd166);
        if (this.bossBurstTimer <= 0) {
          this.spawnShockwave(this.bossDefeatPosition.x + (Math.random() - 0.5) * 80, this.bossDefeatPosition.y + (Math.random() - 0.5) * 60, 250, 0xffd166);
          this.bossBurstTimer = 0.55;
        }
        this.updateParticles(delta / 1000);
        this.updateShockwaves(delta / 1000);
        if (Math.random() < 0.18) this.cameras.main.shake(100, 0.004);
        if (this.bossDefeatCountdown <= 0) {
          if (this.stage === 1) this.startStage2();
          else this.showResult(true);
        }
      }
      if (this.gameOverCountdown > 0) {
        this.gameOverCountdown -= delta / 1000;
        this.gameOverBurstTimer -= delta / 1000;
        this.spawnImpactParticles(this.match.snapshot().player.x + (Math.random() - 0.5) * 35, this.match.snapshot().player.y + (Math.random() - 0.5) * 35, 10, 0xff8066);
        if (this.gameOverBurstTimer <= 0) {
          this.spawnShockwave(this.match.snapshot().player.x, this.match.snapshot().player.y, 150, 0xff8066);
          this.gameOverBurstTimer = 0.45;
        }
        this.updateParticles(delta / 1000);
        this.updateShockwaves(delta / 1000);
        this.cameras.main.shake(100, 0.006);
        if (this.gameOverCountdown <= 0) this.showResult(false);
      }
      this.render(this.match.snapshot());
      return;
    }
    const enemiesBefore = this.match.snapshot().enemies;
    this.fireCooldown -= delta / 1000;
    if (this.fireCooldown <= 0) {
      this.match.shoot();
      this.fireCooldown = 0.16;
    }
    const pointer = this.input.activePointer;
    const player = this.match.snapshot().player;
    const target = this.isInField(pointer.x, pointer.y) ? { x: pointer.x, y: pointer.y } : player;
    this.match.update(delta / 1000, target);
    this.bossWarningSeconds = Math.max(0, this.bossWarningSeconds - delta / 1000);
    this.backgroundScroll += delta / 1000;
    const enemiesAfter = this.match.snapshot().enemies;
    for (const enemy of enemiesBefore) {
      const stillPresent = enemiesAfter.some((current) => current.kind === enemy.kind && Math.abs(current.x - enemy.x) < 90 && Math.abs(current.y - enemy.y) < 90);
      if (!stillPresent && enemy.hp <= 0) {
        this.spawnImpactParticles(enemy.x, enemy.y, enemy.kind === 'boss' ? 42 : 14, enemy.kind === 'boss' ? 0xff8066 : 0xffb347);
        this.spawnShockwave(enemy.x, enemy.y, enemy.kind === 'boss' ? 220 : 72, enemy.kind === 'boss' ? 0xff8066 : 0xffb347);
        const scoreValue = enemy.kind === 'boss' ? 5000 : enemy.kind === 'armor' ? 300 : enemy.kind === 'turret' ? 250 : enemy.kind === 'splitter' ? 180 : 100;
        const scoreText = this.add.text(enemy.x, enemy.y, `+${scoreValue}`, { fontFamily: 'Arial Black', fontSize: '20px', color: '#ffd166', stroke: '#10182a', strokeThickness: 5 }).setOrigin(0.5).setDepth(18);
        this.tweens.add({ targets: scoreText, y: enemy.y - 52, alpha: 0, duration: 1400, ease: 'Cubic.easeOut', onComplete: () => scoreText.destroy() });
      }
    }
    for (const event of this.match.consumeEvents()) {
      if (event === 'boss-warning') {
        this.bossWarningSeconds = 2.5;
        this.cameras.main.shake(180, 0.004);
      }
      if (event === 'boss-arrived') playClickSound(this);
      if (event === 'player-hit') {
        const player = this.match.snapshot().player;
        this.spawnImpactParticles(player.x, player.y, 24, 0xffd166);
        this.spawnShockwave(player.x, player.y, 70, 0xffd166);
        this.damageFlash = 0.16;
        this.cameras.main.shake(120, 0.006);
      }
      if (event === 'bomb-used') {
        const player = this.match.snapshot().player;
        this.spawnImpactParticles(player.x, player.y, 70, 0x65d8ff);
        this.spawnShockwave(player.x, player.y, 110, 0x65d8ff);
        this.spawnShockwave(player.x, player.y, 190, 0x9b7ed8);
        this.cameras.main.shake(180, 0.008);
      }
      if (event === 'clear') this.beginBossDefeat(enemiesBefore.find((enemy) => enemy.kind === 'boss'));
      if (event === 'game-over') this.beginGameOver();
    }
    this.updateParticles(delta / 1000);
    this.updateShockwaves(delta / 1000);
    this.damageFlash = Math.max(0, this.damageFlash - delta / 1000);
    this.render(this.match.snapshot());
  }
  private render(snapshot: ShooterSnapshot): void {
    this.graphics.clear();
    this.renderBackground();
    if (this.damageFlash > 0) this.graphics.fillStyle(0xff4d5d, this.damageFlash * 0.55).fillRect(FIELD.left, 0, FIELD.right - FIELD.left, FIELD.bottom);
    this.graphics.lineStyle(2, 0x263759, 1).strokeRect(FIELD.left, 0, FIELD.right - FIELD.left, FIELD.bottom);
    for (const bullet of snapshot.bullets) {
      if (bullet.fromPlayer) {
        this.graphics.fillStyle(0x07101d, 1).fillRoundedRect(bullet.x - 5, bullet.y - 13, 10, 26, 5);
        this.graphics.fillStyle(0x8ed8ff, 1).fillRoundedRect(bullet.x - 3, bullet.y - 11, 6, 22, 3);
      } else {
        const coreColor = bullet.decorative ? 0xb28cff : bullet.damage > 0 ? 0xff705d : 0xffc15a;
        this.graphics.fillStyle(0x050912, 1).fillCircle(bullet.x, bullet.y, bullet.radius + 3);
        this.graphics.fillStyle(coreColor, 1).fillCircle(bullet.x, bullet.y, bullet.radius);
        this.graphics.fillStyle(0xffffff, 0.8).fillCircle(bullet.x - bullet.radius * 0.3, bullet.y - bullet.radius * 0.3, Math.max(1, bullet.radius * 0.22));
      }
    }
    for (const particle of this.particles) {
      this.graphics.fillStyle(particle.color, particle.life / particle.maxLife);
      this.graphics.fillCircle(particle.x, particle.y, particle.size);
    }
    for (const shockwave of this.shockwaves) {
      const progress = 1 - shockwave.life / shockwave.maxLife;
      this.graphics.lineStyle(4, shockwave.color, (1 - progress) * 0.95);
      this.graphics.strokeCircle(shockwave.x, shockwave.y, shockwave.radius);
    }
    for (const powerUp of snapshot.powerUps) {
      const color = powerUp.kind === 'POWER' ? 0xff8066 : powerUp.kind === 'WIDE' ? 0x65d8ff : powerUp.kind === 'SHIELD' ? 0x7dff9b : 0xc58cff;
      this.graphics.fillStyle(color, 0.22).fillCircle(powerUp.x, powerUp.y, 22);
      this.graphics.lineStyle(3, color, 0.95).strokeCircle(powerUp.x, powerUp.y, 16);
      this.graphics.fillStyle(color, 1).fillCircle(powerUp.x, powerUp.y, 7);
      this.graphics.fillStyle(0xffffff, 0.9).fillCircle(powerUp.x - 3, powerUp.y - 3, 2);
    }
    if (snapshot.bombActiveSeconds > 0) {
      const pulse = 1 + Math.sin(snapshot.bombActiveSeconds * 14) * 0.06;
      this.graphics.lineStyle(7, 0x65d8ff, 0.82);
      this.graphics.strokeCircle(snapshot.player.x, snapshot.player.y, BOMB_RADIUS * pulse);
      this.graphics.lineStyle(2, 0xffffff, 0.72);
      this.graphics.strokeCircle(snapshot.player.x, snapshot.player.y, (BOMB_RADIUS + 18) * pulse);
      this.graphics.fillStyle(0x65d8ff, 0.08);
      this.graphics.fillCircle(snapshot.player.x, snapshot.player.y, (BOMB_RADIUS - 8) * pulse);
    }
    let enemySpriteIndex = 0;
    for (const enemy of snapshot.enemies) {
      if (enemy.resourceKind) {
        const color = enemy.resourceKind === 'POWER' ? 0xff8066 : enemy.resourceKind === 'WIDE' ? 0x65d8ff : enemy.resourceKind === 'SHIELD' ? 0x7dff9b : 0xc58cff;
        const pulse = 1 + Math.sin(enemy.phase * 8) * 0.12;
        this.graphics.lineStyle(4, color, 0.8);
        this.graphics.strokeCircle(enemy.x, enemy.y, 30 * pulse);
        this.graphics.fillStyle(color, 0.16).fillCircle(enemy.x, enemy.y, 27 * pulse);
      }
      if (enemy.kind === 'turret' && (enemy.attackTelegraph ?? 0) > 0) {
        this.graphics.lineStyle(3, 0xff4d5d, 0.95);
        this.graphics.strokeCircle(enemy.x, enemy.y, 34 + Math.sin(enemy.phase * 18) * 4);
      }
      const bossImage = this.stage === 2 ? MECHA_SHOOTER_IMAGES.bossStage2 : MECHA_SHOOTER_IMAGES.bossStage1;
      const hasBossSprite = enemy.kind === 'boss' && this.textures.exists(bossImage.key);
      const enemyImage = enemy.kind === 'scout' ? MECHA_SHOOTER_IMAGES.scout : enemy.kind === 'striker' ? MECHA_SHOOTER_IMAGES.striker : enemy.kind === 'guard' ? MECHA_SHOOTER_IMAGES.guard : enemy.kind === 'armor' ? MECHA_SHOOTER_IMAGES.stage2Armor : enemy.kind === 'turret' ? MECHA_SHOOTER_IMAGES.stage2Turret : enemy.kind === 'splitter' ? MECHA_SHOOTER_IMAGES.stage2Splitter : undefined;
      if (!hasBossSprite && enemyImage && this.textures.exists(enemyImage.key)) {
        const size = enemy.kind === 'guard' || enemy.kind === 'turret' ? 92 : enemy.kind === 'armor' ? 110 : enemy.kind === 'splitter' ? 70 : enemy.kind === 'striker' ? 78 : 58;
        const sprite = this.enemySprites[enemySpriteIndex] ?? this.add.image(enemy.x, enemy.y, enemyImage.key);
        this.enemySprites[enemySpriteIndex] = sprite;
        sprite.setTexture(enemyImage.key).setPosition(enemy.x, enemy.y).setDisplaySize(size, size).setAlpha(1);
        enemySpriteIndex += 1;
      } else if (!hasBossSprite) {
        const enemyColor = enemy.kind === 'boss' ? 0x8d4d78 : enemy.kind === 'armor' ? 0x6d7180 : enemy.kind === 'turret' ? 0x8b624e : enemy.kind === 'splitter' ? 0x8a5eb5 : enemy.kind === 'guard' ? 0x9b6b4e : enemy.kind === 'striker' ? 0x4e8b78 : 0x4a6b91;
        this.graphics.fillStyle(enemyColor, 1);
        this.graphics.fillRoundedRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height, 8);
        this.graphics.lineStyle(2, enemy.kind === 'boss' ? 0xff8066 : 0x8ed8ff, 1).strokeRoundedRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height, 8);
      }
    }
    for (; enemySpriteIndex < this.enemySprites.length; enemySpriteIndex += 1) this.enemySprites[enemySpriteIndex].setAlpha(0);
    const boss = snapshot.enemies.find((enemy) => enemy.kind === 'boss');
    if (boss && this.textures.exists(MECHA_SHOOTER_IMAGES.bossStage1.key)) {
      if (boss.dashState === 'dash') {
        const jetPulse = 0.8 + Math.sin(boss.phase * 30) * 0.2;
        this.graphics.fillStyle(0x65d8ff, 0.72 * jetPulse);
        this.graphics.fillTriangle(boss.x - 32, boss.y - 60, boss.x + 32, boss.y - 60, boss.x, boss.y - 155);
        this.graphics.fillStyle(0xffffff, 0.9 * jetPulse);
        this.graphics.fillTriangle(boss.x - 13, boss.y - 58, boss.x + 13, boss.y - 58, boss.x, boss.y - 125);
        this.graphics.lineStyle(3, 0x9b7ed8, 0.8);
        this.graphics.lineBetween(boss.x - 25, boss.y - 72, boss.x - 42, boss.y - 145);
        this.graphics.lineBetween(boss.x + 25, boss.y - 72, boss.x + 42, boss.y - 145);
      }
      const normalBossTexture = this.stage === 2 ? MECHA_SHOOTER_IMAGES.bossStage2 : MECHA_SHOOTER_IMAGES.bossStage1;
      const bossTexture = this.stage === 1 && boss.dashState ? MECHA_SHOOTER_IMAGES.bossStage1Charge : normalBossTexture;
      if (!this.bossSprite) this.bossSprite = this.add.image(boss.x, boss.y, bossTexture.key).setDisplaySize(220, 145);
      this.bossSprite.setTexture(bossTexture.key).setPosition(boss.x, boss.y).setDisplaySize(this.stage === 2 ? 260 : boss.dashState ? 235 : 220, this.stage === 2 ? 190 : boss.dashState ? 155 : 145).setAlpha(1);
      if (!this.bossHpGraphics) this.bossHpGraphics = this.add.graphics();
      this.bossHpGraphics.clear();
      this.bossHpGraphics.fillStyle(0x271522, 1).fillRect(boss.x - 80, boss.y + 82, 160, 10);
      this.bossHpGraphics.fillStyle(0xff8066, 1).fillRect(boss.x - 80, boss.y + 82, 160 * boss.hp / boss.maxHp, 10);
      this.bossHpGraphics.lineStyle(2, 0xffd166, 1).strokeRect(boss.x - 80, boss.y + 82, 160, 10);
    } else if (this.bossSprite) {
      this.bossSprite.setAlpha(0);
      this.bossHpGraphics?.clear();
    }
    if (!this.textures.exists(MECHA_SHOOTER_IMAGES.player.key)) {
      this.graphics.fillStyle(snapshot.invulnerableSeconds > 0 ? 0xffd166 : 0x65d8ff, 1).fillTriangle(snapshot.player.x, snapshot.player.y - 25, snapshot.player.x - 20, snapshot.player.y + 20, snapshot.player.x + 20, snapshot.player.y + 20);
    } else {
      const playerImage = this.children.getByName('mecha-shooter:player-sprite') as Phaser.GameObjects.Image | undefined;
      if (playerImage) playerImage.setPosition(snapshot.player.x, snapshot.player.y).setAlpha(snapshot.invulnerableSeconds > 0 ? 0.55 : 1);
      else this.add.image(snapshot.player.x, snapshot.player.y, MECHA_SHOOTER_IMAGES.player.key).setName('mecha-shooter:player-sprite').setDisplaySize(74, 110);
    }
    const upgrades = `P${snapshot.powerLevel} W${snapshot.wideLevel ? 'IDE' : '-'} ${snapshot.shield ? 'SHIELD' : ''}`;
    this.hud.setText(`LIVES ${snapshot.lives}    SCORE ${snapshot.score}    BOMBS ${snapshot.bombCount}    ${upgrades}${snapshot.bombActiveSeconds > 0 ? '    BOMB ACTIVE' : ''}${snapshot.bossWarning ? '    BOSS INBOUND' : ''}`);
    if (this.bossWarningSeconds > 0) {
      const pulse = 0.72 + Math.abs(Math.sin(this.bossWarningSeconds * 10)) * 0.28;
      this.graphics.fillStyle(0x120d1a, 0.72 * pulse).fillRect(FIELD.left + 30, 260, FIELD.right - FIELD.left - 60, 145);
      this.graphics.lineStyle(3, 0xff4d5d, pulse).strokeRect(FIELD.left + 30, 260, FIELD.right - FIELD.left - 60, 145);
      if (!this.children.getByName('mecha-shooter:warning-title')) this.add.text(640, 300, 'WARNING', { fontFamily: 'Arial Black', fontSize: '42px', color: '#ff4d5d' }).setOrigin(0.5).setDepth(20).setName('mecha-shooter:warning-title');
      if (!this.children.getByName('mecha-shooter:warning-subtitle')) this.add.text(640, 350, 'HIGH-THREAT HOSTILE SIGNATURE DETECTED', { fontFamily: 'Arial', fontSize: '14px', color: '#ffd166' }).setOrigin(0.5).setDepth(20).setName('mecha-shooter:warning-subtitle');
    } else {
      this.children.getByName('mecha-shooter:warning-title')?.destroy();
      this.children.getByName('mecha-shooter:warning-subtitle')?.destroy();
    }
  }
  private renderBackground(): void {
    const left = FIELD.left;
    const width = FIELD.right - FIELD.left;
    const height = FIELD.bottom;
    const farOffset = (this.backgroundScroll * 34) % 180;
    const midOffset = (this.backgroundScroll * 92) % 150;
    const nearOffset = (this.backgroundScroll * 190) % 110;
    this.graphics.fillStyle(this.stage === 1 ? 0x0b1424 : 0xb36b3d, 1).fillRect(left, 0, width, height);
    if (this.stage === 2) {
      this.graphics.fillStyle(0xc7834b, 0.35);
      const dustOffset = (this.backgroundScroll * 80) % 180;
      for (let y = -180 + dustOffset; y < height + 180; y += 180) this.graphics.fillRect(left, y, width, 70);
      this.graphics.fillStyle(0x6d493b, 0.9);
      for (let y = -240 + ((this.backgroundScroll * 48) % 240); y < height + 240; y += 240) {
        this.graphics.fillRect(left + 70, y, 130, 22);
        this.graphics.fillRect(left + width - 200, y + 45, 130, 22);
        this.graphics.fillStyle(0xd58b4a, 0.8).fillCircle(left + 105, y + 11, 5);
        this.graphics.fillCircle(left + width - 165, y + 56, 5);
        this.graphics.fillStyle(0x6d493b, 0.9);
      }
      this.graphics.lineStyle(8, 0x8c5b3c, 0.8);
      const pipeOffset = (this.backgroundScroll * 145) % 260;
      for (let y = -260 + pipeOffset; y < height + 260; y += 260) this.graphics.lineBetween(left + 35, y, left + width - 35, y + 35);
      this.graphics.lineStyle(2, 0xffc15a, 0.8);
      for (let y = -90 + ((this.backgroundScroll * 220) % 90); y < height + 90; y += 90) this.graphics.lineBetween(left + 20, y, left + width - 20, y + 12);
      return;
    }
    // 遠景: 軌道エレベーターの隔壁と縦柱
    this.graphics.fillStyle(0x14243a, 0.8);
    for (let y = -180 + farOffset; y < height + 180; y += 180) {
      this.graphics.fillRect(left + 28, y, width - 56, 4);
      this.graphics.fillRect(left + 105, y - 80, 12, 150);
      this.graphics.fillRect(left + width - 117, y - 80, 12, 150);
    }
    // 中景: 左右の太い配管と接続部
    this.graphics.lineStyle(9, 0x274461, 0.9);
    for (let y = -150 + midOffset; y < height + 150; y += 150) {
      this.graphics.lineBetween(left + 58, y, left + 118, y + 34);
      this.graphics.lineBetween(left + width - 58, y, left + width - 118, y + 34);
      this.graphics.fillStyle(0x3d6681, 0.9);
      this.graphics.fillCircle(left + 118, y + 34, 8);
      this.graphics.fillCircle(left + width - 118, y + 34, 8);
    }
    // 前景: 細いケーブル、フレーム、警告灯。速度差を強調する。
    this.graphics.lineStyle(3, 0x5a7890, 0.7);
    for (let y = -110 + nearOffset; y < height + 110; y += 110) {
      this.graphics.lineBetween(left + 18, y, left + 72, y + 22);
      this.graphics.lineBetween(left + width - 18, y, left + width - 72, y + 22);
      this.graphics.fillStyle(0xffb347, 0.8);
      this.graphics.fillRect(left + 38, y + 16, 7, 4);
      this.graphics.fillStyle(0x65d8ff, 0.65);
      this.graphics.fillRect(left + width - 45, y + 16, 7, 4);
    }
    this.graphics.lineStyle(2, 0x263759, 1).strokeRect(left, 0, width, height);
  }
  private showResult(win: boolean): void {
    if (this.resultShown) return;
    this.resultShown = true;
    this.clearAnnouncement?.destroy();
    this.clearAnnouncement = undefined;
    this.children.getByName('mecha-shooter:sector-secured')?.destroy();
    playOutcomeSound(this, win ? 'victory' : 'defeat');
    const snapshot = this.match.snapshot();
    this.runtime.recordResult({ gameId: 'mecha-shooter', scoreType: 'score', value: snapshot.score, unit: '点', winCondition: 'higher', outcome: win ? 'win' : 'lose', playedAt: new Date().toISOString() });
    this.add.rectangle(640, 360, 500, 250, 0x0b1024, 0.96).setStrokeStyle(3, win ? 0xffd166 : 0xff8066);
    this.add.text(640, 295, win ? 'GAME CLEAR' : 'GAME OVER', { fontFamily: 'Arial Black', fontSize: '38px', color: win ? '#ffd166' : '#ff8066' }).setOrigin(0.5);
    this.add.text(640, 350, `Score ${snapshot.score}`, { fontFamily: 'Arial', fontSize: '23px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(640, 420, win ? 'Click to play again' : 'Click to retry', { fontFamily: 'Arial', fontSize: '20px', color: '#8ed8ff' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.restart({ runtime: this.runtime }));
  }
  private startStage2(): void {
    const previous = this.match.snapshot();
    this.stage = 2;
    this.clearAnnouncement?.destroy();
    this.clearAnnouncement = undefined;
    this.children.getByName('mecha-shooter:sector-secured')?.destroy();
    this.match = new MechaShooterMatch(2);
    this.match.lives = previous.lives;
    this.match.score = previous.score;
    this.match.bombCount = previous.bombCount;
    this.match.powerLevel = previous.powerLevel;
    this.match.wideLevel = previous.wideLevel;
    this.match.shield = previous.shield;
    this.bossDefeatCountdown = 0;
    this.bossSprite?.setAlpha(0);
    this.bossHpGraphics?.clear();
    this.stageLabel.setText('STAGE 2 — DUST MINING BASE');
    this.spawnImpactParticles(640, 360, 70, 0x65d8ff);
    this.spawnShockwave(640, 360, 280, 0x65d8ff);
    this.cameras.main.flash(500, 45, 130, 190);
  }
  private isInField(x: number, y: number): boolean {
    return x >= FIELD.left && x <= FIELD.right && y >= FIELD.top && y <= FIELD.bottom;
  }
  private triggerBomb(): void {
    if (this.match.useBomb()) playClickSound(this);
  }
  private spawnImpactParticles(x: number, y: number, count: number, color: number): void {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      const life = 0.25 + Math.random() * 0.35;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, size: 2 + Math.random() * 3, color });
    }
  }
  private updateParticles(delta: number): void {
    for (const particle of this.particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 180 * delta;
      particle.life -= delta;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }
  private spawnShockwave(x: number, y: number, maxRadius: number, color: number): void {
    const life = 0.5;
    const startRadius = maxRadius * 0.35;
    this.shockwaves.push({ x, y, radius: startRadius, startRadius, maxRadius, life, maxLife: life, color });
  }
  private updateShockwaves(delta: number): void {
    for (const shockwave of this.shockwaves) {
      shockwave.life -= delta;
      const progress = 1 - shockwave.life / shockwave.maxLife;
      shockwave.radius = shockwave.startRadius + (shockwave.maxRadius - shockwave.startRadius) * progress;
    }
    this.shockwaves = this.shockwaves.filter((shockwave) => shockwave.life > 0);
  }
  private beginBossDefeat(boss: { x: number; y: number } | undefined): void {
    if (boss) this.bossDefeatPosition = { x: boss.x, y: boss.y };
    this.bossDefeatCountdown = 3;
    this.clearAnnouncement = this.add.text(640, 295, `STAGE ${this.stage} CLEAR`, { fontFamily: 'Arial Black', fontSize: '40px', color: '#ffd166', stroke: '#10182a', strokeThickness: 7 }).setOrigin(0.5).setDepth(21);
    this.add.text(640, 350, 'SECTOR SECURED', { fontFamily: 'Arial', fontSize: '16px', color: '#ffffff', stroke: '#10182a', strokeThickness: 3 }).setOrigin(0.5).setDepth(21).setName('mecha-shooter:sector-secured');
    this.bossBurstTimer = 0;
    this.spawnImpactParticles(this.bossDefeatPosition.x, this.bossDefeatPosition.y, 60, 0xffd166);
    this.spawnShockwave(this.bossDefeatPosition.x, this.bossDefeatPosition.y, 250, 0xffd166);
    this.cameras.main.shake(350, 0.012);
  }
  private beginGameOver(): void {
    this.gameOverCountdown = 2;
    this.gameOverBurstTimer = 0;
    const player = this.match.snapshot().player;
    this.spawnImpactParticles(player.x, player.y, 55, 0xff8066);
    this.spawnShockwave(player.x, player.y, 150, 0xff8066);
    this.cameras.main.shake(300, 0.014);
  }
}
