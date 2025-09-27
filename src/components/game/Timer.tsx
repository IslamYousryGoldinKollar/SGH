"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const timeColor = timeLeft <= 10 ? "text-red-500" : timeLeft <= 30 ? "text-yellow-400" : "text-primary";

  return (
    <Card className="text-center bg-card/50 backdrop-blur-sm shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 font-display">
          <Clock className="h-5 w-5" />
          Time Remaining
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-5xl font-bold font-mono transition-colors duration-500 ${timeColor}`}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </p>
      </CardContent>
    </Card>
  );
}
