"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

function seeded(i: number, offset = 0): number {
  const x = Math.sin((i + 1) * 9301 + offset * 7919) * 49297;
  return x - Math.floor(x);
}

type Speed = "slow" | "medium" | "fast";

export function Glow({
  x,
  y,
  size,
  color,
  opacity = 0.2,
  breathing = true,
  breathDuration = 10,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity?: number;
  breathing?: boolean;
  breathDuration?: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: "blur(44px)",
        opacity,
      }}
      animate={breathing ? { scale: [1, 1.14, 1], opacity: [opacity, opacity * 1.25, opacity] } : undefined}
      transition={
        breathing
          ? { duration: breathDuration, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
    />
  );
}

export function Particles({
  count,
  color,
  sizeRange = [1, 3],
  speed = "medium",
  direction = "up",
  opacity = 0.25,
}: {
  count: number;
  color: string;
  sizeRange?: [number, number];
  speed?: Speed;
  direction?: "up" | "down" | "random";
  opacity?: number;
}) {
  const durationBase = speed === "slow" ? 24 : speed === "fast" ? 9 : 14;
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const size = sizeRange[0] + seeded(i) * (sizeRange[1] - sizeRange[0]);
        const x = seeded(i, 1) * 100;
        const drift = (seeded(i, 2) - 0.5) * 26;
        const duration = durationBase + seeded(i, 3) * 8;
        return { i, size, x, drift, duration };
      }),
    [count, sizeRange, durationBase]
  );

  const yStart = direction === "down" ? "-8vh" : "108vh";
  const yEnd = direction === "down" ? "108vh" : "-8vh";

  return (
    <>
      {items.map((p) => (
        <motion.div
          key={p.i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            opacity: 0,
          }}
          animate={
            direction === "random"
              ? {
                  y: [yStart, "50vh", yEnd],
                  x: [0, p.drift, -p.drift * 0.5, 0],
                  opacity: [0, opacity, opacity, 0],
                }
              : {
                  y: [yStart, yEnd],
                  x: [0, p.drift, -p.drift * 0.5, 0],
                  opacity: [0, opacity, opacity, 0],
                }
          }
          transition={{
            duration: p.duration,
            delay: seeded(p.i, 4) * p.duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </>
  );
}

export function Rays({
  originX,
  originY,
  count,
  length,
  spread,
  color,
  opacity = 0.1,
}: {
  originX: number;
  originY: number;
  count: number;
  length: number;
  spread: number;
  color: string;
  opacity?: number;
}) {
  const rays = useMemo(() => {
    const step = spread / count;
    const start = -spread / 2;
    return Array.from({ length: count }, (_, i) => ({
      i,
      angle: start + step * i,
      delay: i * 0.2,
    }));
  }, [count, spread]);

  return (
    <>
      {rays.map((r) => (
        <motion.div
          key={r.i}
          className="absolute"
          style={{
            left: `${originX}%`,
            top: `${originY}%`,
            width: 2,
            height: length,
            transformOrigin: "bottom center",
            rotate: `${r.angle}deg`,
            background: `linear-gradient(to top, ${color}, transparent)`,
            opacity: 0,
          }}
          animate={{ opacity: [0, opacity, opacity * 0.6, 0], scaleY: [0.4, 1, 0.8, 0.4] }}
          transition={{
            duration: 9,
            delay: r.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </>
  );
}

export function Pulses({
  x,
  y,
  count,
  maxSize,
  color,
  speed = "medium",
  opacity = 0.16,
}: {
  x: number;
  y: number;
  count: number;
  maxSize: number;
  color: string;
  speed?: Speed;
  opacity?: number;
}) {
  const duration = speed === "slow" ? 7 : speed === "fast" ? 2.6 : 4.2;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: 8,
            height: 8,
            marginLeft: -4,
            marginTop: -4,
            border: `1.5px solid ${color}`,
          }}
          animate={{ scale: [0, maxSize / 8], opacity: [opacity, 0] }}
          transition={{
            duration,
            delay: (duration / count) * i,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </>
  );
}

export function Orbits({
  x,
  y,
  count,
  radius,
  dotSize = 3,
  color,
  speed = "medium",
  opacity = 0.24,
}: {
  x: number;
  y: number;
  count: number;
  radius: number;
  dotSize?: number;
  color: string;
  speed?: Speed;
  opacity?: number;
}) {
  const duration = speed === "slow" ? 20 : speed === "fast" ? 9 : 14;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const r = radius + seeded(i) * 28;
        const offset = (360 / count) * i;
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${x}%`, top: `${y}%` }}
            animate={{
              x: Array.from({ length: 37 }, (_, k) => {
                const angle = ((k * 10 + offset) * Math.PI) / 180;
                return Math.cos(angle) * r;
              }),
              y: Array.from({ length: 37 }, (_, k) => {
                const angle = ((k * 10 + offset) * Math.PI) / 180;
                return Math.sin(angle) * r * 0.7;
              }),
            }}
            transition={{ duration: duration + seeded(i, 1) * 4, repeat: Infinity, ease: "linear" }}
          >
            <div
              className="rounded-full"
              style={{ width: dotSize, height: dotSize, backgroundColor: color, opacity }}
            />
          </motion.div>
        );
      })}
    </>
  );
}

export function Waves({
  count,
  color,
  opacity = 0.08,
}: {
  count: number;
  color: string;
  opacity?: number;
}) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {Array.from({ length: count }, (_, i) => {
        const y = ((i + 1) / (count + 1)) * 100;
        return (
          <motion.path
            key={i}
            fill="none"
            stroke={color}
            strokeWidth="0.5"
            style={{ opacity }}
            d={`M 0 ${y} Q 25 ${y - 2} 50 ${y} T 100 ${y}`}
            animate={{
              d: [
                `M 0 ${y} Q 25 ${y - 2} 50 ${y} T 100 ${y}`,
                `M 0 ${y} Q 25 ${y + 3} 50 ${y} T 100 ${y}`,
                `M 0 ${y} Q 25 ${y - 2} 50 ${y} T 100 ${y}`,
              ],
            }}
            transition={{ duration: 8 + i * 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        );
      })}
    </svg>
  );
}

export function Sparks({
  count,
  color,
  opacity = 0.34,
}: {
  count: number;
  color: string;
  opacity?: number;
}) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        i,
        x: seeded(i) * 100,
        y: seeded(i, 1) * 100,
        dx: (seeded(i, 2) - 0.5) * 120,
        dy: (seeded(i, 3) - 0.5) * 120,
        size: 1.5 + seeded(i, 4) * 2.5,
      })),
    [count]
  );

  return (
    <>
      {items.map((s) => (
        <motion.div
          key={s.i}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            backgroundColor: color,
          }}
          animate={{ x: [0, s.dx], y: [0, s.dy], opacity: [0, opacity, 0], scale: [0, 1, 0] }}
          transition={{ duration: 2 + seeded(s.i, 5) * 1.5, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

export function Morph({
  x,
  y,
  size,
  color,
  opacity = 0.1,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity?: number;
}) {
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        backgroundColor: color,
        filter: "blur(34px)",
        opacity,
      }}
      animate={{
        borderRadius: ["50% 50% 50% 50%", "30% 70% 45% 55%", "65% 35% 70% 30%", "50% 50% 50% 50%"],
        scale: [1, 1.08, 0.95, 1],
        rotate: [0, 6, -4, 0],
      }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function Flicker({ color }: { color: string }) {
  return (
    <motion.div
      className="absolute inset-0"
      style={{ backgroundColor: color }}
      animate={{ opacity: [0.008, 0.024, 0.012, 0.02, 0.008] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
