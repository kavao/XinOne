import { playClickSound } from '@xinone/shared-assets';
import Phaser from 'phaser';

export function addHopperButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 220,
): Phaser.GameObjects.Container {
  const background = scene.add.rectangle(0, 0, width, 54, 0x14333a).setStrokeStyle(2, 0x5eead4);
  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Arial',
    fontSize: '22px',
    color: '#ffffff',
  }).setOrigin(0.5);
  const container = scene.add.container(x, y, [background, text]).setSize(width, 54).setInteractive();
  container.on('pointerover', () => background.setFillStyle(0x1f4c52));
  container.on('pointerout', () => background.setFillStyle(0x14333a));
  container.on('pointerdown', () => {
    playClickSound(scene);
    onClick();
  });
  return container;
}
