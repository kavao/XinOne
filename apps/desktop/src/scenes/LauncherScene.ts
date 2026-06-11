import { playClickSound, playSharedBgm, preloadSharedAudio } from '@xinone/shared-assets';
import Phaser from 'phaser';
import { gameDefinitions } from '../registry';
import { getRuntime } from '../runtime-context';

export const LAUNCHER_SCENE = 'app:launcher';

export class LauncherScene extends Phaser.Scene {
  constructor() {
    super(LAUNCHER_SCENE);
  }

  preload(): void {
    preloadSharedAudio(this);
  }

  create(): void {
    playSharedBgm(this, 'title');
    this.cameras.main.setBackgroundColor(0x08111f);
    this.createSpaceBackground();
    this.add.text(70, 60, 'XinOne', {
      fontFamily: 'Arial Black',
      fontSize: '64px',
      color: '#f8fafc',
    });
    this.add.text(74, 132, 'One launcher. Many small worlds.', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#91a4bd',
    });

    gameDefinitions.forEach((definition, index) => {
      const x = 70 + (index % 3) * 390;
      const y = 230 + Math.floor(index / 3) * 250;
      const card = this.add.rectangle(x, y, 350, 205, 0x14243a)
        .setOrigin(0).setStrokeStyle(3, definition.accentColor).setInteractive();
      this.add.text(x + 25, y + 28, definition.title, {
        fontFamily: 'Arial Black', fontSize: '32px', color: '#ffffff',
      });
      this.add.text(x + 25, y + 82, definition.description, {
        fontFamily: 'Arial', fontSize: '19px', color: '#b8c7db', wordWrap: { width: 300 },
      });
      this.add.text(x + 25, y + 160, 'PLAY', {
        fontFamily: 'Arial Black', fontSize: '20px', color: '#65d8ff',
      });
      card.on('pointerover', () => card.setFillStyle(0x1d3553));
      card.on('pointerout', () => card.setFillStyle(0x14243a));
      card.on('pointerdown', () => {
        playClickSound(this);
        getRuntime().launch(definition);
      });
    });

    this.createFullscreenButton();
  }

  private createSpaceBackground(): void {
    const { width, height } = this.scale;

    for (let i = 0; i < 70; i += 1) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(1, 2.5),
        0xffffff,
        Phaser.Math.FloatBetween(0.25, 0.85),
      ).setDepth(-2);
      if (Math.random() < 0.4) {
        this.tweens.add({
          targets: star,
          alpha: { from: star.alpha, to: star.alpha * 0.3 },
          duration: Phaser.Math.Between(1200, 2600),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    if (!this.textures.exists('launcher-star-streak')) {
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(0, 0, 48, 2);
      graphics.generateTexture('launcher-star-streak', 48, 2);
      graphics.destroy();
    }

    const angleDegrees = 25;
    const speedRange = { min: 90, max: 260 };
    const speedToFactor = (particle: Phaser.GameObjects.Particles.Particle): number => {
      const speed = Math.hypot(particle.velocityX, particle.velocityY);
      return Phaser.Math.Clamp((speed - speedRange.min) / (speedRange.max - speedRange.min), 0, 1);
    };
    this.add.particles(0, 0, 'launcher-star-streak', {
      x: { min: -120, max: width },
      y: { min: -120, max: height },
      lifespan: 4000,
      angle: angleDegrees,
      speed: speedRange,
      rotate: angleDegrees,
      scaleX: (particle: Phaser.GameObjects.Particles.Particle) => Phaser.Math.Linear(0.5, 2, speedToFactor(particle)),
      scaleY: 1,
      alpha: (particle: Phaser.GameObjects.Particles.Particle) => Phaser.Math.Linear(0.06, 0.32, speedToFactor(particle)),
      tint: [0xbfe3ff, 0x8fb6ff, 0xffffff],
      frequency: 180,
      quantity: 1,
    }).setDepth(-1);
  }

  private createFullscreenButton(): void {
    const fullscreen = this.add.text(1175, 665, 'FULLSCREEN', {
      fontFamily: 'Arial', fontSize: '18px', color: '#b8c7db',
      backgroundColor: '#14243a', padding: { x: 18, y: 12 },
    }).setOrigin(1, 0.5).setInteractive();
    fullscreen.on('pointerdown', () => {
      playClickSound(this);
      void getRuntime().toggleFullscreen();
    });
  }
}
