export const WORLD_W = 800;
export const WORLD_H = 600;
export const MAX_DT = 0.05;

export const ASTEROID_RADII = [0, 16, 30, 50] as const;
export const ASTEROID_SPEEDS = [0, 85, 55, 32] as const;
export const ASTEROID_POINTS = [0, 100, 50, 20] as const;
export const ASTEROID_SAFE_DIST = 130;

export const SHIP_RADIUS = 12;
export const SHIP_COLLISION_SCALE = 0.82;
export const SHIP_ROT_SPEED = 3.5;
export const SHIP_THRUST = 260;
export const SHIP_DRAG = 0.987;
export const SHIP_SHOOT_COOLDOWN = 0.2;
export const SHIP_NOSE_OFFSET = 21;
export const SHIP_INVINCIBLE_DURATION = 3;
export const SHIP_RESPAWN_DELAY = 2;
export const GAME_OVER_DELAY = 1.5;
export const INITIAL_LIVES = 3;

export const BULLET_SPEED = 520;
export const BULLET_TTL = 1.1;
export const BULLET_RADIUS = 2;

export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_GUARANTEED_KILLS = 5;
export const POWERUP_DURATION = 5;
export const POWERUP_TTL = 12;
export const POWERUP_RADIUS = 12;
export const TRIPLE_SPREAD = 0.18;

export const UFO_MIN_LEVEL = 2;
export const UFO_SPAWN_MIN = 15;
export const UFO_SPAWN_MAX = 25;
export const UFO_EDGE_MARGIN = 60;
export const UFO_SPEED_X = 110;
export const UFO_VERTICAL_SPEEDS = [-60, 0, 60] as const;
export const UFO_DIR_CHANGE_MIN = 1.5;
export const UFO_DIR_CHANGE_MAX = 3;
export const UFO_SHOOT_INTERVAL = 1.5;
export const UFO_BULLET_SPEED = 300;
export const UFO_BULLET_TTL = 1.2;
export const UFO_BULLET_RADIUS = 2.5;
export const UFO_RADIUS = 16;
export const UFO_POINTS = 200;
export const UFO_EXPLOSION_PARTICLES = 16;

export const COLOR_BG = "#000000";
export const COLOR_SHIP = "#00f5ff";
export const COLOR_FLAME = "#f5ff00";
export const COLOR_BULLET = "#00f5ff";
export const COLOR_ASTEROID = "#ff006e";
export const COLOR_UFO = "#f5ff00";
export const COLOR_UFO_BULLET = "#ff006e";
export const COLOR_POWERUP = "#00ff88";
export const COLOR_SUBTITLE = "#8a8fb5";

export const ASTEROIDS_INITIAL_STATS = {
  score: 0,
  lives: INITIAL_LIVES,
  level: 1,
} as const;
