export type CellState = 'hidden' | 'revealed' | 'flagged';
export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

export interface Cell {
  x: number;
  y: number;
  mined: boolean;
  adjacent: number;
  state: CellState;
}

export interface Difficulty {
  id: string;
  label: string;
  width: number;
  height: number;
  mines: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'beginner', label: 'Beginner', width: 9, height: 9, mines: 10 },
  { id: 'intermediate', label: 'Intermediate', width: 16, height: 16, mines: 40 },
  { id: 'expert', label: 'Expert', width: 30, height: 16, mines: 99 },
];

export class MinesweeperBoard {
  readonly cells: Cell[];
  status: GameStatus = 'ready';
  revealedCount = 0;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly mineCount: number,
    private readonly random: () => number = Math.random,
  ) {
    if (mineCount <= 0 || mineCount >= width * height - 9) {
      throw new Error('Mine count must leave room for the first-click safe area.');
    }
    this.cells = Array.from({ length: width * height }, (_, index) => ({
      x: index % width,
      y: Math.floor(index / width),
      mined: false,
      adjacent: 0,
      state: 'hidden' as CellState,
    }));
  }

  get flagsRemaining(): number {
    return this.mineCount - this.cells.filter((cell) => cell.state === 'flagged').length;
  }

  cellAt(x: number, y: number): Cell | undefined {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return undefined;
    return this.cells[y * this.width + x];
  }

  reveal(x: number, y: number): void {
    const cell = this.cellAt(x, y);
    if (!cell || cell.state !== 'hidden' || this.status === 'won' || this.status === 'lost') return;
    if (this.status === 'ready') {
      this.placeMines(x, y);
      this.status = 'playing';
    }
    if (cell.mined) {
      cell.state = 'revealed';
      this.status = 'lost';
      this.revealMines();
      return;
    }
    this.floodReveal(cell);
    if (this.revealedCount === this.width * this.height - this.mineCount) this.status = 'won';
  }

  toggleFlag(x: number, y: number): void {
    const cell = this.cellAt(x, y);
    if (!cell || cell.state === 'revealed' || this.status === 'won' || this.status === 'lost') return;
    if (cell.state === 'hidden' && this.flagsRemaining > 0) cell.state = 'flagged';
    else if (cell.state === 'flagged') cell.state = 'hidden';
  }

  private placeMines(safeX: number, safeY: number): void {
    const candidates = this.cells.filter(
      (cell) => Math.abs(cell.x - safeX) > 1 || Math.abs(cell.y - safeY) > 1,
    );
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const cell of candidates.slice(0, this.mineCount)) cell.mined = true;
    for (const cell of this.cells) {
      cell.adjacent = this.neighbors(cell.x, cell.y).filter((neighbor) => neighbor.mined).length;
    }
  }

  private neighbors(x: number, y: number): Cell[] {
    const result: Cell[] = [];
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) continue;
        const neighbor = this.cellAt(x + offsetX, y + offsetY);
        if (neighbor) result.push(neighbor);
      }
    }
    return result;
  }

  private floodReveal(start: Cell): void {
    const queue = [start];
    const visited = new Set<Cell>();
    while (queue.length > 0) {
      const cell = queue.shift()!;
      if (visited.has(cell) || cell.state !== 'hidden' || cell.mined) continue;
      visited.add(cell);
      cell.state = 'revealed';
      this.revealedCount += 1;
      if (cell.adjacent === 0) queue.push(...this.neighbors(cell.x, cell.y));
    }
  }

  private revealMines(): void {
    for (const cell of this.cells) if (cell.mined) cell.state = 'revealed';
  }
}
