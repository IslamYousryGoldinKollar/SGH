
"use client";

import { useState } from "react";
import type { Team, Player, Game, GameStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Swords, Loader2 } from "lucide-react";

type LobbyProps = {
  game: Game;
  onJoinTeam: (playerName: string, playerId: string, teamName: string) => void;
  onStartGame: () => void;
  currentPlayer: Player | null;
  isAdmin: boolean;
};

export default function Lobby({ game, onJoinTeam, onStartGame, currentPlayer, isAdmin }: LobbyProps) {
  const [playerName, setPlayerName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const { teams, status } = game;

  const handleJoin = (teamName: string) => {
    if (!playerName.trim() || !idNumber.trim()) {
        alert("Please fill in your name and ID number.");
        return;
    }
    onJoinTeam(playerName.trim(), idNumber.trim(), teamName);
  }

  const TeamCard = ({ team }: { team: Team }) => (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-display">
          <span>{team.name}</span>
          <span className="flex items-center text-sm text-muted-foreground">
            <Users className="mr-2 h-4 w-4" /> {team.players.length} / {team.capacity}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {team.players.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
            {team.players.map((p) => (
                <li key={p.id} className={`truncate ${p.id === currentPlayer?.id ? 'font-bold text-primary' : ''}`}>
                {p.name}
                </li>
            ))}
            </ul>
        ) : (
            <p className="text-sm text-muted-foreground">No players have joined this team yet.</p>
        )}
      </CardContent>
    </Card>
  );

  if (status === 'starting') {
     return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h1 className="text-4xl font-bold mt-4 font-display">Generating Questions...</h1>
            <p className="text-muted-foreground mt-2">Get ready for battle!</p>
        </div>
    );
  }

  if (currentPlayer) {
    return (
      <div className="flex flex-col items-center justify-center text-center flex-1">
        <h1 className="text-4xl font-bold font-display">Welcome, {currentPlayer.name}!</h1>
        <p className="text-muted-foreground mt-2">You are on <span className="font-bold text-primary">{currentPlayer.teamName}</span>.</p>
        
        <p className="mt-8 text-lg">
            {isAdmin ? "You are the admin. Start the game when you're ready!" : "Waiting for the admin to start the game..."}
        </p>
        
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
      <p className="text-muted-foreground mt-2 max-w-xl">Enter your details, choose a team, and get ready to prove your knowledge.</p>
      
      <div className="my-8 w-full max-w-md space-y-4">
          <div className="space-y-2">
              <Label htmlFor="playerName" className="sr-only">Full Name</Label>
              <Input
                id="playerName"
                type="text"
                placeholder="Enter your full name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="text-lg p-6 w-full text-center"
                aria-label="Player Full Name"
              />
          </div>
          <div className="space-y-2">
              <Label htmlFor="idNumber" className="sr-only">ID Number</Label>
              <Input
                id="idNumber"
                type="text"
                placeholder="Enter your ID number"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="text-lg p-6 w-full text-center"
                aria-label="Player ID Number"
              />
          </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teams.map((team) => (
            <Button 
                key={team.name} 
                onClick={() => handleJoin(team.name)} 
                disabled={!playerName.trim() || !idNumber.trim() || team.players.length >= team.capacity}
                size="lg"
            >
                Join {team.name}
            </Button>
            ))}
        </div>
         {!teams || teams.length === 0 && <p className="text-destructive mt-4">No teams have been configured for this game.</p>}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {teams.map(team => <TeamCard key={team.name} team={team} />)}
      </div>
    </div>
  );
}
