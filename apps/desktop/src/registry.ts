import { validateGameDefinitions, type GameDefinition } from '@xinone/game-contracts';
import { breakoutDefinition } from '@xinone/breakout';
import { hockeyDefinition } from '@xinone/hockey';
import { minesweeperDefinition } from '@xinone/minesweeper';

export const gameDefinitions: GameDefinition[] = [minesweeperDefinition, hockeyDefinition, breakoutDefinition];
validateGameDefinitions(gameDefinitions);
