import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playClickSound, playOutcomeSound, playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { type Cell, type Difficulty, MinesweeperBoard } from '../domain/board';
import { MINESWEEPER_DIFFICULTY_SCENE, MINESWEEPER_GAME_SCENE } from './DifficultyScene';
import { addButton } from './ui';

interface MinesweeperGameData extends GameSceneData {
  difficulty: Difficulty;
}

const NUMBER_COLORS = ['#9ca3af', '#60a5fa', '#4ade80', '#fb7185', '#c084fc', '#f59e0b', '#22d3ee', '#f8fafc', '#fda4af'];

export class MinesweeperGameScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  private difficulty!: Difficulty;
  private board!: MinesweeperBoard;
  private boardContainer!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private mineText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private explosionParticles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private startedAt?: number;

  constructor() {
    super(MINESWEEPER_GAME_SCENE);
  }

  init(data: MinesweeperGameData): void {
    this.runtime = data.runtime;
    this.difficulty = data.difficulty;
    this.board = new MinesweeperBoard(data.difficulty.width, data.difficulty.height, data.difficulty.mines);
    this.startedAt = undefined;
  }

  create(): void {
    playSharedBgm(this, 'thoughtful');
    this.cameras.main.setBackgroundColor(0x0c1422);
    this.input.mouse?.disableContextMenu();
    this.add.text(40, 30, `Minesweeper / ${this.difficulty.label}`, {
      fontFamily: 'Arial Black',
      fontSize: '30px',
      color: '#65d8ff',
    });
    this.mineText = this.add.text(42, 78, '', { fontFamily: 'Arial', fontSize: '22px', color: '#ffffff' });
    this.timerText = this.add.text(250, 78, 'Time: 0', { fontFamily: 'Arial', fontSize: '22px', color: '#ffffff' });
    this.statusText = this.add.text(640, 78, 'Clear every safe cell', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#b8c7db',
    }).setOrigin(0.5, 0);

    addButton(this, 1030, 56, 'Restart', () => this.scene.restart({ runtime: this.runtime, difficulty: this.difficulty }), 150);
    addButton(this, 1180, 56, 'Menu', () => this.scene.start(MINESWEEPER_DIFFICULTY_SCENE, { runtime: this.runtime }), 120);
    addButton(this, 1070, 675, 'Launcher', () => this.runtime.returnToLauncher(), 170);
    addButton(this, 1200, 675, 'Full', () => void this.runtime.toggleFullscreen(), 100);

    this.boardContainer = this.add.container(0, 0);
    this.createExplosionParticles();
    this.renderBoard();
  }

  update(): void {
    if (this.startedAt && this.board.status === 'playing') {
      this.timerText.setText(`Time: ${Math.floor((Date.now() - this.startedAt) / 1000)}`);
    }
  }

  private createExplosionParticles(): void {
    if (!this.textures.exists('minesweeper-explosion-particle')) {
      const square = this.make.graphics({ x: 0, y: 0 }, false);
      square.fillStyle(0xffffff, 1);
      square.fillRect(0, 0, 8, 8);
      square.generateTexture('minesweeper-explosion-particle', 8, 8);
      square.destroy();
    }
    this.explosionParticles = this.add.particles(0, 0, 'minesweeper-explosion-particle', {
      lifespan: 650,
      speed: { min: 120, max: 420 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.4, end: 0 },
      rotate: { start: 0, end: 360 },
      gravityY: 550,
      tint: [0xff5f4d, 0xffae42, 0x8a1f1f, 0x3a2a2a, 0xffd166],
      emitting: false,
    }).setDepth(5);
  }

  private spawnExplosionRings(x: number, y: number, cellSize: number): void {
    const rings = [
      { color: 0xfff3c4, scale: 5, duration: 350, delay: 0 },
      { color: 0xffae42, scale: 7, duration: 450, delay: 60 },
      { color: 0xff5f4d, scale: 9, duration: 550, delay: 120 },
    ];
    for (const ring of rings) {
      const circle = this.add.circle(x, y, cellSize * 0.4, ring.color, 0).setDepth(5);
      circle.setStrokeStyle(3, ring.color, 0.85);
      this.tweens.add({
        targets: circle,
        scale: ring.scale,
        alpha: 0,
        delay: ring.delay,
        duration: ring.duration,
        ease: 'Cubic.easeOut',
        onComplete: () => circle.destroy(),
      });
    }
  }

  private renderBoard(): void {
    this.boardContainer.removeAll(true);
    const cellSize = Math.floor(Math.min(1190 / this.board.width, 530 / this.board.height));
    const originX = Math.floor((1280 - cellSize * this.board.width) / 2);
    const originY = 125 + Math.floor((530 - cellSize * this.board.height) / 2);
    for (const cell of this.board.cells) {
      this.renderCell(cell, originX + cell.x * cellSize, originY + cell.y * cellSize, cellSize);
    }
    this.mineText.setText(`Flags: ${this.board.flagsRemaining}`);
    if (this.board.status === 'won') this.statusText.setText('You cleared the field!').setColor('#4ade80');
    else if (this.board.status === 'lost') this.statusText.setText('Mine triggered. Try again.').setColor('#fb7185');
  }

  private renderCell(cell: Cell, x: number, y: number, size: number): void {
    let color = 0x263850;
    let label = '';
    if (cell.state === 'revealed') {
      color = cell.mined ? 0xc24155 : 0x152238;
      label = cell.mined ? '*' : cell.adjacent > 0 ? String(cell.adjacent) : '';
    } else if (cell.state === 'flagged') {
      color = 0x3f5675;
      label = 'F';
    }

    const rectangle = this.add.rectangle(x + size / 2, y + size / 2, size - 2, size - 2, color)
      .setStrokeStyle(1, 0x527196).setInteractive();
    const text = this.add.text(x + size / 2, y + size / 2, label, {
      fontFamily: 'Arial Black',
      fontSize: `${Math.max(14, Math.floor(size * 0.55))}px`,
      color: cell.state === 'revealed' && !cell.mined ? NUMBER_COLORS[cell.adjacent] : '#ffffff',
    }).setOrigin(0.5);

    rectangle.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      playClickSound(this);
      const previousStatus = this.board.status;
      if (pointer.rightButtonDown()) this.board.toggleFlag(cell.x, cell.y);
      else {
        if (!this.startedAt) this.startedAt = Date.now();
        this.board.reveal(cell.x, cell.y);
      }
      if (previousStatus !== 'won' && previousStatus !== 'lost') {
        if (this.board.status === 'won') playOutcomeSound(this, 'victory');
        else if (this.board.status === 'lost') {
          playOutcomeSound(this, 'defeat');
          this.explosionParticles.explode(40, x + size / 2, y + size / 2);
          this.spawnExplosionRings(x + size / 2, y + size / 2, size);
        }
      }
      this.renderBoard();
    });
    this.boardContainer.add([rectangle, text]);
  }
}
