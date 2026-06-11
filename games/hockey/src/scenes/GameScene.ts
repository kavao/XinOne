import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playOutcomeSound, playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { HOCKEY_AUDIO } from '../audio-manifest';
import { HockeyMatch, RINK, type CpuDifficulty } from '../domain/hockey';
import { HOCKEY_DIFFICULTY_SCENE, HOCKEY_GAME_SCENE } from './DifficultyScene';
import { addHockeyButton } from './ui';

interface HockeyGameData extends GameSceneData {
  difficulty: CpuDifficulty;
}

export class HockeyGameScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  private difficulty!: CpuDifficulty;
  private match!: HockeyMatch;
  private graphics!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private playerLabel?: Phaser.GameObjects.Text;
  private cpuLabel?: Phaser.GameObjects.Text;
  private playerHasMoved = false;
  private resultShown = false;

  constructor() {
    super(HOCKEY_GAME_SCENE);
  }

  init(data: HockeyGameData): void {
    this.runtime = data.runtime;
    this.difficulty = data.difficulty;
    this.match = new HockeyMatch(data.difficulty);
    this.playerHasMoved = false;
    this.resultShown = false;
  }

  preload(): void {
    for (const audio of Object.values(HOCKEY_AUDIO)) {
      if (!this.cache.audio.exists(audio.key)) this.load.audio(audio.key, audio.url);
    }
  }

  create(): void {
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

    addHockeyButton(this, 1050, 688, 'Menu', () => {
      this.scene.start(HOCKEY_DIFFICULTY_SCENE, { runtime: this.runtime });
    }, 130);
    addHockeyButton(this, 1190, 688, 'Launcher', () => this.runtime.returnToLauncher(), 130);
    this.input.once('pointermove', () => {
      this.playerHasMoved = true;
    });
    this.createPaddleLabels();
    this.render();
  }

  update(_time: number, deltaMilliseconds: number): void {
    const pointer = this.input.activePointer;
    const playerTarget = this.playerHasMoved
      ? { x: pointer.worldX, y: pointer.worldY }
      : { ...this.match.player };
    this.match.update(deltaMilliseconds / 1000, playerTarget);
    this.playMatchSounds();
    this.render();
    if (this.match.status !== 'playing' && !this.resultShown) this.showResult();
  }

  private playMatchSounds(): void {
    for (const event of this.match.consumeEvents()) {
      const audio = event === 'goal'
        ? HOCKEY_AUDIO.goal
        : event === 'center-boost'
          ? HOCKEY_AUDIO.centerBoost
          : HOCKEY_AUDIO.puckHit;
      this.sound.play(audio.key, { volume: audio.volume });
    }
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
    playOutcomeSound(this, playerWon ? 'victory' : 'defeat');
    this.add.rectangle(640, 380, 580, 250, 0x090512, 0.94).setStrokeStyle(4, playerWon ? 0x65d8ff : 0xff5f78);
    this.add.text(640, 315, playerWon ? 'YOU WIN!' : 'CPU WINS', {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: playerWon ? '#65d8ff' : '#ff5f78',
    }).setOrigin(0.5);
    addHockeyButton(this, 520, 420, 'Play again', () => {
      this.scene.restart({ runtime: this.runtime, difficulty: this.difficulty });
    }, 200);
    addHockeyButton(this, 760, 420, 'Difficulty', () => {
      this.scene.start(HOCKEY_DIFFICULTY_SCENE, { runtime: this.runtime });
    }, 200);
  }
}
