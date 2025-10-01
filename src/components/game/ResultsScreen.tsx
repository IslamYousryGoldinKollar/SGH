
"use client";

import type { Team, Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";

type ResultsScreenProps = {
  teams: Team[];
  onPlayAgain: () => void;
  isAdmin: boolean;
  individualPlayerId?: string;
};

export default function ResultsScreen({ teams, onPlayAgain, isAdmin, individualPlayerId }: ResultsScreenProps) {
  const router = useRouter();
  
  useEffect(() => {
    if (individualPlayerId) {
      const gameId = teams[0]?.players.find(p => p.id === individualPlayerId)?.teamName === 'Participants' ? teams[0].name : null;
      const game = teams.length > 0 ? teams[0] : null;

      const sessionGameId = game?.players[0]?.customData?.gameId;
      
      const timer = setTimeout(() => {
        router.push(`/leaderboard/${teams[0].name}`);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [individualPlayerId, teams, router]);

  if (individualPlayerId) {
    const player = teams.flatMap(t => t.players).find(p => p.id === individualPlayerId);
    if (!player) return <div className="text-center">Could not load your results.</div>;

    return (
       <div className="flex flex-col items-center justify-center text-center flex-1 animate-in fade-in-50 duration-500">
            <Trophy className="h-24 w-24 text-yellow-400 drop-shadow-lg" />
            <h1 className="text-5xl font-bold mt-4 font-display">Challenge Complete!</h1>
            <CardDescription className="text-2xl pt-4">
                Well done, {player.name}! Here's your score.
            </CardDescription>
            <Card className="my-12 shadow-lg w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl font-display text-primary">{player.name}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-6xl font-bold text-primary">{player.score}</p>
                    <p className="text-muted-foreground">total points</p>
                </CardContent>
            </Card>
            <p className="text-muted-foreground">Redirecting to the leaderboard...</p>
       </div>
    )
  }

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const topScore = sortedTeams.length > 0 ? sortedTeams[0].score : 0;
  const winningTeams = sortedTeams.filter(t => t.score === topScore && topScore > 0);
  const isTie = winningTeams.length > 1;

  const sortedPlayers = [...teams.flatMap(t => t.players)].sort((a, b) => b.score - a.score);

  useEffect(() => {
    if (winningTeams.length > 0) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }
  }, [winningTeams]);

  return (
    <div className="flex flex-col items-center justify-center text-center flex-1 animate-in fade-in-50 duration-500">
      <Trophy className="h-24 w-24 text-yellow-400 drop-shadow-lg" />
      
      {winningTeams.length > 0 ? (
        <>
          <h1 className="text-5xl font-bold mt-4 font-display">
            {isTie ? "It's a Tie!" : `Team ${winningTeams[0].name} Wins!`}
          </h1>
          <CardDescription className="text-2xl pt-4">
            Congratulations to the Trivia Titans!
          </CardDescription>

          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {winningTeams.flatMap(team => team.players).map(player => (
              <div key={player.id} className="p-4 bg-card rounded-lg shadow-lg border border-primary">
                <p className="text-2xl font-bold text-primary">{player.name}</p>
                <p className="text-sm text-muted-foreground">ID: {player.playerId}</p>
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
