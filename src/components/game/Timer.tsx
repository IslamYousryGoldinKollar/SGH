
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Timestamp } from "firebase/firestore";

interface TimerProps {
  initialTime: number; // Total duration in seconds
  gameStartedAt: Timestamp | null | undefined;
  onTimeUp?: () => void;
  isRunning?: boolean;
  className?: string;
}

export function Timer({ 
  initialTime, 
  gameStartedAt,
  onTimeUp, 
  isRunning = true,
  className 
}: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    if (!isRunning || !gameStartedAt) {
      return;
    }

    const startTime = gameStartedAt.toMillis();
    const endTime = startTime + initialTime * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const remainingSeconds = Math.ceil(remaining / 1000);
      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0 && onTimeUp) {
        onTimeUp();
      }
    };
    
    updateTimer(); // Initial call to set the time immediately

    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [isRunning, gameStartedAt, initialTime, onTimeUp]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isLowTime = timeLeft <= 60;
  const isCriticalTime = timeLeft <= 30;

  return (
    <div className={cn(
      "text-center",
      className
    )}>
      <span className={cn(
        "text-5xl md:text-6xl font-bold tracking-tight drop-shadow-lg transition-colors duration-300",
        isCriticalTime ? "text-red-500 animate-pulse" : 
        isLowTime ? "text-orange-400" : 
        "text-white"
      )}>
        {formatTime(timeLeft)}
      </span>
    </div>
  );
}

export default Timer;
