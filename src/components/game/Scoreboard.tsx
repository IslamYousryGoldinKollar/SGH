"use client";

import { cn } from "@/lib/utils";

interface ScoreboardProps {
  score: number;
  totalQuestions?: number;
  currentQuestion?: number;
  className?: string;
}

export function Scoreboard({ 
  score, 
  totalQuestions, 
  currentQuestion,
  className 
}: ScoreboardProps) {
  return (
    <div className={cn(
      "bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4",
      className
    )}>
      <div className="flex items-center justify-between">
        {currentQuestion !== undefined && totalQuestions !== undefined && (
          <div className="text-gray-500 text-sm">
            Question {currentQuestion + 1} / {totalQuestions}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-sm">Score:</span>
          <span className="text-2xl font-bold text-cyan-600">{score}</span>
          <span className="text-cyan-600 font-semibold">PTS</span>
        </div>
      </div>
    </div>
  );
}

export default Scoreboard;
