import type Phaser from 'phaser';

export interface RuntimeActions {
  returnToLauncher(): void;
  toggleFullscreen(): Promise<void>;
}

export interface GameSceneData {
  runtime: RuntimeActions;
}

export type GameScene = new () => Phaser.Scene;

export interface GameDefinition {
  id: string;
  title: string;
  description: string;
  accentColor: number;
  startScene: string;
  scenes: GameScene[];
}

export function validateGameDefinitions(definitions: GameDefinition[]): void {
  const ids = new Set<string>();
  const sceneKeys = new Set<string>();

  for (const definition of definitions) {
    if (ids.has(definition.id)) {
      throw new Error(`Duplicate game id: ${definition.id}`);
    }
    ids.add(definition.id);

    const ownSceneKeys = definition.scenes.map((SceneClass) => new SceneClass().sys.settings.key);
    for (const key of ownSceneKeys) {
      if (sceneKeys.has(key)) {
        throw new Error(`Duplicate scene key: ${key}`);
      }
      sceneKeys.add(key);
    }
    if (!ownSceneKeys.includes(definition.startScene)) {
      throw new Error(`Start scene is not registered: ${definition.startScene}`);
    }
  }
}
