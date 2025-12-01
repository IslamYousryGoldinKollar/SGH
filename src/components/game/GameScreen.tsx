import type { Team, Player, Question, GridSquare } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import { useState } from 'react';
import Scoreboard from "./Scoreboard";
import Timer from "./Timer";
import QuestionCard from "./QuestionCard";
import ColorGridScreen from "./ColorGridScreen";
import { cn } from "@/lib/utils";

type GameScreenProps = {
  teams: Team[];
  currentPlayer: Player;
  question: Question;
  onAnswer: (question: Question, answer: string) => void;
  onColorSquare: (squareId: number) => void;
  grid: GridSquare[];
  duration: number;
  onTimeout: () => void;
  gameStartedAt: Timestamp | null | undefined;
  isIndividualMode: boolean;
};

export default function GameScreen({
  teams,
  currentPlayer,
  question,
  onAnswer,
  onColorSquare,
  grid,
  duration,
  onTimeout,
  gameStartedAt,
  isIndividualMode,
}: GameScreenProps) {
  const [showColorGrid, setShowColorGrid] = useState(false);

  const playerTeam = teams.find(t => t.name === currentPlayer.teamName);
  if (!playerTeam) return null;
  
  const handleAnswer = (q: Question, a: string) => {
    const isCorrect = q.answer === a;
    onAnswer(q, a);
    if (isCorrect) {
      // Only show color grid if the player has credits.
      const playerState = teams.flatMap(t => t.players).find(p => p.id === currentPlayer.id);
      if (playerState && playerState.coloringCredits > 0) {
        setShowColorGrid(true);
      }
    }
  }

  const handleColorSquareAndProceed = (squareId: number) => {
    onColorSquare(squareId);
    setShowColorGrid(false);
  }
  
  const handleSkipColoring = () => {
      // The parent component should handle moving to the next question
      onColorSquare(-1); // Use a sentinel value to indicate a skip
      setShowColorGrid(false);
  }

  if (showColorGrid) {
    return (
        <ColorGridScreen 
            grid={grid}
            teams={teams}
            onColorSquare={handleColorSquareAndProceed}
            teamColoring={playerTeam.color}
            credits={currentPlayer.coloringCredits}
            onSkip={handleSkipColoring}
        />
    )
  }

  return (
    <div className={cn("flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 relative", isIndividualMode ? "mobile-grid-background" : "game-screen")}>
      <div className="lg:col-span-3 order-2 lg:order-1">
        {question ? (
          <QuestionCard 
            key={question.question} 
            question={question} 
            onAnswer={handleAnswer} 
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Loading next question...</p>
          </div>
        )}
      </div>
      <aside className="lg:col-span-1 order-1 lg:order-2 flex flex-row lg:flex-col gap-4 items-stretch">
        <Timer duration={duration} onTimeout={onTimeout} gameStartedAt={gameStartedAt} />
        {!isIndividualMode && <Scoreboard team={playerTeam} />}
      </aside>
    </div>
  );
}
