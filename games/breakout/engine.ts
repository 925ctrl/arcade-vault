import type { EnginePhase, EngineStats } from "@/games/types";
import {
  BALL_RADIUS,
  BALL_SIZE,
  BASE_BALL_SPEED,
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCK_COLOR_HEX,
  BLOCK_INSET,
  BREAKOUT_INITIAL_STATS,
  COLOR_BG,
  COLOR_CYAN,
  COLOR_SUBTITLE,
  COLOR_YELLOW,
  DEAD_DURATION_MS,
  EXPLOSION_DURATION_MS,
  EXPLOSION_GROW_PX,
  INITIAL_LIVES,
  MAX_BOUNCE_ANGLE_RAD,
  MAX_DT_MS,
  MAX_SCORE,
  MAX_SUBSTEP_PX,
  PADDLE_H,
  PADDLE_HIT_TOLERANCE,
  PADDLE_RADIUS,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  POINTS_PER_BLOCK_BASE,
  SOUND_BOUNCE,
  SOUND_BREAK,
  WORLD_H,
  WORLD_W,
} from "./constants";
import { type Block, type BlockColor, buildLevel, levelSpeed } from "./levels";

export type BreakoutCallbacks = {
  onStats(stats: EngineStats): void;
  onPhase(phase: EnginePhase): void;
};

export type BreakoutGame = {
  pause(): void;
  resume(): void;
  end(): void;
  reset(): void;
  destroy(): void;
};

type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
};

const PREVENT_CODES = new Set(["ArrowLeft", "ArrowRight", "Space"]);

function isFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function createBreakoutGame(
  canvas: HTMLCanvasElement,
  callbacks: BreakoutCallbacks,
): BreakoutGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not acquire 2D canvas context");
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(WORLD_W * dpr);
  canvas.height = Math.round(WORLD_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const bounceAudio = new Audio(SOUND_BOUNCE);
  const breakAudio = new Audio(SOUND_BREAK);
  const activeClones = new Set<HTMLAudioElement>();
  let muted = false;

  const paddle = {
    x: (WORLD_W - PADDLE_W) / 2,
    y: PADDLE_Y,
    w: PADDLE_W,
    h: PADDLE_H,
  };

  const ball = {
    x: paddle.x + (PADDLE_W - BALL_SIZE) / 2,
    y: PADDLE_Y - BALL_SIZE,
    w: BALL_SIZE,
    h: BALL_SIZE,
    vx: 0,
    vy: 0,
  };

  let ballStuck = true;
  let blocks: Block[] = buildLevel(1);
  let explosions: Explosion[] = [];

  let score = 0;
  let lives = INITIAL_LIVES;
  let level = 1;
  let lastEmittedStats: EngineStats = { ...BREAKOUT_INITIAL_STATS };

  let phase: EnginePhase = "ready";
  let phaseBeforePause: "playing" | "dead" = "playing";
  let deadTimer = 0;

  const keys = { ArrowLeft: false, ArrowRight: false };

  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;

  function playSound(source: HTMLAudioElement): void {
    if (muted || destroyed || phase !== "playing") return;
    try {
      const clone = source.cloneNode() as HTMLAudioElement;
      const cleanup = (): void => {
        activeClones.delete(clone);
      };
      clone.addEventListener("ended", cleanup, { once: true });
      clone.addEventListener("error", cleanup, { once: true });
      activeClones.add(clone);
      const result = clone.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => {
          activeClones.delete(clone);
        });
      }
    } catch {
      // Ignore audio playback errors
    }
  }

  function stopAllSounds(): void {
    for (const clone of activeClones) {
      try {
        clone.pause();
        clone.currentTime = 0;
      } catch {
        // Ignore cleanup errors
      }
    }
    activeClones.clear();
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

  function setPhase(nextPhase: EnginePhase): void {
    if (phase === nextPhase) return;
    phase = nextPhase;
    callbacks.onPhase(phase);
  }

  function stickBallToPaddle(): void {
    ballStuck = true;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = 0;
    ball.vy = 0;
  }

  function launchBall(): void {
    const mult = levelSpeed(level);
    ballStuck = false;
    ball.vx = BASE_BALL_VX * mult;
    ball.vy = BASE_BALL_VY * mult;
  }

  function startGame(): void {
    setPhase("playing");
  }

  function pause(): void {
    if (phase !== "playing" && phase !== "dead") return;
    phaseBeforePause = phase;
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
    setPhase("paused");
  }

  function resume(): void {
    if (phase !== "paused") return;
    lastTime = null;
    setPhase(phaseBeforePause);
  }

  function end(): void {
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
    setPhase("over");
  }

  function reset(): void {
    score = 0;
    lives = INITIAL_LIVES;
    level = 1;
    blocks = buildLevel(1);
    explosions = [];
    deadTimer = 0;
    paddle.x = (WORLD_W - PADDLE_W) / 2;
    stickBallToPaddle();
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
    lastTime = null;
    emitStats();
    setPhase("ready");
  }

  function updateExplosions(dtMs: number): void {
    if (explosions.length === 0) return;
    for (const exp of explosions) {
      exp.elapsed += dtMs;
    }
    explosions = explosions.filter(
      (exp) => exp.elapsed < EXPLOSION_DURATION_MS,
    );
  }

  function collideAABB(block: Block): boolean {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function update(dtMs: number): void {
    if (phase === "paused" || phase === "ready" || phase === "over") return;

    if (phase === "dead") {
      updateExplosions(dtMs);
      deadTimer += dtMs;
      if (deadTimer >= DEAD_DURATION_MS) {
        setPhase("over");
      }
      return;
    }

    // phase === "playing"
    const dt = dtMs / 1000;

    if (keys.ArrowLeft) {
      paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    }
    if (keys.ArrowRight) {
      paddle.x = Math.min(WORLD_W - paddle.w, paddle.x + PADDLE_SPEED * dt);
    }

    updateExplosions(dtMs);

    if (ballStuck) {
      ball.x = paddle.x + (paddle.w - ball.w) / 2;
      ball.y = paddle.y - ball.h;
      return;
    }

    const speed = Math.hypot(ball.vx, ball.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / MAX_SUBSTEP_PX));
    const stepDt = dt / steps;

    for (let s = 0; s < steps; s++) {
      ball.x += ball.vx * stepDt;
      ball.y += ball.vy * stepDt;

      // 1. Walls and ceiling
      if (ball.x <= 0) {
        ball.x = 0;
        ball.vx = Math.abs(ball.vx);
        playSound(bounceAudio);
      }
      if (ball.x + ball.w >= WORLD_W) {
        ball.x = WORLD_W - ball.w;
        ball.vx = -Math.abs(ball.vx);
        playSound(bounceAudio);
      }
      if (ball.y <= 0) {
        ball.y = 0;
        ball.vy = Math.abs(ball.vy);
        playSound(bounceAudio);
      }

      // 2. Paddle bounce
      if (
        ball.vy > 0 &&
        ball.x + ball.w > paddle.x &&
        ball.x < paddle.x + paddle.w &&
        ball.y + ball.h >= paddle.y &&
        ball.y + ball.h <= paddle.y + paddle.h + PADDLE_HIT_TOLERANCE
      ) {
        ball.y = paddle.y - ball.h;
        const ballCenter = ball.x + ball.w / 2;
        const paddleCenter = paddle.x + paddle.w / 2;
        const offset = Math.max(
          -1,
          Math.min(1, (ballCenter - paddleCenter) / (paddle.w / 2)),
        );
        const angle = offset * MAX_BOUNCE_ANGLE_RAD;
        const v = BASE_BALL_SPEED * levelSpeed(level);
        ball.vx = v * Math.sin(angle);
        ball.vy = -v * Math.cos(angle);
        playSound(bounceAudio);
      }

      // 3. Block collisions (at most 1 per substep)
      for (const block of blocks) {
        if (!block.alive) continue;
        if (!collideAABB(block)) continue;

        block.alive = false;

        const overlapLeft = ball.x + ball.w - block.x;
        const overlapRight = block.x + block.w - ball.x;
        const overlapTop = ball.y + ball.h - block.y;
        const overlapBottom = block.y + block.h - ball.y;
        const overlapX = Math.min(overlapLeft, overlapRight);
        const overlapY = Math.min(overlapTop, overlapBottom);

        if (overlapX < overlapY) {
          ball.vx = -ball.vx;
          if (overlapLeft < overlapRight) {
            ball.x = block.x - ball.w;
          } else {
            ball.x = block.x + block.w;
          }
        } else {
          ball.vy = -ball.vy;
          if (overlapTop < overlapBottom) {
            ball.y = block.y - ball.h;
          } else {
            ball.y = block.y + block.h;
          }
        }

        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });

        score = Math.min(MAX_SCORE, score + POINTS_PER_BLOCK_BASE * level);
        playSound(breakAudio);

        if (blocks.every((b) => !b.alive)) {
          level += 1;
          blocks = buildLevel(level);
          explosions = [];
          stickBallToPaddle();
          emitStats();
          return;
        }

        emitStats();
        break;
      }

      // 4. Ball lost
      if (ball.y > WORLD_H) {
        lives = Math.max(0, lives - 1);
        emitStats();
        if (lives <= 0) {
          deadTimer = 0;
          setPhase("dead");
        } else {
          stickBallToPaddle();
        }
        return;
      }
    }
  }

  function drawBlocks(c: CanvasRenderingContext2D): void {
    const byColor = new Map<BlockColor, Block[]>();
    for (const block of blocks) {
      if (!block.alive) continue;
      let list = byColor.get(block.color);
      if (!list) {
        list = [];
        byColor.set(block.color, list);
      }
      list.push(block);
    }

    for (const [colorKey, group] of byColor) {
      const hex = BLOCK_COLOR_HEX[colorKey];
      c.save();
      c.fillStyle = hex;
      c.globalAlpha = 0.25;
      for (const b of group) {
        c.fillRect(
          b.x + BLOCK_INSET,
          b.y + BLOCK_INSET,
          b.w - BLOCK_INSET * 2,
          b.h - BLOCK_INSET * 2,
        );
      }

      c.globalAlpha = 1;
      c.strokeStyle = hex;
      c.lineWidth = 2;
      c.shadowColor = hex;
      c.shadowBlur = 10;
      c.beginPath();
      for (const b of group) {
        c.rect(
          b.x + BLOCK_INSET,
          b.y + BLOCK_INSET,
          b.w - BLOCK_INSET * 2,
          b.h - BLOCK_INSET * 2,
        );
      }
      c.stroke();
      c.restore();
    }
  }

  function drawExplosions(c: CanvasRenderingContext2D): void {
    for (const exp of explosions) {
      const progress = Math.min(1, exp.elapsed / EXPLOSION_DURATION_MS);
      const grow = EXPLOSION_GROW_PX * progress;
      const hex = BLOCK_COLOR_HEX[exp.color];
      c.save();
      c.fillStyle = hex;
      c.shadowColor = hex;
      c.shadowBlur = 14;
      c.globalAlpha = 1 - progress;
      c.fillRect(
        exp.x - grow,
        exp.y - grow,
        exp.w + grow * 2,
        exp.h + grow * 2,
      );
      c.restore();
    }
  }

  function drawPaddle(c: CanvasRenderingContext2D): void {
    c.save();
    c.beginPath();
    c.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, PADDLE_RADIUS);
    c.fillStyle = COLOR_CYAN;
    c.globalAlpha = 0.25;
    c.fill();

    c.globalAlpha = 1;
    c.strokeStyle = COLOR_CYAN;
    c.lineWidth = 2;
    c.shadowColor = COLOR_CYAN;
    c.shadowBlur = 12;
    c.stroke();
    c.restore();
  }

  function drawBall(c: CanvasRenderingContext2D): void {
    c.save();
    c.beginPath();
    c.arc(
      ball.x + BALL_RADIUS,
      ball.y + BALL_RADIUS,
      BALL_RADIUS,
      0,
      Math.PI * 2,
    );
    c.fillStyle = COLOR_YELLOW;
    c.shadowColor = COLOR_YELLOW;
    c.shadowBlur = 14;
    c.fill();
    c.restore();
  }

  function drawReadyScreen(c: CanvasRenderingContext2D): void {
    const fontFamily = getComputedStyle(canvas).fontFamily || "monospace";
    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";

    c.fillStyle = COLOR_CYAN;
    c.shadowColor = COLOR_CYAN;
    c.shadowBlur = 16;
    c.font = `bold 44px ${fontFamily}`;
    c.fillText("ROMPEMUROS", WORLD_W / 2, 330);

    c.shadowBlur = 0;
    c.fillStyle = COLOR_SUBTITLE;
    c.font = `16px ${fontFamily}`;
    c.fillText("PULSA ESPACIO PARA EMPEZAR", WORLD_W / 2, 380);
    c.restore();
  }

  function draw(): void {
    const c = ctx!;
    c.fillStyle = COLOR_BG;
    c.fillRect(0, 0, WORLD_W, WORLD_H);

    drawBlocks(c);
    drawExplosions(c);
    drawPaddle(c);

    if (phase !== "dead" && !(phase === "over" && lives === 0)) {
      drawBall(c);
    }

    if (phase === "ready") {
      drawReadyScreen(c);
    }
  }

  function loop(ts: number): void {
    if (destroyed) return;
    const dtMs =
      lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT_MS);
    lastTime = ts;

    update(dtMs);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (isFormTarget(e.target)) return;
    if (phase !== "over" && PREVENT_CODES.has(e.code)) {
      e.preventDefault();
    }

    if (e.code === "KeyM" && !e.repeat && phase !== "over") {
      muted = !muted;
      return;
    }

    if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) {
      if (phase === "playing" || phase === "dead") {
        pause();
      } else if (phase === "paused") {
        resume();
      }
      return;
    }

    if (e.code === "ArrowLeft") keys.ArrowLeft = true;
    if (e.code === "ArrowRight") keys.ArrowRight = true;

    if (phase === "ready") {
      if (e.code === "Space" && !e.repeat) {
        startGame();
      }
      return;
    }

    if (phase === "playing") {
      if (e.code === "Space" && !e.repeat && ballStuck) {
        launchBall();
      }
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (isFormTarget(e.target)) return;
    if (phase !== "over" && PREVENT_CODES.has(e.code)) {
      e.preventDefault();
    }
    if (e.code === "ArrowLeft") keys.ArrowLeft = false;
    if (e.code === "ArrowRight") keys.ArrowRight = false;
  }

  function onVisibilityChange(): void {
    if (document.hidden) {
      pause();
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  document.addEventListener("visibilitychange", onVisibilityChange);

  rafId = requestAnimationFrame(loop);

  return {
    pause,
    resume,
    end,
    reset,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopAllSounds();
    },
  };
}
