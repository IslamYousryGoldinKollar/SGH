
"use client";

import { useState, useEffect, useRef } from "react";
import type { EmojiEvent } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";

type EmojiDisplayProps = {
  emojiEvents: EmojiEvent[] | undefined;
  opponentId: string;
};

export default function EmojiDisplay({ emojiEvents, opponentId }: EmojiDisplayProps) {
  const [displayedEmojis, setDisplayedEmojis] = useState<EmojiEvent[]>([]);
  const lastProcessedEventId = useRef<string | null>(null);

  useEffect(() => {
    if (!emojiEvents || emojiEvents.length === 0) return;

    const latestOpponentEvent = emojiEvents
      .filter((e) => e.senderId === opponentId)
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())[0];

    if (latestOpponentEvent && latestOpponentEvent.id !== lastProcessedEventId.current) {
        lastProcessedEventId.current = latestOpponentEvent.id;
        
        setDisplayedEmojis(prev => [...prev, latestOpponentEvent]);
        
        setTimeout(() => {
          setDisplayedEmojis(prev => prev.filter(e => e.id !== latestOpponentEvent.id));
        }, 3000); // Display emoji for 3 seconds
    }
  }, [emojiEvents, opponentId]);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {displayedEmojis.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 50, scale: 0.5, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1.5 }}
            exit={{ opacity: 0, y: -50, scale: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute text-6xl"
            style={{
              // Add some randomness to position to avoid overlap
              top: `${20 + (index % 4) * 15 + Math.random() * 10}%`,
              left: `${20 + (index % 5) * 15 + Math.random() * 10}%`,
            }}
          >
            {event.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
