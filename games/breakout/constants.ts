export const WORLD_W = 800;
export const WORLD_H = 600;
export const MAX_DT_MS = 50;

export const PADDLE_W = 81;
export const PADDLE_H = 14;
export const PADDLE_Y = 560;
export const PADDLE_SPEED = 400;
export const PADDLE_RADIUS = 4;
export const PADDLE_HIT_TOLERANCE = 8;
export const MAX_BOUNCE_ANGLE_RAD = (60 * Math.PI) / 180;

export const BALL_SIZE = 16;
export const BALL_RADIUS = BALL_SIZE / 2;
export const BASE_BALL_VX = 200;
export const BASE_BALL_VY = -300;
export const BASE_BALL_SPEED = Math.hypot(BASE_BALL_VX, BASE_BALL_VY);
export const MAX_SUBSTEP_PX = 8;

export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = (WORLD_W - BLOCK_COLS * BLOCK_W) / 2; // 80
export const BLOCKS_ORIGIN_Y = 80;
export const BLOCK_INSET = 2;

export const LEVEL_SPEED_BASE = 1.1;
export const MAX_LEVEL_SPEED = 2;

export const INITIAL_LIVES = 3;
export const POINTS_PER_BLOCK_BASE = 10;
export const MAX_SCORE = 9_999_999;

export const EXPLOSION_DURATION_MS = 150;
export const EXPLOSION_GROW_PX = 4;
export const DEAD_DURATION_MS = 1500;

export const COLOR_BG = "#000000";
export const COLOR_CYAN = "#00f5ff";
export const COLOR_MAGENTA = "#ff006e";
export const COLOR_YELLOW = "#f5ff00";
export const COLOR_GREEN = "#00ff88";
export const COLOR_GRAY = "#8a8fb5";
export const COLOR_SUBTITLE = "#8a8fb5";

export const BLOCK_COLOR_HEX = {
  cyan: COLOR_CYAN,
  magenta: COLOR_MAGENTA,
  yellow: COLOR_YELLOW,
  green: COLOR_GREEN,
  gray: COLOR_GRAY,
} as const;

export const SOUND_BOUNCE = "/games/rompemuros/ball-bounce.mp3";
export const SOUND_BREAK = "/games/rompemuros/break-sound.mp3";

export const BREAKOUT_INITIAL_STATS = {
  score: 0,
  lives: INITIAL_LIVES,
  level: 1,
} as const;
