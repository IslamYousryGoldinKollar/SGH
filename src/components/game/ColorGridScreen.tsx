"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ColorGridScreenProps {
  squares?: any;
  teams?: any;
  onColorSquare?: any;
  teamColoring?: any;
  credits?: any;
  onSkip?: any;
  grid?: any;
  teams?: any;
  onColorSquare?: any;
  teamColoring?: any;
  credits?: any;
  onSkip?: any;
  onComplete?: (score: number) => void;
  targetColor?: string;
  gridSize?: number;
  timeLimit?: number;
}

export function ColorGridScreen({
  onComplete,
  targetColor = "#22d3ee",
  gridSize = 4,
  timeLimit = 10,
}: ColorGridScreenProps) {
  const [grid, setGrid] = useState<string[]>([]);
  const [targetIndex, setTargetIndex] = useState<number>(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [gameActive, setGameActive] = useState(true);

  // Generate random colors
  const generateColors = () => {
    const colors = [
      "#ef4444", "#f97316", "#eab308", "#22c55e", 
      "#14b8a6", "#0ea5e9", "#8b5cf6", "#ec4899",
      "#6366f1", "#84cc16", "#f43f5e", "#06b6d4"
    ];
    
    const gridColors: string[] = [];
    const totalCells = gridSize * gridSize;
    
    // Fill with random colors
    for (let i = 0; i < totalCells; i++) {
      gridColors.push(colors[Math.floor(Math.random() * colors.length)]);
    }
    
    // Place target color at random position
    const targetIdx = Math.floor(Math.random() * totalCells);
    gridColors[targetIdx] = targetColor;
    
    setGrid(gridColors);
    setTargetIndex(targetIdx);
  };

  useEffect(() => {
    generateColors();
  }, []);

  useEffect(() => {
    if (!gameActive || timeLeft <= 0) {
      if (timeLeft <= 0) {
        setGameActive(false);
        onComplete?.(score);
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [gameActive, timeLeft, score, onComplete]);

  const handleCellClick = (index: number) => {
    if (!gameActive) return;

    if (index === targetIndex) {
      setScore((prev) => prev + 1);
      generateColors();
    } else {
      // Wrong click - optional: add penalty
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {/* Target Color Display */}
      <div className="mb-4 text-center">
        <p className="text-white mb-2">Find this color:</p>
        <div 
          className="w-16 h-16 rounded-lg border-4 border-white shadow-lg mx-auto"
          style={{ backgroundColor: targetColor }}
        />
      </div>

      {/* Timer and Score */}
      <div className="flex gap-8 mb-4 text-white">
        <div className="text-center">
          <p className="text-sm opacity-70">Time</p>
          <p className={cn(
            "text-2xl font-bold",
            timeLeft <= 5 && "text-red-400 animate-pulse"
          )}>
            {timeLeft}s
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm opacity-70">Score</p>
          <p className="text-2xl font-bold text-cyan-300">{score}</p>
        </div>
      </div>

      {/* Color Grid */}
      <div 
        className="grid gap-2 p-4 bg-white/10 rounded-xl backdrop-blur-sm"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
        }}
      >
        {grid.map((color, index) => (
          <button
            key={index}
            onClick={() => handleCellClick(index)}
            disabled={!gameActive}
            className={cn(
              "w-14 h-14 md:w-16 md:h-16 rounded-lg transition-transform duration-150",
              gameActive && "hover:scale-110 active:scale-95 cursor-pointer",
              !gameActive && "opacity-50 cursor-not-allowed"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* Game Over Message */}
      {!gameActive && (
        <div className="mt-6 text-center text-white">
          <p className="text-xl font-bold">Time's Up!</p>
          <p className="text-lg">Final Score: {score}</p>
        </div>
      )}
    </div>
  );
}

export default ColorGridScreen;
