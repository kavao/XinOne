import type { GameRuntime } from '@xinone/game-runtime';

let runtime: GameRuntime | undefined;

export function setRuntime(value: GameRuntime): void {
  runtime = value;
}

export function getRuntime(): GameRuntime {
  if (!runtime) throw new Error('Game runtime has not been initialized.');
  return runtime;
}
