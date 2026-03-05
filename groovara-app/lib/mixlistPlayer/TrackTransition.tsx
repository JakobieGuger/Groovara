"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type TrackTransitionProps = {
  activeIndex: number;
  children: ReactNode;
};

export default function TrackTransition({ activeIndex, children }: TrackTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeIndex}
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 1.01 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
