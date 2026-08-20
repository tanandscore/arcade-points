"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const FIELD_W = 300;
const FIELD_H = 380;
const PADDLE_W = 60;
const PADDLE_H = 10;
const BALL_SIZE = 8;
const ROWS = 5;
const COLS = 7;
const BRICK_W = FIELD_W / COLS;
const BRICK_H = 16;
const TICK_MS = 20;
const BRICK_COLORS = ["#ff5a3c", "#ffb703", "#3ee6e0", "#ff3ea5", "#b6ff3e"];

function freshBricks() {
  const bricks = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      bricks.push({ id: `${r}-${c}`, r, c, alive: true });
    }
  }
  return bricks;
}

export default function BrickBlaster({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [bricks, setBricks] = useState(freshBricks);
  const [paddleX, setPaddleX] = useState(FIELD_W / 2 - PADDLE_W / 2);
  const [ball, setBall] = useState({ x: FIELD_W / 2, y: FIELD_H - 40 });
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const paddleXRef = useRef(paddleX);
  const ballRef = useRef({ x: FIELD_W / 2, y: FIELD_H - 40, vx: 2.4, vy: -3.2 });
  const bricksRef = useRef(bricks);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const fieldRef = useRef(null);

  useEffect(() => {
    bricksRef.current = bricks;
  }, [bricks]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    sfx.lose();
    onFinish(scoreRef.current);
  }

  function resetBall() {
    ballRef.current = { x: FIELD_W / 2, y: FIELD_H - 40, vx: 2.4 * (Math.random() < 0.5 ? 1 : -1), vy: -3.2 };
  }

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      const b = ballRef.current;
      b.x += b.vx;
      b.y += b.vy;

      if (b.x <= BALL_SIZE / 2 || b.x >= FIELD_W - BALL_SIZE / 2) b.vx *= -1;
      if (b.y <= BALL_SIZE / 2) b.vy *= -1;

      // paddle collision
      const paddleY = FIELD_H - 24;
      if (
        b.y >= paddleY - BALL_SIZE / 2 &&
        b.y <= paddleY + PADDLE_H &&
        b.x >= paddleXRef.current &&
        b.x <= paddleXRef.current + PADDLE_W &&
        b.vy > 0
      ) {
        const hitPos = (b.x - paddleXRef.current) / PADDLE_W - 0.5; // -0.5 .. 0.5
        b.vy = -Math.abs(b.vy);
        b.vx = hitPos * 6;
        sfx.click();
      }

      // brick collisions
      const bx = Math.floor(b.x / BRICK_W);
      const by = Math.floor(b.y / BRICK_H);
      const hitBrick = bricksRef.current.find((br) => br.alive && br.r === by && br.c === bx);
      if (hitBrick && b.y < ROWS * BRICK_H + 4) {
        hitBrick.alive = false;
        setBricks((prev) => prev.map((br) => (br.id === hitBrick.id ? { ...br, alive: false } : br)));
        b.vy *= -1;
        scoreRef.current += 10;
        setScore(scoreRef.current);
        sfx.correct();
        if (bricksRef.current.every((br) => !br.alive || br.id === hitBrick.id)) {
          scoreRef.current += 100;
          setScore(scoreRef.current);
          setBricks(freshBricks());
        }
      }

      // ball lost
      if (b.y > FIELD_H) {
        livesRef.current -= 1;
        setLives(livesRef.current);
        sfx.wrong();
        if (livesRef.current <= 0) {
          finish();
          return;
        }
        resetBall();
      }

      setBall({ x: b.x, y: b.y });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function handlePointerMove(e) {
    if (!fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const relX = ((clientX - rect.left) / rect.width) * FIELD_W;
    const clamped = Math.max(0, Math.min(FIELD_W - PADDLE_W, relX - PADDLE_W / 2));
    paddleXRef.current = clamped;
    setPaddleX(clamped);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Move your mouse or finger over the field to steer the paddle. Break every brick — 3 lives, don't let the
          ball fall.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
        <span>Score: <span className="text-textLight">{score}</span></span>
        <span>{"❤️".repeat(lives)}</span>
      </div>
      <div
        ref={fieldRef}
        onMouseMove={handlePointerMove}
        onTouchMove={handlePointerMove}
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor cursor-none"
        style={{ width: FIELD_W, height: FIELD_H, background: "#12092b", maxWidth: "90vw" }}
      >
        {bricks
          .filter((b) => b.alive)
          .map((b) => (
            <div
              key={b.id}
              className="absolute rounded-sm"
              style={{
                left: b.c * BRICK_W + 1,
                top: b.r * BRICK_H + 1,
                width: BRICK_W - 2,
                height: BRICK_H - 2,
                background: BRICK_COLORS[b.r % BRICK_COLORS.length],
              }}
            />
          ))}
        <div
          className="absolute rounded-full"
          style={{ left: ball.x - BALL_SIZE / 2, top: ball.y - BALL_SIZE / 2, width: BALL_SIZE, height: BALL_SIZE, background: accentColor }}
        />
        <div
          className="absolute rounded-md"
          style={{ left: paddleX, top: FIELD_H - 24, width: PADDLE_W, height: PADDLE_H, background: accentColor }}
        />
      </div>
    </div>
  );
}
