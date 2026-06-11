import { describe, expect, it } from 'vitest';
import { validateGameDefinitions, type GameDefinition, type GameScene } from './index';

function scene(key: string): GameScene {
  return class {
    sys = { settings: { key } };
  } as unknown as GameScene;
}

function definition(id: string, startScene: string): GameDefinition {
  return {
    id,
    title: id,
    description: id,
    accentColor: 0,
    startScene,
    scenes: [scene(startScene)],
  };
}

describe('validateGameDefinitions', () => {
  it('accepts definitions with unique ids and scene keys', () => {
    expect(() => validateGameDefinitions([
      definition('one', 'one:start'),
      definition('two', 'two:start'),
    ])).not.toThrow();
  });

  it('rejects duplicate game ids', () => {
    expect(() => validateGameDefinitions([
      definition('same', 'one:start'),
      definition('same', 'two:start'),
    ])).toThrow('Duplicate game id');
  });

  it('rejects a start scene outside the game definition', () => {
    const invalid = definition('one', 'one:start');
    invalid.startScene = 'missing';
    expect(() => validateGameDefinitions([invalid])).toThrow('Start scene is not registered');
  });
});
