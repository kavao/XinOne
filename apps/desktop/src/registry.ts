import { validateGameDefinitions, type GameDefinition } from '@xinone/game-contracts';
import { breakoutDefinition } from '@xinone/breakout';
import { hockeyDefinition } from '@xinone/hockey';
import { minesweeperDefinition } from '@xinone/minesweeper';
import { mechaShooterDefinition } from '@xinone/mecha-shooter';

export const gameDefinitions: GameDefinition[] = [minesweeperDefinition, hockeyDefinition, breakoutDefinition, mechaShooterDefinition];
validateGameDefinitions(gameDefinitions);
