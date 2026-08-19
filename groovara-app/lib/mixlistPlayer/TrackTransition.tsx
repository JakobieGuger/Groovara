"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { motion, useAnimationControls } from "framer-motion";

type TrackTransitionProps = {
  transitionKey: string;
  children: ReactNode;
};

export default function TrackTransition({
  transitionKey,
  children,
}: TrackTransitionProps) {
  const controls = useAnimationControls();

  useEffect(() => {
    controls.set({ opacity: 0.78, y: 8, scale: 0.992 });
    void controls.start({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
    });
  }, [controls, transitionKey]);

  // Keep the child tree mounted between songs. In particular, this lets the
  // YouTube IFrame API reuse one player instead of replacing the iframe on
  // every reveal, which gives mobile browsers a much better chance of
  // continuing playback after the listener has interacted with the player.
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={controls}
    >
      {children}
    </motion.div>
  );
}
