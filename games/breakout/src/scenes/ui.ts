import { playClickSound } from '@xinone/shared-assets';
import Phaser from 'phaser';

export function addBreakoutButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 220,
): Phaser.GameObjects.Container {
  const background = scene.add.rectangle(0, 0, width, 54, 0x1c2440).setStrokeStyle(2, 0xffd166);
  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Arial',
    fontSize: '22px',
    color: '#ffffff',
  }).setOrigin(0.5);
  const container = scene.add.container(x, y, [background, text]).setSize(width, 54).setInteractive();
  container.on('pointerover', () => background.setFillStyle(0x2f3a66));
  container.on('pointerout', () => background.setFillStyle(0x1c2440));
  container.on('pointerdown', () => {
    playClickSound(scene);
    onClick();
  });
  return container;
}
