"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TimerProps {
  initialTime: number;
  onTimeUp?: () => void;
  isRunning?: boolean;
  className?: string;
}

export function Timer({ 
  initialTime, 
  onTimeUp, 
  isRunning = true,
  className 
}: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    setTimeLeft(initialTime);
  }, [initialTime]);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
      if (timeLeft <= 0 && onTimeUp) {
        onTimeUp();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, timeLeft, onTimeUp]);

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
