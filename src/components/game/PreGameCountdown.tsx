
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Swords } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

interface PreGameCountdownProps {
  gameStartedAt: Timestamp | null | undefined;
  onFinish: () => void;
}

export default function PreGameCountdown({ gameStartedAt, onFinish }: PreGameCountdownProps) {
  const [count, setCount] = useState(5);

  const calculateRemaining = useCallback(() => {
    if (!gameStartedAt) return 5;
    const startTime = gameStartedAt.toMillis();
    const now = Date.now();
    const remaining = Math.max(0, startTime - now);
    return Math.ceil(remaining / 1000);
  }, [gameStartedAt]);

  useEffect(() => {
    const updateCountdown = () => {
      const remainingSeconds = calculateRemaining();
      setCount(remainingSeconds);

      if (remainingSeconds <= 0) {
        onFinish();
        if (intervalId) clearInterval(intervalId);
      }
    };
    
    const intervalId = setInterval(updateCountdown, 500);
    updateCountdown(); // Initial call

    return () => clearInterval(intervalId);
  }, [calculateRemaining, onFinish]);

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center text-center z-50 animate-in fade-in">
      <Swords className="h-24 w-24 text-primary animate-pulse" />
      <p className="text-2xl text-muted-foreground mt-8">Match Found! Game starting in...</p>
      <h1 className="text-9xl font-bold font-mono text-primary animate-ping-short" style={{ animationIterationCount: 1, animationDelay: `${(count - Math.floor(count)) * 1000}ms` }} key={count}>
        {count}
      </h1>
    </div>
  );
}
