import type { Team, Player, Question } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import Scoreboard from "./Scoreboard";
import Timer from "./Timer";
import QuestionCard from "./QuestionCard";

type GameScreenProps = {
  teams: Team[];
  currentPlayer: Player;
  question: Question;
  onAnswer: (question: Question, answer: string) => void;
  onNextQuestion: () => void;
  duration: number;
  onTimeout: () => void;
  gameStartedAt: Timestamp | null | undefined;
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
}: GameScreenProps) {

  const playerTeam = teams.find(t => t.name === currentPlayer.teamName);
  if (!playerTeam) return null;

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8">
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
      <aside className="lg:col-span-1 order-1 lg:order-2 space-y-8">
        <Timer duration={duration} onTimeout={onTimeout} gameStartedAt={gameStartedAt} />
        <Scoreboard team={playerTeam} />
      </aside>
    </div>
  );
}
