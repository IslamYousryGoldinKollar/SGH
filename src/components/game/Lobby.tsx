"use client";

import { useState } from "react";
import type { Team, Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Swords } from "lucide-react";

type LobbyProps = {
  teams: Team[];
  onJoinTeam: (playerName: string, teamName: string) => void;
  onStartGame: () => void;
  currentPlayer: Player | null;
  isAdmin: boolean;
};

export default function Lobby({ teams, onJoinTeam, onStartGame, currentPlayer, isAdmin }: LobbyProps) {
  const [playerName, setPlayerName] = useState("");

  const TeamCard = ({ team }: { team: Team }) => (
    <Card className="flex flex-col bg-card/50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-display">
          <span>{team.name}</span>
          <span className="flex items-center text-sm text-muted-foreground">
            <Users className="mr-2 h-4 w-4" /> {team.players.length} / 10
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        <ul className="space-y-1 text-sm text-muted-foreground">
          {team.players.map((p) => (
            <li key={p.id} className={`truncate ${p.id === currentPlayer?.id ? 'font-bold text-primary' : ''}`}>
              {p.name}
            </li>
          ))}
          {team.players.length === 0 && <li>No players yet.</li>}
        </ul>
      </CardContent>
    </Card>
  );

  if (currentPlayer) {
    return (
      <div className="flex flex-col items-center justify-center text-center flex-1">
        <h1 className="text-4xl font-bold font-display">Welcome, {currentPlayer.name}!</h1>
        <p className="text-muted-foreground mt-2">You are on <span className="font-bold text-primary">{currentPlayer.teamName}</span>.</p>
        
        {isAdmin ? (
            <p className="mt-4">You are the admin. Start the game when you're ready!</p>
        ) : (
            <p className="mt-4">Waiting for the game to start...</p>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl my-8">
            {teams.map((team) => <TeamCard key={team.name} team={team} />)}
        </div>
        {isAdmin && (
          <Button onClick={onStartGame} size="lg" className="font-display tracking-wider">
            <Swords className="mr-2 h-5 w-5" />
            Start Game
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center flex-1">
      <h1 className="text-5xl font-bold font-display">Join the Battle</h1>
      <p className="text-muted-foreground mt-2 max-w-xl">Enter your name, choose a team, and get ready to prove your knowledge. The game will start when you're ready.</p>
      
      <div className="my-8 flex flex-col sm:flex-row items-center gap-4">
        <Input
          type="text"
          placeholder="Enter your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="text-lg p-6 w-72"
        />
        <div className="flex gap-2">
            {teams.map((team) => (
            <Button key={team.name} onClick={() => onJoinTeam(playerName, team.name)} disabled={!playerName.trim() || team.players.length >= 10}>
                Join {team.name}
            </Button>
            ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <TeamCard team={teams[0]} />
        <TeamCard team={teams[1]} />
      </div>
    </div>
  );
}
