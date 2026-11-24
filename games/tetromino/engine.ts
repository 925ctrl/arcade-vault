import type { EnginePhase, EngineStats } from "@/games/types";
import {
  type Board,
  type Piece,
  collide,
  createBoard,
  dropIntervalMs,
  fullRows,
  ghostY,
  merge,
  randomPiece,
  removeRows,
  tryRotate,
} from "./board";
import {
  BOARD_H,
  BOARD_W,
  BOARD_X,
  BOARD_Y,
  CELL_SIZE,
  COLOR_BG,
  COLOR_CYAN,
  COLOR_GREEN,
  COLOR_GRID,
  COLOR_SUBTITLE,
  COLS,
  DEAD_DURATION_MS,
  DEAD_ROW_INTERVAL_MS,
  FLASH_DURATION_MS,
  HARD_DROP_POINTS,
  LINE_SCORES,
  LINES_PER_LEVEL,
  MAX_DT_MS,
  MAX_SCORE,
  NEXT_BOX_SIZE,
  NEXT_BOX_X,
  NEXT_BOX_Y,
  NEXT_LABEL_X,
  NEXT_LABEL_Y,
  PIECE_COLORS,
  ROWS,
  SOFT_DROP_POINTS,
  TETROMINO_INITIAL_STATS,
  WORLD_H,
  WORLD_W,
} from "./constants";

export type TetrominoCallbacks = {
  onStats(stats: EngineStats): void;
  onPhase(phase: EnginePhase): void;
};

export type TetrominoGame = {
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
  "KeyX",
]);

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

export function createTetrominoGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrominoCallbacks,
): TetrominoGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not acquire 2D canvas context");
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(WORLD_W * dpr);
  canvas.height = Math.round(WORLD_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let board: Board = createBoard();
  let current: Piece | null = null;
  let next: Piece | null = null;

  let score = 0;
  let lines = 0;
  let level = 1;
  let lastEmittedStats: EngineStats = { ...TETROMINO_INITIAL_STATS };

  let phase: EnginePhase = "ready";
  let phaseBeforePause: "playing" | "dead" = "playing";

  let dropAccum = 0;
  let flashingRows: number[] = [];
  let flashTimer = 0;
  let deadTimer = 0;
  let deadFilledRows = 0;

  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;

  function addScore(points: number): void {
    if (points <= 0) return;
    score = Math.min(MAX_SCORE, score + points);
  }

  function emitStats(): void {
    if (
      score === lastEmittedStats.score &&
      lines === lastEmittedStats.lines &&
      level === lastEmittedStats.level
    ) {
      return;
    }
    lastEmittedStats = { score, lines, level };
    callbacks.onStats(lastEmittedStats);
  }

  function setPhase(nextPhase: EnginePhase): void {
    if (phase === nextPhase) return;
    phase = nextPhase;
    callbacks.onPhase(phase);
  }

  function spawnNext(): void {
    const piece = next ?? randomPiece();
    next = randomPiece();
    dropAccum = 0;

    if (collide(board, piece.shape, piece.x, piece.y)) {
      current = null;
      deadTimer = 0;
      deadFilledRows = 0;
      setPhase("dead");
      return;
    }

    current = piece;
  }

  function lockPiece(): void {
    if (!current) return;
    board = merge(board, current);
    current = null;
    dropAccum = 0;

    const full = fullRows(board);
    if (full.length > 0) {
      flashingRows = full;
      flashTimer = 0;
    } else {
      spawnNext();
    }
  }

  function softDrop(): void {
    if (!current) return;
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y += 1;
      dropAccum = 0;
      addScore(SOFT_DROP_POINTS);
      emitStats();
    } else {
      lockPiece();
    }
  }

  function hardDrop(): void {
    if (!current) return;
    const gy = ghostY(board, current);
    const distance = gy - current.y;
    if (distance > 0) {
      addScore(distance * HARD_DROP_POINTS);
    }
    current.y = gy;
    emitStats();
    lockPiece();
  }

  function startGame(): void {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropAccum = 0;
    flashingRows = [];
    flashTimer = 0;
    deadTimer = 0;
    deadFilledRows = 0;
    next = randomPiece();
    emitStats();
    setPhase("playing");
    spawnNext();
  }

  function pause(): void {
    if (phase !== "playing" && phase !== "dead") return;
    phaseBeforePause = phase;
    setPhase("paused");
  }

  function resume(): void {
    if (phase !== "paused") return;
    lastTime = null;
    setPhase(phaseBeforePause);
  }

  function end(): void {
    setPhase("over");
  }

  function reset(): void {
    board = createBoard();
    current = null;
    next = null;
    score = 0;
    lines = 0;
    level = 1;
    dropAccum = 0;
    flashingRows = [];
    flashTimer = 0;
    deadTimer = 0;
    deadFilledRows = 0;
    lastTime = null;
    emitStats();
    setPhase("ready");
  }

  function update(dtMs: number): void {
    if (phase === "paused" || phase === "ready" || phase === "over") return;

    if (phase === "dead") {
      deadTimer += dtMs;
      deadFilledRows = Math.min(ROWS, Math.floor(deadTimer / DEAD_ROW_INTERVAL_MS));
      if (deadTimer >= DEAD_DURATION_MS) {
        deadFilledRows = ROWS;
        setPhase("over");
      }
      return;
    }

    // phase === "playing"
    if (flashingRows.length > 0) {
      flashTimer += dtMs;
      if (flashTimer >= FLASH_DURATION_MS) {
        const cleared = flashingRows.length;
        board = removeRows(board, flashingRows);
        flashingRows = [];
        flashTimer = 0;
        addScore((LINE_SCORES[cleared] ?? 0) * level);
        lines += cleared;
        level = Math.floor(lines / LINES_PER_LEVEL) + 1;
        emitStats();
        spawnNext();
      }
      return;
    }

    if (!current) return;

    dropAccum += dtMs;
    const interval = dropIntervalMs(level);
    if (dropAccum >= interval) {
      dropAccum -= interval;
      if (!collide(board, current.shape, current.x, current.y + 1)) {
        current.y += 1;
      } else {
        lockPiece();
      }
    }
  }

  function drawGridAndFrame(c: CanvasRenderingContext2D): void {
    // Rejilla interior
    c.save();
    c.strokeStyle = COLOR_GRID;
    c.lineWidth = 0.5;
    c.globalAlpha = 0.4;
    c.beginPath();
    for (let col = 1; col < COLS; col++) {
      const x = BOARD_X + col * CELL_SIZE;
      c.moveTo(x, BOARD_Y);
      c.lineTo(x, BOARD_Y + BOARD_H);
    }
    for (let row = 1; row < ROWS; row++) {
      const y = BOARD_Y + row * CELL_SIZE;
      c.moveTo(BOARD_X, y);
      c.lineTo(BOARD_X + BOARD_W, y);
    }
    c.stroke();
    c.restore();

    // Marco del tablero
    c.save();
    c.strokeStyle = COLOR_CYAN;
    c.lineWidth = 2;
    c.shadowColor = COLOR_CYAN;
    c.shadowBlur = 10;
    c.strokeRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    c.restore();
  }

  function drawReadyScreen(
    c: CanvasRenderingContext2D,
    fontFamily: string,
  ): void {
    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";

    c.fillStyle = COLOR_CYAN;
    c.shadowColor = COLOR_CYAN;
    c.shadowBlur = 16;
    c.font = `bold 44px ${fontFamily}`;
    c.fillText("TETROMINO", WORLD_W / 2, WORLD_H / 2 - 22);

    c.shadowBlur = 0;
    c.fillStyle = COLOR_SUBTITLE;
    c.font = `16px ${fontFamily}`;
    c.fillText("PULSA ESPACIO PARA EMPEZAR", WORLD_W / 2, WORLD_H / 2 + 28);
    c.restore();
  }

  function drawNextBoxChrome(
    c: CanvasRenderingContext2D,
    fontFamily: string,
  ): void {
    c.save();
    c.fillStyle = COLOR_SUBTITLE;
    c.font = `12px ${fontFamily}`;
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    c.fillText("SIGUIENTE", NEXT_LABEL_X, NEXT_LABEL_Y);

    c.strokeStyle = COLOR_GRID;
    c.lineWidth = 1.5;
    c.strokeRect(NEXT_BOX_X, NEXT_BOX_Y, NEXT_BOX_SIZE, NEXT_BOX_SIZE);
    c.restore();
  }

  function draw(): void {
    const c = ctx!;
    const fontFamily = getComputedStyle(canvas).fontFamily || "monospace";

    c.fillStyle = COLOR_BG;
    c.fillRect(0, 0, WORLD_W, WORLD_H);

    drawGridAndFrame(c);

    if (phase === "ready") {
      drawReadyScreen(c, fontFamily);
      return;
    }

    drawNextBoxChrome(c, fontFamily);

    // Agrupar bloques por color para aplicar un solo shadowBlur por grupo
    const blocksByColor = new Map<string, Array<{ x: number; y: number }>>();
    const addBlock = (color: string | null, x: number, y: number): void => {
      if (!color) return;
      let list = blocksByColor.get(color);
      if (!list) {
        list = [];
        blocksByColor.set(color, list);
      }
      list.push({ x, y });
    };

    const flashSet = new Set(flashingRows);
    const deadStartRow = ROWS - deadFilledRows;

    // Bloques fijados en el tablero
    for (let r = 0; r < ROWS; r++) {
      if (flashSet.has(r) || r >= deadStartRow) continue;
      for (let col = 0; col < COLS; col++) {
        const val = board[r][col];
        if (!val) continue;
        addBlock(
          PIECE_COLORS[val],
          BOARD_X + col * CELL_SIZE,
          BOARD_Y + r * CELL_SIZE,
        );
      }
    }

    // Pieza fantasma (solo borde al 35 %, sin shadowBlur)
    if (
      current &&
      flashingRows.length === 0 &&
      phase !== "dead" &&
      phase !== "over"
    ) {
      const gy = ghostY(board, current);
      const ghostColor = PIECE_COLORS[current.type];
      if (ghostColor) {
        c.save();
        c.strokeStyle = ghostColor;
        c.lineWidth = 2;
        c.globalAlpha = 0.35;
        c.beginPath();
        for (let r = 0; r < current.shape.length; r++) {
          for (let col = 0; col < current.shape[r].length; col++) {
            if (!current.shape[r][col]) continue;
            const py = gy + r;
            if (py < 0) continue;
            c.rect(
              BOARD_X + (current.x + col) * CELL_SIZE + 2,
              BOARD_Y + py * CELL_SIZE + 2,
              CELL_SIZE - 4,
              CELL_SIZE - 4,
            );
          }
        }
        c.stroke();
        c.restore();
      }

      // Pieza actual
      for (let r = 0; r < current.shape.length; r++) {
        for (let col = 0; col < current.shape[r].length; col++) {
          const val = current.shape[r][col];
          if (!val) continue;
          const py = current.y + r;
          if (py < 0) continue;
          addBlock(
            PIECE_COLORS[val],
            BOARD_X + (current.x + col) * CELL_SIZE,
            BOARD_Y + py * CELL_SIZE,
          );
        }
      }
    }

    // Pieza SIGUIENTE centrada en la caja de 4×4
    if (next) {
      let minR = next.shape.length;
      let maxR = -1;
      let minC = next.shape[0].length;
      let maxC = -1;
      for (let r = 0; r < next.shape.length; r++) {
        for (let col = 0; col < next.shape[r].length; col++) {
          if (next.shape[r][col]) {
            if (r < minR) minR = r;
            if (r > maxR) maxR = r;
            if (col < minC) minC = col;
            if (col > maxC) maxC = col;
          }
        }
      }
      if (maxR >= minR && maxC >= minC) {
        const pieceW = (maxC - minC + 1) * CELL_SIZE;
        const pieceH = (maxR - minR + 1) * CELL_SIZE;
        const originX =
          NEXT_BOX_X + (NEXT_BOX_SIZE - pieceW) / 2 - minC * CELL_SIZE;
        const originY =
          NEXT_BOX_Y + (NEXT_BOX_SIZE - pieceH) / 2 - minR * CELL_SIZE;
        for (let r = minR; r <= maxR; r++) {
          for (let col = minC; col <= maxC; col++) {
            const val = next.shape[r][col];
            if (!val) continue;
            addBlock(
              PIECE_COLORS[val],
              originX + col * CELL_SIZE,
              originY + r * CELL_SIZE,
            );
          }
        }
      }
    }

    // Dibujar cada grupo de color: relleno 25 % + borde 2 px con shadowBlur
    for (const [color, blocks] of blocksByColor) {
      c.save();
      c.fillStyle = color;
      c.globalAlpha = 0.25;
      for (const b of blocks) {
        c.fillRect(b.x + 2, b.y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }

      c.globalAlpha = 1;
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.shadowColor = color;
      c.shadowBlur = 10;
      c.beginPath();
      for (const b of blocks) {
        c.rect(b.x + 2, b.y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }
      c.stroke();
      c.restore();
    }

    // Filas en destello (150 ms)
    if (flashingRows.length > 0) {
      c.save();
      c.fillStyle = COLOR_GREEN;
      c.shadowColor = COLOR_GREEN;
      c.shadowBlur = 20;
      for (const r of flashingRows) {
        c.fillRect(
          BOARD_X + 1,
          BOARD_Y + r * CELL_SIZE + 1,
          BOARD_W - 2,
          CELL_SIZE - 2,
        );
      }
      c.restore();
    }

    // Relleno de fin de partida (abajo arriba, 1,5 s)
    if (deadFilledRows > 0) {
      c.save();
      c.fillStyle = COLOR_SUBTITLE;
      c.globalAlpha = 0.5;
      for (let r = deadStartRow; r < ROWS; r++) {
        c.fillRect(
          BOARD_X + 1,
          BOARD_Y + r * CELL_SIZE + 1,
          BOARD_W - 2,
          CELL_SIZE - 2,
        );
      }
      c.restore();
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

    if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) {
      if (phase === "playing" || phase === "dead") {
        pause();
      } else if (phase === "paused") {
        resume();
      }
      return;
    }

    if (phase === "ready") {
      if (e.code === "Space" && !e.repeat) {
        startGame();
      }
      return;
    }

    if (phase !== "playing" || flashingRows.length > 0 || !current) return;

    switch (e.code) {
      case "ArrowLeft":
        if (!collide(board, current.shape, current.x - 1, current.y)) {
          current.x -= 1;
        }
        break;
      case "ArrowRight":
        if (!collide(board, current.shape, current.x + 1, current.y)) {
          current.x += 1;
        }
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        if (!e.repeat) {
          current = tryRotate(board, current);
        }
        break;
      case "Space":
        if (!e.repeat) {
          hardDrop();
        }
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (isFormTarget(e.target)) return;
    if (phase !== "over" && PREVENT_CODES.has(e.code)) {
      e.preventDefault();
    }
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
    },
  };
}
