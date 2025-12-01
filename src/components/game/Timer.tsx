
"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock } from "lucide-react";
import type { Timestamp } from "firebase/firestore";

type TimerProps = {
  duration: number;
  onTimeout: () => void;
  gameStartedAt: Timestamp | null | undefined;
};

export default function Timer({ duration, onTimeout, gameStartedAt }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!gameStartedAt) {
        setTimeLeft(duration);
        return;
    };

    const startTime = gameStartedAt.toMillis();
    const endTime = startTime + duration * 1000;

    const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const remainingSeconds = Math.ceil(remaining / 1000);
        
        setTimeLeft(remainingSeconds);

        if (remainingSeconds <= 0) {
            onTimeout();
        }
    }

    const intervalId = setInterval(updateTimer, 1000);
    updateTimer(); // Initial call

    return () => clearInterval(intervalId);
  }, [duration, onTimeout, gameStartedAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const timeColor = timeLeft <= 10 ? "text-red-500" : timeLeft <= 30 ? "text-yellow-400" : "text-white";

  return (
    <div className="text-center backdrop-blur-sm p-2">
      <p className={`text-6xl font-bold font-display transition-colors duration-500 drop-shadow-2xl ${timeColor}`}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </p>
    </div>
  );
}
