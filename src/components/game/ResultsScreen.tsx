
import type { Team, Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type ResultsScreenProps = {
  teams: Team[];
  onPlayAgain: () => void;
  isAdmin: boolean;
};

export default function ResultsScreen({ teams, onPlayAgain, isAdmin }: ResultsScreenProps) {
  
  const allPlayers = teams.flatMap(t => t.players);
  const sortedPlayers = [...allPlayers].sort((a, b) => b.score - a.score);
  
  const topScore = sortedPlayers.length > 0 ? sortedPlayers[0].score : 0;
  const winners = sortedPlayers.filter(p => p.score === topScore && topScore > 0);

  return (
    <div className="flex flex-col items-center justify-center text-center flex-1 animate-in fade-in-50 duration-500">
      <Trophy className="h-24 w-24 text-yellow-400 drop-shadow-lg" />
      
      {winners.length > 0 ? (
        <>
          <h1 className="text-5xl font-bold mt-4 font-display">
            {winners.length > 1 ? "We have a Tie!" : "We have a Winner!"}
          </h1>
          <CardDescription className="text-2xl pt-4">
            Congratulations to our Trivia Titan{winners.length > 1 ? 's' : ''}!
          </CardDescription>

          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {winners.map(winner => (
              <div key={winner.id} className="p-4 bg-card rounded-lg shadow-lg border border-primary">
                <p className="text-2xl font-bold text-primary">{winner.name}</p>
                <p className="text-sm text-muted-foreground">ID: {winner.playerId}</p>
              </div>
            ))}
          </div>

        </>
      ) : (
         <h1 className="text-5xl font-bold mt-4 font-display">Game Over!</h1>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl my-12">
        {teams.map((team) => (
          <Card key={team.name} className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-display" style={{color: team.color}}>{team.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-5xl font-bold" style={{color: team.color}}>{team.score}</p>
              <p className="text-muted-foreground">total points</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="text-3xl font-bold font-display mb-4">Player Leaderboard</h2>
      <Card className="w-full max-w-2xl">
          <CardContent className="p-4">
              <ul className="space-y-2">
                  {sortedPlayers.map((player, index) => (
                      <li key={player.id} className="flex justify-between items-center p-2 rounded-md bg-secondary/30">
                          <span className="font-semibold">{index + 1}. {player.name} <span className="text-xs text-muted-foreground">(ID: {player.playerId})</span></span>
                          <span className="font-bold font-mono text-lg">{player.score} pts</span>
                      </li>
                  ))}
              </ul>
          </CardContent>
      </Card>


      {isAdmin && (
        <Button onClick={onPlayAgain} size="lg" className="mt-12">
          Play Again
        </Button>
      )}
    </div>
  );
}
