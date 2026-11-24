import {
  ASTEROIDS_INITIAL_STATS,
  ASTEROID_POINTS,
  ASTEROID_SAFE_DIST,
  COLOR_ASTEROID,
  COLOR_BG,
  COLOR_BULLET,
  COLOR_POWERUP,
  COLOR_SHIP,
  COLOR_SUBTITLE,
  COLOR_UFO,
  COLOR_UFO_BULLET,
  GAME_OVER_DELAY,
  INITIAL_LIVES,
  MAX_DT,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  POWERUP_GUARANTEED_KILLS,
  SHIP_COLLISION_SCALE,
  SHIP_RESPAWN_DELAY,
  UFO_EXPLOSION_PARTICLES,
  UFO_MIN_LEVEL,
  UFO_POINTS,
  UFO_SPAWN_MAX,
  UFO_SPAWN_MIN,
  WORLD_H,
  WORLD_W,
} from "./constants";
import type { EnginePhase, EngineStats } from "@/games/types";
import { Asteroid, Bullet, Particle, PowerUp, Ship, Ufo, dist, rand } from "./entities";

export type AsteroidsStats = EngineStats;

// ready: pantalla "PULSA ESPACIO"; dead: esperando reaparición (2 s); over: partida terminada.
export type AsteroidsPhase = EnginePhase;

export type AsteroidsCallbacks = {
  onStats(stats: AsteroidsStats): void;
  onPhase(phase: AsteroidsPhase): void;
};

export type AsteroidsGame = {
  pause(): void;
  resume(): void;
  end(): void;
  reset(): void;
  destroy(): void;
};

const PREVENT_CODES = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);

function isFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not acquire 2D canvas context");
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(WORLD_W * dpr);
  canvas.height = Math.round(WORLD_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let keys: Record<string, boolean> = {};
  let justPressed: Record<string, boolean> = {};

  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let ufo: Ufo | null = null;
  let ufoBullets: Bullet[] = [];

  let score = 0;
  let lives = INITIAL_LIVES;
  let level = 1;
  let lastEmittedStats: AsteroidsStats = { ...ASTEROIDS_INITIAL_STATS };

  let phase: AsteroidsPhase = "ready";
  let phaseBeforePause: "playing" | "dead" = "playing";
  let deadTimer = 0;
  let gameOverPending = false;

  let powerUpSpawned = false;
  let killsSinceSpawn = 0;
  let ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);

  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;

  function clearInput(): void {
    keys = {};
    justPressed = {};
  }

  function pressed(code: string): boolean {
    const val = !!justPressed[code];
    justPressed[code] = false;
    return val;
  }

  function emitStats(): void {
    if (
      score === lastEmittedStats.score &&
      lives === lastEmittedStats.lives &&
      level === lastEmittedStats.level
    ) {
      return;
    }
    lastEmittedStats = { score, lives, level };
    callbacks.onStats(lastEmittedStats);
  }

  function setPhase(next: AsteroidsPhase): void {
    if (phase === next) return;
    phase = next;
    callbacks.onPhase(phase);
  }

  function spawnAsteroids(count: number): void {
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      do {
        x = rand(0, WORLD_W);
        y = rand(0, WORLD_H);
      } while (Math.hypot(x - WORLD_W / 2, y - WORLD_H / 2) < ASTEROID_SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function explode(x: number, y: number, color: string, count = 8): void {
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(x, y, color));
    }
  }

  function startGame(): void {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    ufo = null;
    ufoBullets = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);
    score = 0;
    lives = INITIAL_LIVES;
    level = 1;
    deadTimer = 0;
    gameOverPending = false;
    spawnAsteroids(4);
    emitStats();
    setPhase("playing");
  }

  function nextLevel(): void {
    level += 1;
    bullets = [];
    particles = [];
    powerUps = [];
    ufo = null;
    ufoBullets = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);
    ship.reset();
    spawnAsteroids(3 + level);
    emitStats();
  }

  function killShip(): void {
    explode(ship.x, ship.y, COLOR_SHIP, 14);
    ship.dead = true;
    lives = Math.max(0, lives - 1);
    emitStats();

    if (lives <= 0) {
      gameOverPending = true;
      deadTimer = GAME_OVER_DELAY;
      setPhase("dead");
    } else {
      gameOverPending = false;
      deadTimer = SHIP_RESPAWN_DELAY;
      setPhase("dead");
    }
  }

  function pause(): void {
    if (phase !== "playing" && phase !== "dead") return;
    phaseBeforePause = phase;
    clearInput();
    setPhase("paused");
  }

  function resume(): void {
    if (phase !== "paused") return;
    lastTime = null;
    setPhase(phaseBeforePause);
  }

  function end(): void {
    gameOverPending = false;
    clearInput();
    setPhase("over");
  }

  function reset(): void {
    clearInput();
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    ufo = null;
    ufoBullets = [];
    score = 0;
    lives = INITIAL_LIVES;
    level = 1;
    deadTimer = 0;
    gameOverPending = false;
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);
    lastTime = null;
    emitStats();
    setPhase("ready");
  }

  function update(dt: number): void {
    if (phase === "paused") return;

    if (phase === "ready") {
      if (pressed("Space")) {
        startGame();
      }
      return;
    }

    if (phase === "over") {
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (phase === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      powerUps.forEach((p) => p.update(dt));
      powerUps = powerUps.filter((p) => !p.dead);
      ufoBullets.forEach((b) => b.update(dt));
      ufoBullets = ufoBullets.filter((b) => !b.dead);
      if (ufo) {
        ufo.update(dt);
        if (ufo.dead) {
          ufo = null;
          ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);
        }
      }

      if (deadTimer <= 0) {
        if (gameOverPending) {
          gameOverPending = false;
          setPhase("over");
        } else {
          ship.reset();
          setPhase("playing");
        }
      }
      return;
    }

    // phase === "playing"
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt, {
      left: !!keys["ArrowLeft"],
      right: !!keys["ArrowRight"],
      thrust: !!keys["ArrowUp"],
    });

    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));
    ufoBullets.forEach((b) => b.update(dt));

    // Aparición y actualización del OVNI (desde nivel 2)
    if (level >= UFO_MIN_LEVEL) {
      if (!ufo) {
        ufoSpawnTimer -= dt;
        if (ufoSpawnTimer <= 0) {
          ufo = new Ufo();
        }
      } else {
        ufo.update(dt);
        if (ufo.dead) {
          ufo = null;
          ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);
        } else {
          const shot = ufo.tryShoot();
          if (shot) ufoBullets.push(shot);
        }
      }
    }

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);
    ufoBullets = ufoBullets.filter((b) => !b.dead);

    // Recoger power-up
    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala de la nave vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      if (b.dead) continue;
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += ASTEROID_POINTS[a.size];
          explode(a.x, a.y, COLOR_ASTEROID, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn += 1;
            const guaranteed = killsSinceSpawn >= POWERUP_GUARANTEED_KILLS;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }

    // Bala de la nave vs OVNI
    if (ufo && !ufo.dead) {
      for (const b of bullets) {
        if (!b.dead && dist(b, ufo) < ufo.radius + b.radius) {
          b.dead = true;
          ufo.dead = true;
          score += UFO_POINTS;
          explode(ufo.x, ufo.y, COLOR_UFO, UFO_EXPLOSION_PARTICLES);
          ufo = null;
          ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);
          break;
        }
      }
    }

    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);
    emitStats();

    // Colisiones que destruyen la nave
    if (ship.invincible <= 0 && !ship.dead) {
      const shipHitRadius = ship.radius * SHIP_COLLISION_SCALE;
      let hit = false;

      for (const a of asteroids) {
        if (dist(ship, a) < shipHitRadius + a.radius * SHIP_COLLISION_SCALE) {
          hit = true;
          break;
        }
      }

      if (!hit && ufo && !ufo.dead && dist(ship, ufo) < shipHitRadius + ufo.radius) {
        hit = true;
      }

      if (!hit) {
        for (const ub of ufoBullets) {
          if (!ub.dead && dist(ship, ub) < shipHitRadius + ub.radius) {
            ub.dead = true;
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        killShip();
        return;
      }
    }

    // Nivel completado cuando no quedan asteroides (aunque haya un OVNI)
    if (asteroids.length === 0) {
      nextLevel();
    }
  }

  function drawReadyScreen(fontFamily: string): void {
    ctx!.save();
    ctx!.textAlign = "center";
    ctx!.textBaseline = "middle";

    ctx!.fillStyle = COLOR_SHIP;
    ctx!.shadowColor = COLOR_SHIP;
    ctx!.shadowBlur = 16;
    ctx!.font = `bold 52px ${fontFamily}`;
    ctx!.fillText("ASTEROIDES", WORLD_W / 2, WORLD_H / 2 - 22);

    ctx!.shadowBlur = 0;
    ctx!.fillStyle = COLOR_SUBTITLE;
    ctx!.font = `16px ${fontFamily}`;
    ctx!.fillText("PULSA ESPACIO PARA EMPEZAR", WORLD_W / 2, WORLD_H / 2 + 28);
    ctx!.restore();
  }

  function draw(): void {
    const c = ctx!;
    const fontFamily = getComputedStyle(canvas).fontFamily || "monospace";

    c.fillStyle = COLOR_BG;
    c.fillRect(0, 0, WORLD_W, WORLD_H);

    if (phase === "ready") {
      drawReadyScreen(fontFamily);
      return;
    }

    // Partículas (sin shadowBlur pesado por rendimiento)
    if (particles.length > 0) {
      c.save();
      c.shadowBlur = 0;
      for (const p of particles) p.draw(c);
      c.restore();
    }

    // Asteroides (glow por grupo)
    if (asteroids.length > 0) {
      c.save();
      c.shadowColor = COLOR_ASTEROID;
      c.shadowBlur = 10;
      for (const a of asteroids) a.draw(c);
      c.restore();
    }

    // Power-ups (glow por grupo)
    if (powerUps.length > 0) {
      c.save();
      c.shadowColor = COLOR_POWERUP;
      c.shadowBlur = 10;
      for (const p of powerUps) p.draw(c, fontFamily);
      c.restore();
    }

    // OVNI
    if (ufo && !ufo.dead) {
      c.save();
      c.shadowColor = COLOR_UFO;
      c.shadowBlur = 12;
      ufo.draw(c);
      c.restore();
    }

    // Balas de la nave (glow por grupo)
    if (bullets.length > 0) {
      c.save();
      c.shadowColor = COLOR_BULLET;
      c.shadowBlur = 8;
      for (const b of bullets) b.draw(c);
      c.restore();
    }

    // Balas del OVNI (glow por grupo)
    if (ufoBullets.length > 0) {
      c.save();
      c.shadowColor = COLOR_UFO_BULLET;
      c.shadowBlur = 8;
      for (const b of ufoBullets) b.draw(c);
      c.restore();
    }

    // Nave
    ship.draw(c);
  }

  function loop(ts: number): void {
    if (destroyed) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (isFormTarget(e.target)) return;

    if (phase !== "over" && PREVENT_CODES.has(e.code)) {
      e.preventDefault();
    }

    if (!e.repeat && (e.code === "KeyP" || e.code === "Escape")) {
      if (phase === "paused") {
        resume();
      } else if (phase === "playing" || phase === "dead") {
        pause();
      }
      return;
    }

    if (!keys[e.code]) {
      justPressed[e.code] = true;
    }
    keys[e.code] = true;
  }

  function handleKeyUp(e: KeyboardEvent): void {
    if (isFormTarget(e.target)) return;

    if (phase !== "over" && PREVENT_CODES.has(e.code)) {
      e.preventDefault();
    }

    keys[e.code] = false;
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      pause();
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  rafId = requestAnimationFrame(loop);

  return {
    pause,
    resume,
    end,
    reset,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    },
  };
}
