
import type { Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type ResultsScreenProps = {
  teams: Team[];
  onPlayAgain: () => void;
  isAdmin: boolean;
};

export default function ResultsScreen({ teams, onPlayAgain, isAdmin }: ResultsScreenProps) {
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const winner = sortedTeams[0];
  const isTie = teams.length > 1 && sortedTeams[0].score === sortedTeams[1].score;

  return (
    <div className="flex flex-col items-center justify-center text-center flex-1 animate-in fade-in-50 duration-500">
      <Trophy className="h-24 w-24 text-yellow-400" />
      <h1 className="text-5xl font-bold mt-4 font-display">
        {isTie ? "It's a Tie!" : `${winner.name} Wins!`}
      </h1>
      
      {!isTie && (
        <p className="text-muted-foreground text-xl mt-2 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          Congratulations to the champions!
          <Sparkles className="h-5 w-5 text-accent" />
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl my-12">
        {sortedTeams.map((team, index) => (
          <Card key={team.name} className={cn("shadow-lg bg-card/50", index === 0 && !isTie ? "border-2" : "")} style={{borderColor: index === 0 && !isTie ? team.color : 'hsl(var(--border))' }}>
            <CardHeader>
              <CardTitle className="text-2xl font-display" style={{color: team.color}}>{team.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-5xl font-bold" style={{color: team.color}}>{team.score}</p>
              <p className="text-muted-foreground">points</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <Button onClick={onPlayAgain} size="lg">
          Play Again
        </Button>
      )}
    </div>
  );
}
