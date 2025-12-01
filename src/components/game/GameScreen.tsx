
import type { Team, Player, Question, SessionType } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import Scoreboard from "./Scoreboard";
import Timer from "./Timer";
import QuestionCard from "./QuestionCard";
import { cn } from "@/lib/utils";

type GameScreenProps = {
  teams: Team[];
  currentPlayer: Player;
  question: Question;
  onAnswer: (question: Question, answer: string) => void;
  onNextQuestion: () => void;
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
  onNextQuestion,
  duration,
  onTimeout,
  gameStartedAt,
  isIndividualMode,
}: GameScreenProps) {

  const playerTeam = teams.find(t => t.name === currentPlayer.teamName);
  if (!playerTeam) return null;
  
  const is1v1 = isIndividualMode && teams.length === 2;
  const opponentTeam = is1v1 ? teams.find(t => t.name !== currentPlayer.teamName) : null;
  

  return (
    <div className={cn("flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 relative", isIndividualMode && "mobile-grid-background")}>
      <div className="lg:col-span-3 order-2 lg:order-1">
        {question ? (
          <QuestionCard 
            key={question.question} 
            question={question} 
            onAnswer={onAnswer} 
            onNextQuestion={onNextQuestion}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Loading next question...</p>
          </div>
        )}
      </div>
      <aside className="lg:col-span-1 order-1 lg:order-2 flex flex-row lg:flex-col gap-4 items-stretch">
        <Timer duration={duration} onTimeout={onTimeout} gameStartedAt={gameStartedAt} />
        
        {is1v1 ? (
          <div className="flex flex-1 lg:flex-col gap-4">
            <Scoreboard team={playerTeam} />
            {opponentTeam && <Scoreboard team={opponentTeam} />}
          </div>
        ) : (
           !isIndividualMode && <Scoreboard team={playerTeam} />
        )}
        
      </aside>
    </div>
  );
}
