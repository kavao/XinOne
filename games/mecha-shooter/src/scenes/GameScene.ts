import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playClickSound, playOutcomeSound, playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { BOMB_RADIUS, FIELD, MechaShooterMatch, type DestroyedEnemy, type ShooterSnapshot } from '../domain/mecha-shooter';
import { DRILL_SIZE, getArmMuzzle, getDrillMuzzle, getDrillScale, getStage2WeakPoint, STAGE2_BOSS_SIZE } from '../domain/stage2-boss';
import { STAGE3_BOSS_SIZE, STAGE3_SAFE_WIDTH } from '../domain/stage3';
import { MECHA_SHOOTER_IMAGES } from '../image-manifest';
import { MECHA_SHOOTER_GAME_SCENE, MECHA_STAGES } from './TitleScene';

interface MechaSceneData extends GameSceneData {
  continueFrom?: { stage: number; score: number };
  startStage?: number;
}

interface ImpactParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  shape: 'circle' | 'shard';
  rotation: number;
  spin: number;
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
  private resultRecorded = false;
  private fireCooldown = 0;
  private particles: ImpactParticle[] = [];
  private damageFlash = 0;
  private bossSprite?: Phaser.GameObjects.Image;
  private bossHpGraphics?: Phaser.GameObjects.Graphics;
  private enemySprites: Phaser.GameObjects.Image[] = [];
  private drillSprites: Phaser.GameObjects.Image[] = [];
  private bossEffects!: Phaser.GameObjects.Graphics;
  private bossHint!: Phaser.GameObjects.Text;
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
  init(data: GameSceneData): void {
    const play = data as MechaSceneData;
    this.runtime = play.runtime;
    this.stage = play.continueFrom?.stage ?? play.startStage ?? 1;
    this.match = new MechaShooterMatch(this.stage);
    if (play.continueFrom) this.match.score = play.continueFrom.score;
    this.resultShown = false;
    this.resultRecorded = false;
    this.fireCooldown = 0;
    this.particles = [];
    this.shockwaves = [];
    this.clearAnnouncement = undefined;
    this.damageFlash = 0;
    this.backgroundScroll = 0;
    this.bossWarningSeconds = 0;
    this.bossSprite = undefined;
    this.bossHpGraphics = undefined;
    this.enemySprites = [];
    this.drillSprites = [];
    this.bossDefeatCountdown = 0;
    this.gameOverCountdown = 0;
  }
  preload(): void {
    for (const image of Object.values(MECHA_SHOOTER_IMAGES)) {
      if (!this.textures.exists(image.key)) this.load.image(image.key, image.url);
    }
  }
  create(): void {
    playSharedBgm(this, 'active');
    this.cameras.main.setBackgroundColor(0x070b16);
    this.graphics = this.add.graphics();
    this.bossEffects = this.add.graphics().setDepth(7);
    this.bossHint = this.add.text(640, 54, '', { fontFamily: 'Arial Black', fontSize: '16px', color: '#ffd166', stroke: '#10182a', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(12);
    this.hud = this.add.text(28, 18, '', { fontFamily: 'Arial', fontSize: '19px', color: '#d9e7ff' });
    this.stageLabel = this.add.text(640, 18, this.stageTitle(), { fontFamily: 'Arial Black', fontSize: '20px', color: '#ffd166' }).setOrigin(0.5, 0);
    this.add.text(1150, 690, 'Launcher', { fontFamily: 'Arial Black', fontSize: '18px', color: '#ffffff', backgroundColor: '#18243d', padding: { left: 16, right: 16, top: 8, bottom: 8 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.leaveToLauncher());
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
          if (this.stage < MECHA_STAGES.length) this.startNextStage();
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
    for (const wreck of this.match.consumeDestroyed()) {
      if (wreck.kind === 'boss') continue;
      this.spawnDefeatEffect(wreck);
    }
    for (const event of this.match.consumeEvents()) {
      if (event === 'boss-warning') {
        this.bossWarningSeconds = 2.5;
        this.cameras.main.shake(180, 0.004);
      }
      if (event === 'boss-arrived') playClickSound(this);
      if (event === 'boss-phase-changed') {
        const boss = this.match.snapshot().enemies.find((enemy) => enemy.kind === 'boss');
        const color = this.stage === 3 ? 0x65d8ff : 0xffc15a;
        if (boss) {
          this.spawnShockwave(boss.x, boss.y, 170, color);
          this.spawnImpactParticles(boss.x, boss.y, 30, color);
        }
        this.cameras.main.flash(220, 255, 190, 80);
        this.cameras.main.shake(350, 0.005);
        playClickSound(this);
      }
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
    this.bossEffects.clear();
    this.bossHint.setText('');
    this.renderBackground();
    if (this.damageFlash > 0) this.graphics.fillStyle(0xff4d5d, this.damageFlash * 0.55).fillRect(FIELD.left, 0, FIELD.right - FIELD.left, FIELD.bottom);
    this.graphics.lineStyle(2, 0x263759, 1).strokeRect(FIELD.left, 0, FIELD.right - FIELD.left, FIELD.bottom);
    let drillSpriteIndex = 0;
    for (const bullet of snapshot.bullets) {
      if (bullet.fromPlayer) {
        this.graphics.fillStyle(0x07101d, 1).fillRoundedRect(bullet.x - 5, bullet.y - 13, 10, 26, 5);
        this.graphics.fillStyle(0x8ed8ff, 1).fillRoundedRect(bullet.x - 3, bullet.y - 11, 6, 22, 3);
      } else if (bullet.kind === 'drill') {
        const sprite = this.drillSprites[drillSpriteIndex] ?? this.add.image(bullet.x, bullet.y, MECHA_SHOOTER_IMAGES.bossStage2DrillBullet.key).setDepth(6);
        this.drillSprites[drillSpriteIndex] = sprite;
        const scale = getDrillScale(bullet);
        sprite.setPosition(bullet.x, bullet.y).setDisplaySize(DRILL_SIZE.width * scale, DRILL_SIZE.height * scale).setRotation(Math.atan2(bullet.vy, bullet.vx) - Math.PI / 2).setVisible(true);
        drillSpriteIndex += 1;
      } else {
        const coreColor = bullet.decorative ? 0xb28cff : bullet.kind === 'suppressive' ? 0xffc15a : bullet.damage > 0 ? 0xff705d : 0xffc15a;
        this.graphics.fillStyle(0x050912, 1).fillCircle(bullet.x, bullet.y, bullet.radius + 3);
        this.graphics.fillStyle(coreColor, 1).fillCircle(bullet.x, bullet.y, bullet.radius);
        this.graphics.fillStyle(0xffffff, 0.8).fillCircle(bullet.x - bullet.radius * 0.3, bullet.y - bullet.radius * 0.3, Math.max(1, bullet.radius * 0.22));
      }
    }
    for (; drillSpriteIndex < this.drillSprites.length; drillSpriteIndex += 1) this.drillSprites[drillSpriteIndex].setVisible(false);
    for (const particle of this.particles) {
      const alpha = particle.life / particle.maxLife;
      this.graphics.fillStyle(particle.color, alpha);
      if (particle.shape === 'shard') {
        this.graphics.save();
        this.graphics.translateCanvas(particle.x, particle.y);
        this.graphics.rotateCanvas(particle.rotation);
        this.graphics.fillTriangle(-particle.size, particle.size * 0.4, particle.size, particle.size * 0.15, 0, -particle.size);
        this.graphics.restore();
      } else {
        this.graphics.fillCircle(particle.x, particle.y, particle.size);
      }
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
      if (enemy.diver?.mode === 'telegraph') {
        this.bossEffects.lineStyle(2, 0xffd166, 0.65);
        this.bossEffects.lineBetween(enemy.x, enemy.y, enemy.diver.target.x, enemy.diver.target.y);
        this.bossEffects.strokeCircle(enemy.x, enemy.y, 26 + enemy.diver.seconds * 10);
      }
      if (enemy.diver?.mode === 'diving') {
        const velocity = enemy.diver.velocity;
        const speed = Math.hypot(velocity.x, velocity.y);
        const ux = velocity.x / speed;
        const uy = velocity.y / speed;
        const acceleration = Math.max(0, Math.min(1, (speed - 640) / 460));
        const rearX = enemy.x - ux * 34;
        const rearY = enemy.y - uy * 34;
        const halfWidth = 4 + acceleration * 4;
        const length = 18 + acceleration * 38;
        this.bossEffects.fillStyle(0x65d8ff, 0.55 + acceleration * 0.25);
        this.bossEffects.fillTriangle(rearX - uy * halfWidth, rearY + ux * halfWidth, rearX + uy * halfWidth, rearY - ux * halfWidth, rearX - ux * length, rearY - uy * length);
      }
      const bossImage = this.stage === 3 ? MECHA_SHOOTER_IMAGES.bossStage3Flight : this.stage === 2 ? MECHA_SHOOTER_IMAGES.bossStage2 : MECHA_SHOOTER_IMAGES.bossStage1;
      const hasBossSprite = enemy.kind === 'boss' && this.textures.exists(bossImage.key);
      const enemyImage = enemy.kind === 'diver' ? MECHA_SHOOTER_IMAGES.stage3Diver : enemy.kind === 'scout' ? MECHA_SHOOTER_IMAGES.scout : enemy.kind === 'striker' ? MECHA_SHOOTER_IMAGES.striker : enemy.kind === 'guard' ? MECHA_SHOOTER_IMAGES.guard : enemy.kind === 'armor' ? MECHA_SHOOTER_IMAGES.stage2Armor : enemy.kind === 'turret' ? MECHA_SHOOTER_IMAGES.stage2Turret : enemy.kind === 'splitter' ? MECHA_SHOOTER_IMAGES.stage2Splitter : undefined;
      if (!hasBossSprite && enemyImage && this.textures.exists(enemyImage.key)) {
        const size = enemy.kind === 'diver' ? 72 : enemy.kind === 'guard' || enemy.kind === 'turret' ? 92 : enemy.kind === 'armor' ? 110 : enemy.kind === 'splitter' ? 70 : enemy.kind === 'striker' ? 78 : 58;
        const sprite = this.enemySprites[enemySpriteIndex] ?? this.add.image(enemy.x, enemy.y, enemyImage.key);
        this.enemySprites[enemySpriteIndex] = sprite;
        const diveAngle = enemy.diver?.mode === 'diving' ? Math.atan2(enemy.diver.velocity.y, enemy.diver.velocity.x) - Math.PI / 2 : 0;
        sprite.setTexture(enemyImage.key).setPosition(enemy.x, enemy.y).setDisplaySize(size, enemy.kind === 'diver' ? 80 : size).setRotation(diveAngle).setAlpha(1);
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
    const normalBossTexture = this.stage === 3 ? MECHA_SHOOTER_IMAGES.bossStage3Flight : this.stage === 2 ? MECHA_SHOOTER_IMAGES.bossStage2 : MECHA_SHOOTER_IMAGES.bossStage1;
    if (boss && this.textures.exists(normalBossTexture.key)) {
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
      const state = boss.stage2Boss;
      const citadel = boss.stage3Boss;
      const bossTexture = citadel ? citadel.mode === 'flight' ? MECHA_SHOOTER_IMAGES.bossStage3Flight : MECHA_SHOOTER_IMAGES.bossStage3Humanoid : state
        ? state.form !== 'normal' ? MECHA_SHOOTER_IMAGES.bossStage2Phase2
          : state.armor === 'left' ? MECHA_SHOOTER_IMAGES.bossStage2OpenLeft
            : state.armor === 'right' ? MECHA_SHOOTER_IMAGES.bossStage2OpenRight : normalBossTexture
        : this.stage === 1 && boss.dashState ? MECHA_SHOOTER_IMAGES.bossStage1Charge : normalBossTexture;
      if (!this.bossSprite) this.bossSprite = this.add.image(boss.x, boss.y, bossTexture.key).setDepth(3);
      this.bossSprite.setTexture(bossTexture.key).setPosition(boss.x, boss.y).setDisplaySize(citadel ? STAGE3_BOSS_SIZE.width : state ? STAGE2_BOSS_SIZE.width : boss.dashState ? 235 : 220, citadel ? STAGE3_BOSS_SIZE.height : state ? STAGE2_BOSS_SIZE.height : boss.dashState ? 155 : 145).setAlpha(citadel && citadel.transformSeconds > 0 ? 0.65 : 1);
      if (state) {
        const weakPoint = getStage2WeakPoint(boss);
        const pulse = 0.65 + Math.abs(Math.sin(boss.phase * 7)) * 0.35;
        if (weakPoint) {
          this.bossEffects.lineStyle(2, 0xffd166, pulse).strokeCircle(weakPoint.x, weakPoint.y, weakPoint.radius + 3);
        }
        const armorHint = state.form === 'transforming' ? 'ARMOR DEPLOYING'
          : state.form === 'overdrive' ? 'MINE WARDEN — CORE EXPOSED'
            : state.armor === 'closed' ? 'MINE WARDEN — ARMOR CLOSED'
              : `AIM AT THE ${state.armor.toUpperCase()} ORANGE CORE`;
        const chargingDrill = state.attack === 'drill-charge' || state.attack === 'drill-burst';
        if (state.armChargeSeconds > 0) {
          const muzzle = getArmMuzzle(boss);
          this.bossEffects.lineStyle(2, 0xffc15a, pulse).strokeCircle(muzzle.x, muzzle.y, 10 + state.armChargeSeconds * 24);
        }
        this.bossHint.setText(`${armorHint}${chargingDrill ? '  /  DRILL INCOMING' : state.attack === 'special-charge' ? '  /  CANNONS CHARGING' : ''}`);
        if (chargingDrill) {
          const muzzle = getDrillMuzzle(boss);
          const dx = state.target.x - muzzle.x;
          const dy = Math.max(80, state.target.y - muzzle.y);
          const length = Math.hypot(dx, dy);
          const ux = dx / length;
          const uy = dy / length;
          const distance = Math.min((FIELD.bottom - muzzle.y) / uy, ux > 0 ? (FIELD.right - muzzle.x) / ux : ux < 0 ? (FIELD.left - muzzle.x) / ux : Infinity);
          this.bossEffects.lineStyle(3, 0xff705d, 0.6 * pulse);
          for (let step = 0; step < distance; step += 28) {
            const end = Math.min(step + 13, distance);
            this.bossEffects.lineBetween(muzzle.x + ux * step, muzzle.y + uy * step, muzzle.x + ux * end, muzzle.y + uy * end);
          }
          this.bossEffects.lineStyle(3, 0xffd166, pulse).strokeCircle(muzzle.x, muzzle.y, 14 + state.attackSeconds * 12);
        }
        if (state.attack === 'special-charge') {
          this.bossEffects.lineStyle(4, 0xb28cff, pulse);
          for (const side of [-1, 1]) this.bossEffects.strokeCircle(boss.x + side * 46, boss.y - 45, 16 + state.attackSeconds * 12);
        }
      }
      if (citadel) {
        const pulse = 0.65 + Math.abs(Math.sin(boss.phase * 7)) * 0.35;
        this.bossHint.setText(citadel.transformSeconds > 0 ? 'SKY COMMANDER — TRANSFORMING'
          : citadel.final ? 'FINAL BARRAGE — FOLLOW THE GREEN CORRIDOR'
            : `${citadel.mode === 'flight' ? 'FLIGHT FORM — AIMED BURST' : 'HUMANOID FORM — TRIPLE FAN'}${citadel.attack === 'volley-charge' ? ' / CHARGING' : citadel.attack === 'volley-burst' ? ' / FIRING' : ''}`);
        if (citadel.final && citadel.transformSeconds === 0) {
          const top = boss.y + 75;
          this.bossEffects.fillStyle(0x65ffa9, 0.06).fillRect(citadel.safeLaneX - STAGE3_SAFE_WIDTH / 2, top, STAGE3_SAFE_WIDTH, FIELD.bottom - top);
          this.bossEffects.lineStyle(2, 0x65ffa9, pulse * 0.7);
          for (const side of [-1, 1]) this.bossEffects.lineBetween(citadel.safeLaneX + side * STAGE3_SAFE_WIDTH / 2, top, citadel.safeLaneX + side * STAGE3_SAFE_WIDTH / 2, FIELD.bottom);
          this.bossEffects.lineStyle(2, 0x65d8ff, pulse).strokeCircle(boss.x, boss.y - 15, 25 + pulse * 5);
        }
        if (citadel.attack === 'volley-charge' || citadel.attack === 'volley-burst') {
          this.bossEffects.lineStyle(3, 0xff705d, pulse).strokeCircle(boss.x, boss.y + 50, 14 + citadel.attackSeconds * 20);
          if (citadel.mode === 'flight') this.bossEffects.lineBetween(boss.x, boss.y + 50, citadel.target.x, citadel.target.y);
        }
      }
      if (!this.bossHpGraphics) this.bossHpGraphics = this.add.graphics().setDepth(8);
      this.bossHpGraphics.clear();
      const hpY = boss.y + (citadel ? 110 : state ? 96 : 82);
      this.bossHpGraphics.fillStyle(0x271522, 1).fillRect(boss.x - 80, hpY, 160, 10);
      this.bossHpGraphics.fillStyle(0xff8066, 1).fillRect(boss.x - 80, hpY, 160 * boss.hp / boss.maxHp, 10);
      this.bossHpGraphics.lineStyle(2, 0xffd166, 1).strokeRect(boss.x - 80, hpY, 160, 10);
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
    if (this.stage === 3) {
      this.graphics.fillGradientStyle(0x0b1730, 0x0b1730, 0x294b69, 0x294b69, 1).fillRect(left, 0, width, height);
      // Far clouds, middle-distance fortress decks and close gantries scroll at different speeds.
      for (let y = -200 + ((this.backgroundScroll * 38) % 200); y < height + 200; y += 200) {
        this.graphics.fillStyle(0x9cbdd3, 0.13).fillEllipse(left + 180, y, 310, 65);
        this.graphics.fillEllipse(left + width - 120, y + 70, 350, 80);
      }
      this.graphics.fillStyle(0x18283d, 1).fillRect(left, 0, 40, height).fillRect(left + width - 40, 0, 40, height);
      for (let y = -240 + ((this.backgroundScroll * 90) % 240); y < height + 240; y += 240) {
        this.graphics.fillStyle(0x3c5065, 1).fillRect(left + 12, y, 140, 28).fillRect(left + width - 152, y + 80, 140, 28);
        this.graphics.lineStyle(4, 0x708295, 0.8).lineBetween(left + 16, y + 28, left + 132, y + 72);
        this.graphics.lineBetween(left + width - 16, y + 108, left + width - 132, y + 152);
        this.graphics.fillStyle(0x65d8ff, 0.8).fillRect(left + 28, y + 7, 35, 5).fillRect(left + width - 63, y + 87, 35, 5);
      }
      for (let y = -180 + ((this.backgroundScroll * 180) % 180); y < height + 180; y += 180) {
        this.graphics.lineStyle(3, 0x849eb5, 0.45).lineBetween(left + 4, y, left + 68, y + 32);
        this.graphics.lineBetween(left + width - 4, y + 70, left + width - 68, y + 102);
      }
      return;
    }
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
    if (win) this.recordOutcome('win');
    this.add.rectangle(640, 360, 560, win ? 250 : 290, 0x0b1024, 0.96).setStrokeStyle(3, win ? 0xffd166 : 0xff8066).setDepth(20);
    this.add.text(640, win ? 295 : 278, win ? 'GAME CLEAR' : 'GAME OVER', { fontFamily: 'Arial Black', fontSize: '38px', color: win ? '#ffd166' : '#ff8066' }).setOrigin(0.5).setDepth(21);
    this.add.text(640, win ? 350 : 332, `Score ${snapshot.score}`, { fontFamily: 'Arial', fontSize: '23px', color: '#ffffff' }).setOrigin(0.5).setDepth(21);
    if (win) {
      this.add.text(640, 420, 'Click to play again', { fontFamily: 'Arial', fontSize: '20px', color: '#8ed8ff' }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.restart({ runtime: this.runtime }));
      return;
    }
    this.resultButton(520, 420, 'CONTINUE', () => this.continueRun());
    this.resultButton(760, 420, 'START', () => this.restartFromBeginning());
  }
  private continueRun(): void {
    const snapshot = this.match.snapshot();
    this.scene.restart({ runtime: this.runtime, continueFrom: { stage: this.stage, score: snapshot.score } } satisfies MechaSceneData);
  }
  private restartFromBeginning(): void {
    this.recordOutcome('lose');
    this.scene.restart({ runtime: this.runtime });
  }
  private leaveToLauncher(): void {
    if (this.match.status === 'game-over') this.recordOutcome('lose');
    this.runtime.returnToLauncher();
  }
  private recordOutcome(outcome: 'win' | 'lose'): void {
    if (this.resultRecorded) return;
    this.resultRecorded = true;
    const snapshot = this.match.snapshot();
    this.runtime.recordResult({
      gameId: 'mecha-shooter',
      scoreType: 'score',
      value: snapshot.score,
      unit: '点',
      winCondition: 'higher',
      outcome,
      playedAt: new Date().toISOString(),
    });
  }
  private stageTitle(): string {
    const stage = MECHA_STAGES.find((entry) => entry.id === this.stage) ?? MECHA_STAGES[0];
    return `STAGE ${stage.id} — ${stage.name}`;
  }
  private resultButton(x: number, y: number, label: string, onClick: () => void): void {
    const background = this.add.rectangle(x, y, 200, 54, 0x18243d).setStrokeStyle(2, 0xff8066).setInteractive({ useHandCursor: true }).setDepth(21);
    this.add.text(x, y, label, { fontFamily: 'Arial Black', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(22);
    background.on('pointerdown', () => {
      playClickSound(this);
      onClick();
    });
    background.on('pointerover', () => background.setFillStyle(0x2b3b60));
    background.on('pointerout', () => background.setFillStyle(0x18243d));
  }
  private startNextStage(): void {
    const previous = this.match.snapshot();
    this.stage += 1;
    this.clearAnnouncement?.destroy();
    this.clearAnnouncement = undefined;
    this.children.getByName('mecha-shooter:sector-secured')?.destroy();
    this.match = new MechaShooterMatch(this.stage);
    this.match.lives = previous.lives;
    this.match.score = previous.score;
    this.match.bombCount = previous.bombCount;
    this.match.powerLevel = previous.powerLevel;
    this.match.wideLevel = previous.wideLevel;
    this.match.shield = previous.shield;
    this.bossDefeatCountdown = 0;
    this.bossSprite?.setAlpha(0);
    this.bossHpGraphics?.clear();
    this.stageLabel.setText(this.stageTitle());
    this.backgroundScroll = 0;
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
  private spawnDefeatEffect(wreck: DestroyedEnemy): void {
    const scoreValue = wreck.kind === 'diver' ? 220 : wreck.kind === 'armor' ? 300 : wreck.kind === 'turret' ? 250 : wreck.kind === 'splitter' ? 180 : wreck.kind === 'guard' ? 150 : 100;
    const scoreText = this.add.text(wreck.x, wreck.y, `+${scoreValue}`, { fontFamily: 'Arial Black', fontSize: '20px', color: '#ffd166', stroke: '#10182a', strokeThickness: 5 }).setOrigin(0.5).setDepth(18);
    this.tweens.add({ targets: scoreText, y: wreck.y - 52, alpha: 0, duration: 1400, ease: 'Cubic.easeOut', onComplete: () => scoreText.destroy() });
    if (wreck.kind === 'armor') {
      this.spawnImpactParticles(wreck.x, wreck.y, 22, 0x8a8f9c);
      this.spawnImpactParticles(wreck.x, wreck.y, 16, 0xffb347);
      this.spawnShards(wreck.x, wreck.y, 10, 0x6d7180);
      this.spawnShockwave(wreck.x, wreck.y, 120, 0xc4b8a0);
      this.spawnShockwave(wreck.x, wreck.y, 70, 0xff8066);
      this.cameras.main.shake(90, 0.004);
      return;
    }
    if (wreck.kind === 'turret') {
      this.spawnImpactParticles(wreck.x, wreck.y, 18, 0xff705d);
      this.spawnImpactParticles(wreck.x, wreck.y, 14, 0xffc15a);
      this.spawnShards(wreck.x, wreck.y, 7, 0x8b624e);
      this.spawnShockwave(wreck.x, wreck.y, 95, 0xff8066);
      this.cameras.main.shake(80, 0.0035);
      return;
    }
    if (wreck.kind === 'splitter') {
      this.spawnImpactParticles(wreck.x, wreck.y, 16, 0x8a5eb5);
      this.spawnImpactParticles(wreck.x, wreck.y, 12, 0xe0c4ff);
      this.spawnShockwave(wreck.x, wreck.y, 64, 0xb28cff);
      this.spawnShockwave(wreck.x - 26, wreck.y, 42, 0x8a5eb5);
      this.spawnShockwave(wreck.x + 26, wreck.y, 42, 0x8a5eb5);
      this.cameras.main.shake(70, 0.003);
      return;
    }
    const color = wreck.kind === 'guard' ? 0x9b6b4e : wreck.kind === 'striker' ? 0x4e8b78 : 0x65d8ff;
    this.spawnImpactParticles(wreck.x, wreck.y, wreck.kind === 'guard' ? 16 : 12, color);
    this.spawnShockwave(wreck.x, wreck.y, wreck.kind === 'guard' ? 80 : 56, color);
  }
  private spawnImpactParticles(x: number, y: number, count: number, color: number): void {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      const life = 0.25 + Math.random() * 0.35;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, size: 2 + Math.random() * 3, color, shape: 'circle', rotation: 0, spin: 0 });
    }
  }
  private spawnShards(x: number, y: number, count: number, color: number): void {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      const life = 0.35 + Math.random() * 0.3;
      this.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40,
        life, maxLife: life, size: 4 + Math.random() * 5, color, shape: 'shard',
        rotation: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 8,
      });
    }
  }
  private updateParticles(delta: number): void {
    for (const particle of this.particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 180 * delta;
      particle.rotation += particle.spin * delta;
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
