import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { hideSceneLoading, playOutcomeSound, playSharedBgm, showSceneLoading } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { HOCKEY_AUDIO } from '../audio-manifest';
import { HockeyMatch, RINK, type CpuDifficulty } from '../domain/hockey';
import { HOCKEY_DIFFICULTY_SCENE, HOCKEY_GAME_SCENE } from './DifficultyScene';
import { addHockeyButton } from './ui';

interface HockeyGameData extends GameSceneData {
  difficulty: CpuDifficulty;
}

const MAX_ACTIVE_RIPPLES = 12;
const MATCH_DURATION_MS = 120_000;

export class HockeyGameScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  private difficulty!: CpuDifficulty;
  private match!: HockeyMatch;
  private graphics!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private playerLabel?: Phaser.GameObjects.Text;
  private cpuLabel?: Phaser.GameObjects.Text;
  private goalParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private activeRipples = new Set<Phaser.GameObjects.Arc>();
  private timerText!: Phaser.GameObjects.Text;
  private playerScoreText!: Phaser.GameObjects.Text;
  private matchStartTime = 0;
  private timedOut = false;
  private playerHasMoved = false;
  private resultShown = false;

  constructor() {
    super(HOCKEY_GAME_SCENE);
  }

  init(data: HockeyGameData): void {
    this.runtime = data.runtime;
    this.difficulty = data.difficulty;
    this.match = new HockeyMatch(data.difficulty);
    this.activeRipples.clear();
    this.matchStartTime = 0;
    this.timedOut = false;
    this.playerHasMoved = false;
    this.resultShown = false;
  }

  preload(): void {
    for (const audio of Object.values(HOCKEY_AUDIO)) {
      if (!this.cache.audio.exists(audio.key)) this.load.audio(audio.key, audio.url);
    }
    showSceneLoading(this, '#ff70d9');
  }

  create(): void {
    hideSceneLoading(this);
    playSharedBgm(this, 'active');
    this.cameras.main.setBackgroundColor(0x0d071a);
    this.graphics = this.add.graphics();
    this.scoreText = this.add.text(640, 28, '', {
      fontFamily: 'Arial Black',
      fontSize: '34px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);
    this.speedText = this.add.text(105, 44, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#d7c6eb',
    });
    this.add.text(1175, 44, `${this.difficulty.label} CPU`, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#d7c6eb',
    }).setOrigin(1, 0);
    this.timerText = this.add.text(640, 63, '2:00', {
      fontFamily: 'Arial Black',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);
    this.playerScoreText = this.add.text(105, 68, 'SCORE  0', {
      fontFamily: 'Arial Black',
      fontSize: '24px',
      color: '#ffd166',
    });
    this.matchStartTime = this.time.now;

    addHockeyButton(this, 1050, 688, 'Menu', () => {
      this.scene.start(HOCKEY_DIFFICULTY_SCENE, { runtime: this.runtime });
    }, 130);
    addHockeyButton(this, 1190, 688, 'Launcher', () => this.runtime.returnToLauncher(), 130);
    this.input.once('pointermove', () => {
      this.playerHasMoved = true;
    });
    this.createPaddleLabels();
    this.createGoalParticles();
    this.render();
  }

  update(_time: number, deltaMilliseconds: number): void {
    const pointer = this.input.activePointer;
    const playerTarget = this.playerHasMoved
      ? { x: pointer.worldX, y: pointer.worldY }
      : { ...this.match.player };
    const previousPlayerScore = this.match.playerScore;
    const previousCpuScore = this.match.cpuScore;
    const previousPlayerHits = this.match.playerHits;
    this.match.update(deltaMilliseconds / 1000, playerTarget);
    this.playMatchSounds();
    if (this.match.playerScore > previousPlayerScore) {
      this.spawnGoalParticles(RINK.right);
      this.showFloatingScore('+100', RINK.right - 80, RINK.centerY);
    }
    if (this.match.cpuScore > previousCpuScore) this.spawnGoalParticles(RINK.left);
    if (this.match.playerHits > previousPlayerHits) {
      this.showFloatingScore('+10', this.match.puck.x, this.match.puck.y);
    }
    this.updateTimer();
    this.render();
    if (this.match.status !== 'playing' && !this.resultShown) this.showResult();
  }

  private createGoalParticles(): void {
    if (!this.textures.exists('hockey-goal-particle')) {
      const square = this.make.graphics({ x: 0, y: 0 }, false);
      square.fillStyle(0xffffff, 1);
      square.fillRect(0, 0, 10, 10);
      square.generateTexture('hockey-goal-particle', 10, 10);
      square.destroy();
    }
    this.goalParticles = this.add.particles(0, 0, 'hockey-goal-particle', {
      lifespan: 700,
      speed: { min: 150, max: 420 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      rotate: { start: 0, end: 360 },
      gravityY: 700,
      tint: [0xffd166, 0x65d8ff, 0xff5f78, 0xffffff],
      emitting: false,
    }).setDepth(3);
  }

  private spawnGoalParticles(goalX: number): void {
    this.goalParticles.explode(28, goalX, RINK.centerY);
  }

  private playMatchSounds(): void {
    for (const event of this.match.consumeEvents()) {
      const audio = event === 'goal'
        ? HOCKEY_AUDIO.goal
        : event === 'center-boost'
          ? HOCKEY_AUDIO.centerBoost
          : HOCKEY_AUDIO.puckHit;
      this.sound.play(audio.key, { volume: audio.volume });
      if (event === 'puck-hit') this.spawnRipple(this.match.puck.x, this.match.puck.y);
    }
  }

  private spawnRipple(x: number, y: number): void {
    if (this.activeRipples.size >= MAX_ACTIVE_RIPPLES) return;
    const ripple = this.add.circle(x, y, RINK.puckRadius, 0xffffff, 0);
    this.activeRipples.add(ripple);
    ripple.setStrokeStyle(2, 0xaee9ff, 0.7);
    ripple.setDepth(2);
    this.tweens.add({
      targets: ripple,
      scale: 3,
      alpha: 0,
      duration: 450,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.activeRipples.delete(ripple);
        ripple.destroy();
      },
    });
  }

  private render(): void {
    const snapshot = this.match.snapshot();
    const graphics = this.graphics.clear();

    graphics.fillStyle(0x14213d, 1);
    graphics.fillRoundedRect(RINK.left, RINK.top, RINK.right - RINK.left, RINK.bottom - RINK.top, 26);
    graphics.lineStyle(5, 0x5ad8e6, 1);
    graphics.strokeRoundedRect(RINK.left, RINK.top, RINK.right - RINK.left, RINK.bottom - RINK.top, 26);
    graphics.lineStyle(3, 0x5ad8e6, 0.55);
    graphics.lineBetween(RINK.centerX, RINK.top, RINK.centerX, RINK.bottom);
    graphics.lineStyle(2, 0x65d8ff, 0.35);
    graphics.lineBetween(RINK.playerStartX, RINK.top, RINK.playerStartX, RINK.bottom);
    graphics.lineStyle(2, 0xff5f78, 0.35);
    graphics.lineBetween(RINK.cpuStartX, RINK.top, RINK.cpuStartX, RINK.bottom);
    graphics.strokeCircle(RINK.centerX, RINK.centerY, 110);

    graphics.fillStyle(0xffd166, snapshot.boostRemaining > 0 || snapshot.boostFlash > 0 ? 1 : 0.55);
    graphics.fillCircle(RINK.centerX, RINK.centerY, RINK.spotRadius);
    graphics.lineStyle(4, 0xff70d9, 1);
    graphics.lineBetween(RINK.left, RINK.centerY - RINK.goalHalfHeight, RINK.left, RINK.centerY + RINK.goalHalfHeight);
    graphics.lineBetween(RINK.right, RINK.centerY - RINK.goalHalfHeight, RINK.right, RINK.centerY + RINK.goalHalfHeight);

    graphics.fillStyle(0xff5f78, 1);
    graphics.fillCircle(snapshot.cpu.x, snapshot.cpu.y, RINK.paddleRadius);
    graphics.lineStyle(5, 0xffffff, 0.8);
    graphics.strokeCircle(snapshot.cpu.x, snapshot.cpu.y, RINK.paddleRadius);

    graphics.fillStyle(0x65d8ff, 1);
    graphics.fillCircle(snapshot.player.x, snapshot.player.y, RINK.paddleRadius);
    graphics.lineStyle(5, 0xffffff, 0.8);
    graphics.strokeCircle(snapshot.player.x, snapshot.player.y, RINK.paddleRadius);

    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(snapshot.puck.x, snapshot.puck.y, RINK.puckRadius);
    graphics.lineStyle(4, snapshot.boostRemaining > 0 ? 0xffd166 : 0xff70d9, 1);
    graphics.strokeCircle(snapshot.puck.x, snapshot.puck.y, RINK.puckRadius);

    this.scoreText.setText(`YOU  ${snapshot.playerScore}  -  ${snapshot.cpuScore}  CPU`);
    this.playerScoreText.setText(`SCORE  ${snapshot.playerScore * 100 + snapshot.playerHits * 10}`);
    const boostText = snapshot.boostRemaining > 0 ? ` / BOOST ${snapshot.boostRemaining.toFixed(1)}s` : '';
    this.speedText.setText(`Puck speed: ${Math.round(Math.hypot(snapshot.puckVelocity.x, snapshot.puckVelocity.y))}${boostText}`);
    this.playerLabel?.setPosition(snapshot.player.x + RINK.paddleRadius + 14, snapshot.player.y - RINK.paddleRadius - 14);
    this.cpuLabel?.setPosition(snapshot.cpu.x + RINK.paddleRadius + 14, snapshot.cpu.y - RINK.paddleRadius - 14);
  }

  private createPaddleLabels(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Arial Black',
      fontSize: '30px',
      color: '#ffffff',
      stroke: '#ffffff',
      strokeThickness: 2,
    };
    this.playerLabel = this.add.text(
      this.match.player.x + RINK.paddleRadius + 14,
      this.match.player.y - RINK.paddleRadius - 14,
      'YOU',
      style,
    ).setOrigin(0, 1).setDepth(2);
    this.cpuLabel = this.add.text(
      this.match.cpu.x + RINK.paddleRadius + 14,
      this.match.cpu.y - RINK.paddleRadius - 14,
      'CPU',
      style,
    ).setOrigin(0, 1).setDepth(2);

    this.tweens.add({
      targets: [this.playerLabel, this.cpuLabel],
      alpha: 0,
      delay: 800,
      duration: 200,
      onComplete: () => {
        this.playerLabel?.destroy();
        this.cpuLabel?.destroy();
        this.playerLabel = undefined;
        this.cpuLabel = undefined;
      },
    });
  }

  private showResult(): void {
    this.resultShown = true;
    const playerWon = this.match.status === 'player-won';
    const elapsedMs = this.time.now - this.matchStartTime;
    const remainingSeconds = playerWon
      ? Math.max(0, Math.floor((MATCH_DURATION_MS - elapsedMs) / 1000))
      : 0;
    const goalPoints = this.match.playerScore * 100;
    const hitPoints = this.match.playerHits * 10;
    const mult = this.difficulty.timeBonusMultiplier;
    const timeBonus = remainingSeconds * mult;
    const totalScore = goalPoints + hitPoints + timeBonus;

    playOutcomeSound(this, playerWon ? 'victory' : 'defeat');
    this.runtime.recordResult({
      gameId: 'hockey',
      scoreType: 'score',
      value: totalScore,
      unit: '点',
      winCondition: 'higher',
      outcome: playerWon ? 'win' : 'lose',
      playedAt: new Date().toISOString(),
    });

    const panelH = playerWon ? (this.timedOut ? 390 : 360) : (this.timedOut ? 350 : 320);
    const panelCY = 375;
    this.add.rectangle(640, panelCY, 660, panelH, 0x090512, 0.95)
      .setStrokeStyle(4, playerWon ? 0x65d8ff : 0xff5f78);

    const panelTop = panelCY - panelH / 2;
    this.add.text(640, panelTop + 52, playerWon ? 'YOU WIN!' : 'CPU WINS', {
      fontFamily: 'Arial Black', fontSize: '44px',
      color: playerWon ? '#65d8ff' : '#ff5f78',
    }).setOrigin(0.5);

    if (this.timedOut) {
      this.add.text(640, panelTop + 98, '— TIME UP —', {
        fontFamily: 'Arial', fontSize: '17px', color: '#91a4bd',
      }).setOrigin(0.5);
    }

    const tallyRows: { label: string; calc: string; pts: number }[] = [
      { label: 'ゴール', calc: `${this.match.playerScore} × 100`, pts: goalPoints },
      { label: 'ヒット', calc: `${this.match.playerHits} × 10`, pts: hitPoints },
    ];
    if (playerWon) tallyRows.push({ label: 'タイム', calc: `${remainingSeconds}秒 × ${mult}`, pts: timeBonus });

    const rowY0 = panelTop + (this.timedOut ? 130 : 112);
    tallyRows.forEach((row, i) => {
      this.time.delayedCall(300 + i * 500, () => {
        const y = rowY0 + i * 40;
        this.add.text(328, y, row.label, { fontFamily: 'Arial Black', fontSize: '18px', color: '#91a4bd' }).setOrigin(0, 0.5);
        this.add.text(572, y, row.calc, { fontFamily: 'Arial', fontSize: '18px', color: '#b8c7db' }).setOrigin(0.5, 0.5);
        this.add.text(952, y, `${row.pts}点`, { fontFamily: 'Arial Black', fontSize: '18px', color: '#f8fafc' }).setOrigin(1, 0.5);
      });
    });

    const afterRowsDelay = 300 + (tallyRows.length - 1) * 500 + 600;
    const dividerY = rowY0 + tallyRows.length * 40 + 4;
    const totalLineY = dividerY + 26;
    const buttonY = panelCY + panelH / 2 - 44;

    this.time.delayedCall(afterRowsDelay, () => {
      const g = this.add.graphics();
      g.fillStyle(0x91a4bd, 0.35);
      g.fillRect(318, dividerY, 644, 1);
      this.add.text(328, totalLineY, 'TOTAL', { fontFamily: 'Arial Black', fontSize: '24px', color: '#ffd166' }).setOrigin(0, 0.5);
      this.add.text(952, totalLineY, `${totalScore}点`, { fontFamily: 'Arial Black', fontSize: '28px', color: '#ffd166' }).setOrigin(1, 0.5);
    });

    this.time.delayedCall(afterRowsDelay + 500, () => {
      addHockeyButton(this, 520, buttonY, 'Play again', () => {
        this.scene.restart({ runtime: this.runtime, difficulty: this.difficulty });
      }, 200);
      addHockeyButton(this, 760, buttonY, 'Difficulty', () => {
        this.scene.start(HOCKEY_DIFFICULTY_SCENE, { runtime: this.runtime });
      }, 200);
    });
  }

  private updateTimer(): void {
    if (this.match.status !== 'playing') return;
    const remaining = Math.max(0, MATCH_DURATION_MS - (this.time.now - this.matchStartTime));
    const totalSecs = Math.ceil(remaining / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    this.timerText.setText(`${m}:${String(s).padStart(2, '0')}`);
    this.timerText.setColor(totalSecs <= 10 ? '#ff5f78' : '#ffffff');
    if (remaining <= 0 && !this.resultShown) {
      this.timedOut = true;
      this.match.forceEnd(this.match.playerScore > this.match.cpuScore ? 'player' : 'cpu');
    }
  }

  private showFloatingScore(text: string, x: number, y: number): void {
    const label = this.add.text(x, y, text, {
      fontFamily: 'Arial Black',
      fontSize: '24px',
      color: '#ffd166',
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({
      targets: label,
      y: y - 65,
      alpha: 0,
      duration: 850,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }
}
