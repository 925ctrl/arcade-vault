import {
  BLOCK_COLS,
  BLOCK_H,
  BLOCK_ROWS,
  BLOCK_W,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  LEVEL_SPEED_BASE,
  MAX_LEVEL_SPEED,
} from "./constants";

export type BlockColor = "cyan" | "magenta" | "yellow" | "green" | "gray";

export type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};

const ROW_COLORS_1: readonly BlockColor[] = [
  "magenta",
  "yellow",
  "cyan",
  "green",
  "magenta",
  "yellow",
];

const ROW_COLORS_2: readonly BlockColor[] = [
  "gray",
  "cyan",
  "magenta",
  "yellow",
  "cyan",
  "green",
];

const PYRAMID_START = [4, 3, 2, 1, 0, 0] as const;
const PYRAMID_END = [5, 6, 7, 8, 9, 9] as const;

const ROW_COLORS_4: readonly BlockColor[] = [
  "cyan",
  "magenta",
  "green",
  "yellow",
  "cyan",
  "magenta",
];

const GAPS_4: readonly (readonly number[])[] = [
  [2, 5, 8],
  [0, 4, 7, 9],
  [1, 3, 6],
  [2, 5, 8, 9],
  [0, 4, 7],
  [1, 3, 6, 9],
];

function makeBlock(col: number, row: number, color: BlockColor): Block {
  return {
    x: BLOCKS_ORIGIN_X + col * BLOCK_W,
    y: BLOCKS_ORIGIN_Y + row * BLOCK_H,
    w: BLOCK_W,
    h: BLOCK_H,
    color,
    alive: true,
  };
}

export function buildLevel(level: number): Block[] {
  const pattern = (((level - 1) % 5) + 5) % 5;
  const blocks: Block[] = [];

  if (pattern === 0) {
    for (let r = 0; r < BLOCK_ROWS; r++) {
      for (let c = 0; c < BLOCK_COLS; c++) {
        blocks.push(makeBlock(c, r, ROW_COLORS_1[r]));
      }
    }
    return blocks;
  }

  if (pattern === 1) {
    for (let r = 0; r < BLOCK_ROWS; r++) {
      for (let c = PYRAMID_START[r]; c <= PYRAMID_END[r]; c++) {
        blocks.push(makeBlock(c, r, ROW_COLORS_2[r]));
      }
    }
    return blocks;
  }

  if (pattern === 2) {
    for (let r = 0; r < BLOCK_ROWS; r++) {
      const color: BlockColor = r < 3 ? "yellow" : "magenta";
      for (let c = 0; c < BLOCK_COLS; c++) {
        if ((c + r) % 2 === 0) {
          blocks.push(makeBlock(c, r, color));
        }
      }
    }
    return blocks;
  }

  if (pattern === 3) {
    for (let r = 0; r < BLOCK_ROWS; r++) {
      const gaps = GAPS_4[r];
      for (let c = 0; c < BLOCK_COLS; c++) {
        if (!gaps.includes(c)) {
          blocks.push(makeBlock(c, r, ROW_COLORS_4[r]));
        }
      }
    }
    return blocks;
  }

  // pattern === 4
  for (let r = 0; r < BLOCK_ROWS; r++) {
    for (let c = 0; c < BLOCK_COLS; c++) {
      const isFrame =
        c === 0 || c === BLOCK_COLS - 1 || r === 0 || r === BLOCK_ROWS - 1;
      const isCross = c === 4 || r === 2;
      if (isFrame || isCross) {
        blocks.push(
          makeBlock(c, r, isCross && !isFrame ? "magenta" : "cyan"),
        );
      }
    }
  }
  return blocks;
}

export function levelSpeed(level: number): number {
  const exp = Math.max(0, level - 1);
  const raw = Math.min(MAX_LEVEL_SPEED, LEVEL_SPEED_BASE ** exp);
  return Number(raw.toFixed(10));
}
