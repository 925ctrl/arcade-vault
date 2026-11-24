import {
  BASE_DROP_MS,
  COLS,
  DROP_STEP_MS,
  MIN_DROP_MS,
  ROWS,
  WALL_KICKS,
} from "./constants";

export type PieceType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type CellValue = 0 | PieceType;
export type Board = CellValue[][];
export type Shape = CellValue[][];

export type Piece = {
  type: PieceType;
  shape: Shape;
  x: number;
  y: number;
};

export const PIECE_SHAPES: Record<PieceType, readonly (readonly CellValue[])[]> = {
  1: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  2: [
    [2, 2],
    [2, 2],
  ],
  3: [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ],
  4: [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ],
  5: [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ],
  6: [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  7: [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ],
};

const PIECE_COUNT = 7;

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<CellValue>(COLS).fill(0));
}

export function randomPiece(): Piece {
  const type = (Math.floor(Math.random() * PIECE_COUNT) + 1) as PieceType;
  const shape: Shape = PIECE_SHAPES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

export function collide(
  board: Board,
  shape: Shape,
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx] !== 0) return true;
    }
  }
  return false;
}

export function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () =>
    new Array<CellValue>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

export function tryRotate(board: Board, piece: Piece): Piece {
  const rotated = rotateCW(piece.shape);
  for (const kick of WALL_KICKS) {
    if (!collide(board, rotated, piece.x + kick, piece.y)) {
      return {
        ...piece,
        shape: rotated,
        x: piece.x + kick,
      };
    }
  }
  return piece;
}

export function merge(board: Board, piece: Piece): Board {
  const next = board.map((row) => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      const value = piece.shape[r][c];
      if (!value) continue;
      const ny = piece.y + r;
      const nx = piece.x + c;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        next[ny][nx] = value;
      }
    }
  }
  return next;
}

export function fullRows(board: Board): number[] {
  const indices: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every((cell) => cell !== 0)) {
      indices.push(r);
    }
  }
  return indices;
}

export function removeRows(board: Board, rows: number[]): Board {
  if (rows.length === 0) return board;
  const rowSet = new Set(rows);
  const remaining = board.filter((_, idx) => !rowSet.has(idx));
  const emptyRows = Array.from({ length: rows.length }, () =>
    new Array<CellValue>(COLS).fill(0),
  );
  return [...emptyRows, ...remaining];
}

export function ghostY(board: Board, piece: Piece): number {
  let gy = piece.y;
  while (!collide(board, piece.shape, piece.x, gy + 1)) {
    gy++;
  }
  return gy;
}

export function dropIntervalMs(level: number): number {
  return Math.max(MIN_DROP_MS, BASE_DROP_MS - (level - 1) * DROP_STEP_MS);
}
