
import type { Team } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield } from "lucide-react";

type ScoreboardProps = {
  team: Team;
};

export default function Scoreboard({ team }: ScoreboardProps) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm shadow-lg" style={{ borderColor: team.color }}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-display">
          <span className="flex items-center gap-2"><Shield /> {team.name}</span>
          <span className="text-3xl font-bold" style={{ color: team.color }}>{team.score} PTS</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /> Players</h3>
        <ul className="space-y-1 text-sm">
          {team.players.map((player) => (
            <li key={player.id} className="truncate">{player.name}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
