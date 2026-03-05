"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

type FloatingWordsProps = {
  words: string[];
  accentColor: string;
  textColor: string;
};

type WordConfig = {
  word: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  color: string;
};

function layoutWords(words: string[], accentColor: string, textColor: string): WordConfig[] {
  const anchors = [
    { x: 5, y: 20 },
    { x: 82, y: 22 },
    { x: 10, y: 38 },
    { x: 76, y: 42 },
    { x: 6, y: 60 },
    { x: 80, y: 65 },
    { x: 14, y: 80 },
    { x: 72, y: 86 },
  ];

  return words.slice(0, anchors.length).map((word, i) => ({
    word,
    x: anchors[i].x,
    y: anchors[i].y,
    size: i < 2 ? 22 : i < 5 ? 16 : 13,
    opacity: i < 2 ? 0.22 : i < 5 ? 0.16 : 0.1,
    duration: 10 + i * 0.9,
    delay: i * 0.4,
    color: i % 2 === 0 ? accentColor : textColor,
  }));
}

export function FloatingWords({ words, accentColor, textColor }: FloatingWordsProps) {
  const layout = useMemo(() => layoutWords(words, accentColor, textColor), [
    words,
    accentColor,
    textColor,
  ]);

  if (layout.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
      {layout.map((cfg, i) => (
        <motion.span
          key={`${cfg.word}-${i}`}
          className="absolute whitespace-nowrap font-light tracking-wide"
          style={{
            left: `${cfg.x}%`,
            top: `${cfg.y}%`,
            fontSize: cfg.size,
            color: cfg.color,
          }}
          animate={{
            opacity: [0, cfg.opacity, cfg.opacity, 0],
            y: [0, -8, -16, -22],
            x: [0, i % 2 === 0 ? 5 : -5, i % 2 === 0 ? -2 : 2, 0],
          }}
          transition={{
            duration: cfg.duration,
            delay: cfg.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {cfg.word}
        </motion.span>
      ))}
    </div>
  );
}
