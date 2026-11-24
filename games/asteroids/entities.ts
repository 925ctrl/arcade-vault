import {
  ASTEROID_RADII,
  ASTEROID_SPEEDS,
  BULLET_RADIUS,
  BULLET_SPEED,
  BULLET_TTL,
  COLOR_ASTEROID,
  COLOR_BULLET,
  COLOR_FLAME,
  COLOR_POWERUP,
  COLOR_SHIP,
  COLOR_UFO,
  COLOR_UFO_BULLET,
  POWERUP_RADIUS,
  POWERUP_TTL,
  SHIP_DRAG,
  SHIP_INVINCIBLE_DURATION,
  SHIP_NOSE_OFFSET,
  SHIP_RADIUS,
  SHIP_ROT_SPEED,
  SHIP_SHOOT_COOLDOWN,
  SHIP_THRUST,
  TRIPLE_SPREAD,
  UFO_BULLET_RADIUS,
  UFO_BULLET_SPEED,
  UFO_BULLET_TTL,
  UFO_DIR_CHANGE_MAX,
  UFO_DIR_CHANGE_MIN,
  UFO_EDGE_MARGIN,
  UFO_RADIUS,
  UFO_SHOOT_INTERVAL,
  UFO_SPEED_X,
  UFO_VERTICAL_SPEEDS,
  WORLD_H,
  WORLD_W,
} from "./constants";

export type AsteroidSize = 1 | 2 | 3;

export type ShipControls = {
  left: boolean;
  right: boolean;
  thrust: boolean;
};

export const wrap = (v: number, max: number): number => ((v % max) + max) % max;
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const rand = (min: number, max: number): number => min + Math.random() * (max - min);
export const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));

export class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  radius: number;
  color: string;
  dead = false;

  constructor(
    x: number,
    y: number,
    angle: number,
    speed = BULLET_SPEED,
    ttl = BULLET_TTL,
    radius = BULLET_RADIUS,
    color = COLOR_BULLET,
  ) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.ttl = ttl;
    this.radius = radius;
    this.color = color;
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, WORLD_W);
    this.y = wrap(this.y + this.vy * dt, WORLD_H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: AsteroidSize;
  radius: number;
  rot: number;
  rotSpeed: number;
  verts: Array<[number, number]>;
  dead = false;

  constructor(x: number, y: number, size: AsteroidSize = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = ASTEROID_RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = ASTEROID_SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, WORLD_W);
    this.y = wrap(this.y + this.vy * dt, WORLD_H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    const nextSize = (this.size - 1) as AsteroidSize;
    return [new Asteroid(this.x, this.y, nextSize), new Asteroid(this.x, this.y, nextSize)];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = COLOR_ASTEROID;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) {
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

export class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = POWERUP_RADIUS;
  ttl = POWERUP_TTL;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, WORLD_W);
    this.y = wrap(this.y + this.vy * dt, WORLD_H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, fontFamily = "monospace"): void {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    const r = this.radius * pulse;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = COLOR_POWERUP;
    ctx.lineWidth = 2;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.fillStyle = COLOR_POWERUP;
    ctx.font = `bold 12px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
  }
}

export class Ship {
  x = WORLD_W / 2;
  y = WORLD_H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = SHIP_RADIUS;
  thrusting = false;
  invincible = SHIP_INVINCIBLE_DURATION;
  shootCooldown = 0;
  tripleShot = 0;
  dead = false;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.x = WORLD_W / 2;
    this.y = WORLD_H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = SHIP_RADIUS;
    this.thrusting = false;
    this.invincible = SHIP_INVINCIBLE_DURATION;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, controls: ShipControls): void {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible = Math.max(0, this.invincible - dt);
    if (this.shootCooldown > 0) this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.tripleShot > 0) this.tripleShot = Math.max(0, this.tripleShot - dt);

    if (controls.left) this.angle -= SHIP_ROT_SPEED * dt;
    if (controls.right) this.angle += SHIP_ROT_SPEED * dt;

    this.thrusting = controls.thrust;
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * SHIP_THRUST * dt;
      this.vy += Math.sin(this.angle) * SHIP_THRUST * dt;
    }

    this.vx *= SHIP_DRAG;
    this.vy *= SHIP_DRAG;
    this.x = wrap(this.x + this.vx * dt, WORLD_W);
    this.y = wrap(this.y + this.vy * dt, WORLD_H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = SHIP_SHOOT_COOLDOWN;
    const ox = this.x + Math.cos(this.angle) * SHIP_NOSE_OFFSET;
    const oy = this.y + Math.sin(this.angle) * SHIP_NOSE_OFFSET;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.dead) return;
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.strokeStyle = COLOR_SHIP;
    ctx.shadowColor = COLOR_SHIP;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.stroke();

    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = COLOR_FLAME;
      ctx.shadowColor = COLOR_FLAME;
      ctx.shadowBlur = 10;
      ctx.stroke();
    }

    ctx.restore();
  }
}

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  color: string;
  dead = false;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
    this.color = color;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.max(0, this.ttl / this.life);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

export class Ufo {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = UFO_RADIUS;
  dirTimer: number;
  shootTimer = UFO_SHOOT_INTERVAL;
  dead = false;

  constructor() {
    const fromLeft = Math.random() < 0.5;
    this.x = fromLeft ? -this.radius : WORLD_W + this.radius;
    this.y = rand(UFO_EDGE_MARGIN, WORLD_H - UFO_EDGE_MARGIN);
    this.vx = fromLeft ? UFO_SPEED_X : -UFO_SPEED_X;
    this.vy = UFO_VERTICAL_SPEEDS[randInt(0, UFO_VERTICAL_SPEEDS.length - 1)];
    this.dirTimer = rand(UFO_DIR_CHANGE_MIN, UFO_DIR_CHANGE_MAX);
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y = wrap(this.y + this.vy * dt, WORLD_H);

    if ((this.vx > 0 && this.x > WORLD_W + this.radius) || (this.vx < 0 && this.x < -this.radius)) {
      this.dead = true;
      return;
    }

    this.dirTimer -= dt;
    if (this.dirTimer <= 0) {
      this.vy = UFO_VERTICAL_SPEEDS[randInt(0, UFO_VERTICAL_SPEEDS.length - 1)];
      this.dirTimer = rand(UFO_DIR_CHANGE_MIN, UFO_DIR_CHANGE_MAX);
    }

    this.shootTimer -= dt;
  }

  tryShoot(): Bullet | null {
    if (this.dead || this.shootTimer > 0) return null;
    this.shootTimer = UFO_SHOOT_INTERVAL;
    const angle = rand(0, Math.PI * 2);
    return new Bullet(
      this.x,
      this.y,
      angle,
      UFO_BULLET_SPEED,
      UFO_BULLET_TTL,
      UFO_BULLET_RADIUS,
      COLOR_UFO_BULLET,
    );
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = COLOR_UFO;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";

    // Cuerpo del platillo
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-10, -6);
    ctx.lineTo(10, -6);
    ctx.lineTo(18, 0);
    ctx.lineTo(10, 7);
    ctx.lineTo(-10, 7);
    ctx.closePath();
    ctx.stroke();

    // Línea central
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();

    // Cúpula superior
    ctx.beginPath();
    ctx.moveTo(-7, -6);
    ctx.lineTo(-4, -12);
    ctx.lineTo(4, -12);
    ctx.lineTo(7, -6);
    ctx.stroke();

    ctx.restore();
  }
}
