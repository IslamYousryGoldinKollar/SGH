
import type { Team, Player, Question, EmojiEvent, SessionType } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import Scoreboard from "./Scoreboard";
import Timer from "./Timer";
import QuestionCard from "./QuestionCard";
import EmojiBar from "./EmojiBar";
import EmojiDisplay from "./EmojiDisplay";
import LandRushBoard from "./LandRushBoard";

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
  onSendEmoji: (emoji: string) => void;
  emojiEvents: EmojiEvent[] | undefined;
  sessionType?: SessionType;
  grid: any[];
  onTileClick: (tileId: number) => void;
  isStealing: boolean;
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
  onSendEmoji,
  emojiEvents,
  sessionType,
  grid,
  onTileClick,
  isStealing,
}: GameScreenProps) {

  const playerTeam = teams.find(t => t.name === currentPlayer.teamName);
  if (!playerTeam) return null;
  
  const is1v1 = (isIndividualMode || sessionType === 'land-rush') && teams.length === 2;
  const opponentTeam = is1v1 ? teams.find(t => t.name !== currentPlayer.teamName) : null;
  
  if (sessionType === 'land-rush') {
    return (
       <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 relative h-full">
         {is1v1 && opponentTeam && <EmojiDisplay emojiEvents={emojiEvents} opponentId={opponentTeam.players[0].id} />}
         <div className="lg:col-span-2 order-2 lg:order-1 flex flex-col">
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
         <aside className="lg:col-span-1 order-1 lg:order-2 flex flex-col gap-4">
            <Timer duration={duration} onTimeout={onTimeout} gameStartedAt={gameStartedAt} />
             <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
              <Scoreboard team={playerTeam} />
              {opponentTeam && <Scoreboard team={opponentTeam} />}
            </div>
             <LandRushBoard 
                grid={grid}
                teams={teams}
                onTileClick={onTileClick}
                credits={currentPlayer.coloringCredits}
                currentPlayerId={currentPlayer.id}
                isStealing={isStealing}
             />
             <div className="mt-auto">
                <EmojiBar onSendEmoji={onSendEmoji} />
             </div>
         </aside>
       </div>
    )
  }

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 relative">
      {is1v1 && opponentTeam && <EmojiDisplay emojiEvents={emojiEvents} opponentId={opponentTeam.players[0].id} />}
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
        
        {is1v1 && <EmojiBar onSendEmoji={onSendEmoji} />}

      </aside>
    </div>
  );
}
