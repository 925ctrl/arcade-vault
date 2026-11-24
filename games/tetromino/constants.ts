export const WORLD_W = 800;
export const WORLD_H = 600;
export const MAX_DT_MS = 50;

export const COLS = 10;
export const ROWS = 20;
export const CELL_SIZE = 28;
export const BOARD_W = COLS * CELL_SIZE; // 280
export const BOARD_H = ROWS * CELL_SIZE; // 560
export const BOARD_X = 260;
export const BOARD_Y = 20;

export const NEXT_LABEL_X = 580;
export const NEXT_LABEL_Y = 44;
export const NEXT_BOX_X = 580;
export const NEXT_BOX_Y = 60;
export const NEXT_BOX_CELLS = 4;
export const NEXT_BOX_SIZE = NEXT_BOX_CELLS * CELL_SIZE; // 112

export const BASE_DROP_MS = 1000;
export const DROP_STEP_MS = 90;
export const MIN_DROP_MS = 100;

export const FLASH_DURATION_MS = 150;
export const DEAD_ROW_INTERVAL_MS = 75;
export const DEAD_DURATION_MS = ROWS * DEAD_ROW_INTERVAL_MS; // 1500

export const LINE_SCORES = [0, 100, 300, 500, 800] as const;
export const LINES_PER_LEVEL = 10;
export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;
export const MAX_SCORE = 9_999_999;

export const WALL_KICKS = [0, -1, 1, -2, 2] as const;

export const COLOR_BG = "#000000";
export const COLOR_CYAN = "#00f5ff";
export const COLOR_YELLOW = "#f5ff00";
export const COLOR_MAGENTA = "#ff006e";
export const COLOR_GREEN = "#00ff88";
export const COLOR_GRID = "#4a4f70";
export const COLOR_SUBTITLE = "#8a8fb5";

export const PIECE_COLORS = [
  null,
  COLOR_CYAN, // 1: I
  COLOR_YELLOW, // 2: O
  COLOR_MAGENTA, // 3: T
  COLOR_GREEN, // 4: S
  COLOR_MAGENTA, // 5: Z
  COLOR_CYAN, // 6: J
  COLOR_YELLOW, // 7: L
] as const;

export const TETROMINO_INITIAL_STATS = {
  score: 0,
  lines: 0,
  level: 1,
} as const;
