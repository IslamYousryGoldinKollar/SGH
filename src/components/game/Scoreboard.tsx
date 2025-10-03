
import type { Team } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, User } from "lucide-react";

type ScoreboardProps = {
  team: Team;
};

export default function Scoreboard({ team }: ScoreboardProps) {
  const isSinglePlayerTeam = team.players.length === 1;

  return (
    <Card className="backdrop-blur-sm shadow-lg flex-1" style={{ borderColor: team.color }}>
      <CardHeader className="p-3 md:p-6">
        <CardTitle className="flex items-center justify-between font-display text-xs">
          <span className="flex items-center gap-2 truncate">
            {isSinglePlayerTeam ? <User /> : <Shield />} 
            {isSinglePlayerTeam ? team.players[0].name : team.name}
            </span>
          <span className="text-2xl font-bold" style={{ color: team.color }}>{team.score} PTS</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 md:p-6 pt-0 hidden sm:block">
          {isSinglePlayerTeam ? (
             <p className="text-xs text-muted-foreground">ID: {team.players[0].playerId}</p>
          ) : (
            <>
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-4 w-4" /> Players</h3>
              <ul className="space-y-1 text-xs">
                {team.players.map((player) => (
                  <li key={player.id} className="truncate">{player.name}</li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
    </Card>
  );
}
