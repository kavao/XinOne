import { describe, expect, it } from 'vitest';
import { MinesweeperBoard } from './board';

describe('MinesweeperBoard', () => {
  it('keeps the first click and its neighbors free of mines', () => {
    const board = new MinesweeperBoard(9, 9, 10, () => 0.25);
    board.reveal(4, 4);

    const safeArea = board.cells.filter(
      (cell) => Math.abs(cell.x - 4) <= 1 && Math.abs(cell.y - 4) <= 1,
    );
    expect(safeArea).toHaveLength(9);
    expect(safeArea.every((cell) => !cell.mined)).toBe(true);
    expect(board.cells.filter((cell) => cell.mined)).toHaveLength(10);
  });

  it('toggles flags and tracks the remaining count', () => {
    const board = new MinesweeperBoard(9, 9, 10);

    board.toggleFlag(0, 0);
    expect(board.cellAt(0, 0)?.state).toBe('flagged');
    expect(board.flagsRemaining).toBe(9);

    board.toggleFlag(0, 0);
    expect(board.cellAt(0, 0)?.state).toBe('hidden');
    expect(board.flagsRemaining).toBe(10);
  });

  it('wins after every safe cell is revealed', () => {
    const board = new MinesweeperBoard(9, 9, 10, () => 0.5);
    board.reveal(4, 4);

    for (const cell of board.cells) {
      if (!cell.mined) board.reveal(cell.x, cell.y);
    }

    expect(board.status).toBe('won');
    expect(board.revealedCount).toBe(71);
  });

  it('loses and reveals mines when a mine is clicked', () => {
    const board = new MinesweeperBoard(9, 9, 10, () => 0.75);
    board.reveal(4, 4);
    const mine = board.cells.find((cell) => cell.mined)!;

    board.reveal(mine.x, mine.y);

    expect(board.status).toBe('lost');
    expect(board.cells.filter((cell) => cell.mined).every((cell) => cell.state === 'revealed')).toBe(true);
  });
});
