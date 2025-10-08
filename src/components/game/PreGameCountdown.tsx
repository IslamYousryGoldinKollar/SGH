
"use client";

import { useState, useEffect } from 'react';
import { Swords } from 'lucide-react';

interface PreGameCountdownProps {
  onFinish: () => void;
}

export default function PreGameCountdown({ onFinish }: PreGameCountdownProps) {
  const [count, setCount] = useState(5);

  useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onFinish();
    }
  }, [count, onFinish]);

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center text-center z-50 animate-in fade-in">
      <Swords className="h-24 w-24 text-primary animate-pulse" />
      <p className="text-2xl text-muted-foreground mt-8">Match Found! Game starting in...</p>
      <h1 className="text-9xl font-bold font-mono text-primary animate-ping-short" key={count}>
        {count}
      </h1>
    </div>
  );
}
