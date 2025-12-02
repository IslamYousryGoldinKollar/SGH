
import type { Team, Player, Question, GridSquare } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import Scoreboard from "@/components/game/Scoreboard";
import Timer from "@/components/game/Timer";
import QuestionCard from "@/components/game/QuestionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, HelpCircle, Palette } from "lucide-react";

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
  grid,
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
  // Calculate progress for bar
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="game-screen flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
      {/* LEFT: Question Area */}
      <div className="lg:col-span-3 order-2 lg:order-1">
        <QuestionCard
          question={question}
          questionPhase={questionPhase}
          lastAnswerCorrect={lastAnswerCorrect}
          onAnswer={onAnswer}
          className="question-card h-full min-h-96"
          isIndividualMode={isIndividualMode}
        />
      </div>

      {/* RIGHT: Sidebar */}
      <aside className="lg:col-span-1 order-1 lg:order-2 flex flex-col gap-4">
        <Timer duration={duration} onTimeout={onTimeout} gameStartedAt={gameStartedAt} />
        
        {/* CONDITIONAL SIDEBAR */}
        {!isIndividualMode ? (
          <Scoreboard team={playerTeam} />
        ) : (
          /* FIX FOR ISSUE #3: Dedicated Individual Mode Card */
          <Card className="individual-stats-card bg-white/90 backdrop-blur-md border-white/20 shadow-lg">
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
      </aside>
    </div>
  );
}
