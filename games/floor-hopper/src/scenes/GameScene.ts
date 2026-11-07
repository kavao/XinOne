import type { GameSceneData, RuntimeActions } from '@xinone/game-contracts';
import { playOutcomeSound, playSharedBgm } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { FloorHopperRun, WORLD } from '../domain/floor-hopper';
import { FLOOR_HOPPER_GAME_SCENE } from './TitleScene';
import { addHopperButton } from './ui';

const PAUSE_BUTTON_GUARD_X = 1220;

export class FloorHopperGameScene extends Phaser.Scene {
  private runtime!: RuntimeActions;
  private run!: FloorHopperRun;
  private graphics!: Phaser.GameObjects.Graphics;
  private distanceText!: Phaser.GameObjects.Text;
  private jumpsText!: Phaser.GameObjects.Text;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private pointerWasDown = false;
  private resultShown = false;

  constructor() {
    super(FLOOR_HOPPER_GAME_SCENE);
  }

  init(data: GameSceneData): void {
    this.runtime = data.runtime;
    this.run = new FloorHopperRun();
    this.pointerWasDown = false;
    this.resultShown = false;
  }

  create(): void {
    playSharedBgm(this, 'active');
    this.cameras.main.setBackgroundColor(0x07141c);
    this.createStars();
    this.graphics = this.add.graphics();
    this.distanceText = this.add.text(640, 28, '0 m', {
      fontFamily: 'Arial Black',
      fontSize: '34px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);
    this.jumpsText = this.add.text(70, 36, '', {
      fontFamily: 'Arial Black',
      fontSize: '22px',
      color: '#5eead4',
    });
    this.input.keyboard?.addCapture('SPACE');
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.render();
  }

  update(_time: number, deltaMilliseconds: number): void {
    if (this.run.status === 'playing') this.readJumpInput();
    this.run.update(deltaMilliseconds / 1000);
    this.render();
    if (this.run.status !== 'playing' && !this.resultShown) this.showResult();
  }

  private readJumpInput(): void {
    const pointer = this.input.activePointer;
    const pointerDown = pointer.leftButtonDown();
    const clickedPlayfield = pointerDown && !this.pointerWasDown && pointer.x < PAUSE_BUTTON_GUARD_X;
    this.pointerWasDown = pointerDown;
    const pressedSpace = this.spaceKey !== undefined && Phaser.Input.Keyboard.JustDown(this.spaceKey);
    if (clickedPlayfield || pressedSpace) this.run.jump();
  }

  private createStars(): void {
    for (let i = 0; i < 48; i += 1) {
      this.add.circle(
        Phaser.Math.Between(0, WORLD.width),
        Phaser.Math.Between(0, WORLD.height),
        Phaser.Math.FloatBetween(1, 2.2),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.7),
      ).setDepth(-2);
    }
  }

  private render(): void {
    const snapshot = this.run.snapshot();
    this.distanceText.setText(`${Math.floor(snapshot.distanceMeters)} m`);
    this.jumpsText.setText(snapshot.jumpsRemaining === 2 ? 'JUMPS  ◆◆' : snapshot.jumpsRemaining === 1 ? 'JUMPS  ◆○' : 'JUMPS  ○○');

    const graphics = this.graphics.clear();
    for (const floor of snapshot.floors) {
      graphics.fillStyle(0x1a4d52, 1);
      graphics.fillRoundedRect(floor.x, floor.y, floor.width, WORLD.floorThickness, 8);
      graphics.fillStyle(0x5eead4, 1);
      graphics.fillRect(floor.x, floor.y, floor.width, 4);
    }

    const bodyLeft = snapshot.playerX - WORLD.playerHalfWidth;
    const bodyTop = snapshot.playerY - WORLD.playerHeight;
    graphics.fillStyle(0xf8fafc, 1);
    graphics.fillRoundedRect(bodyLeft + 4, bodyTop + 16, WORLD.playerHalfWidth * 2 - 8, 28, 6);
    graphics.fillStyle(0x5eead4, 1);
    graphics.fillCircle(snapshot.playerX, bodyTop + 12, 11);
  }

  private showResult(): void {
    this.resultShown = true;
    playOutcomeSound(this, 'defeat');
    const distance = Math.floor(this.run.distanceMeters);
    this.runtime.recordResult({
      gameId: 'floor-hopper',
      scoreType: 'distance',
      value: distance,
      unit: 'm',
      winCondition: 'higher',
      outcome: 'lose',
      playedAt: new Date().toISOString(),
    });
    this.add.rectangle(640, 360, 560, 260, 0x071018, 0.94).setStrokeStyle(4, 0x5eead4);
    this.add.text(640, 280, 'GAME OVER', {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: '#5eead4',
    }).setOrigin(0.5);
    this.add.text(640, 340, `${distance} m`, {
      fontFamily: 'Arial Black',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5);
    addHopperButton(this, 520, 430, 'Retry', () => {
      this.scene.restart({ runtime: this.runtime });
    }, 200);
    addHopperButton(this, 760, 430, 'Launcher', () => this.runtime.returnToLauncher(), 200);
  }
}
