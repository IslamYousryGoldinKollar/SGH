
import type { Team, Player, Question, GridSquare } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import Scoreboard from "@/components/game/Scoreboard";
import Timer from "@/components/game/Timer";
import QuestionCard from "@/components/game/QuestionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

type QuestionPhase = 'answering' | 'feedback' | 'coloring' | 'transitioning';

type GameScreenProps = {
  teams: Team[];
  currentPlayer: Player;
  question: Question;
  questionPhase: QuestionPhase;
  lastAnswerCorrect: boolean | null;
  onAnswer: (question: Question, answer: string) => void;
  grid: GridSquare[];
  duration: number;
  onTimeout: () => void;
  gameStartedAt: Timestamp | null | undefined;
  isIndividualMode: boolean;
  totalQuestions: number;
  currentQuestionIndex: number;
};

export default function GameScreen({
  teams,
  currentPlayer,
  question,
  questionPhase,
  lastAnswerCorrect,
  onAnswer,
  duration,
  onTimeout,
  gameStartedAt,
  isIndividualMode,
  totalQuestions,
  currentQuestionIndex,
}: GameScreenProps) {
  const playerTeam = teams.find(t => t.name === currentPlayer.teamName);
  if (!playerTeam) return null;

  const answeredCount = currentQuestionIndex;
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto h-full">
      <div className="w-full">
        <Timer 
          initialTime={duration} 
          onTimeUp={onTimeout} 
          gameStartedAt={gameStartedAt}
          isRunning={true} 
          className="mb-4" />
        
        {!isIndividualMode ? (
          <Scoreboard team={playerTeam} />
        ) : (
          <Card className="individual-stats-card bg-white/90 backdrop-blur-md border-white/20 shadow-lg mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Your Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
                <span className="text-sm font-medium text-muted-foreground">Score</span>
                <span className="text-3xl font-bold text-primary">{currentPlayer.score}</span>
              </div>
              
              <div className="space-y-2">
                 <div className="flex justify-between text-sm">
                   <span>Questions</span>
                   <span>{answeredCount} / {totalQuestions}</span>
                 </div>
                 <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-primary transition-all duration-500" 
                     style={{ width: `${progressPercent}%` }} 
                   />
                 </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="w-full flex-1 flex flex-col mt-4 min-h-0">
        <QuestionCard
          question={question}
          questionPhase={questionPhase}
          lastAnswerCorrect={lastAnswerCorrect}
          onAnswer={onAnswer}
          className="question-card flex-1"
          isIndividualMode={isIndividualMode}
        />
      </div>
    </div>
  );
}
