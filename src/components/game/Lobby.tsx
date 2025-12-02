
"use client";

import { useState } from "react";
import type { Team, Player, Game, GameStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Swords, Loader2 } from "lucide-react";
import Image from "next/image";
import { v4 as uuidv4 } from 'uuid';
import { ScrollArea } from "../ui/scroll-area";

type LobbyProps = {
  game: Game;
  onJoinTeam: (playerName: string, playerId: string, teamName: string) => void;
  onStartGame: () => void;
  currentPlayer: Player | null;
  isAdmin: boolean;
};

export default function Lobby({ game, onJoinTeam, onStartGame, currentPlayer, isAdmin }: LobbyProps) {
  const [playerName, setPlayerName] = useState("");
  const { teams, status } = game;

  const handleJoin = (teamName: string) => {
    if (!playerName.trim()) {
        alert("Please fill in your name.");
        return;
    }
    // For team games, we can generate a simple unique ID for the player.
    const playerId = uuidv4();
    onJoinTeam(playerName.trim(), playerId, teamName);
  }

    const TeamCard = ({ team }: { team: Team }) => (
        <div 
            className="relative w-full h-full text-card-foreground shadow-xl flex flex-col"
            style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
                background: `
                    linear-gradient(
                        0deg,
                        #ffffff 0%,
                        #f0f2f5 8%,
                        #ffffff 15%,
                        #e8ecf0 23%,
                        #ffffff 30%,
                        #f0f2f5 38%,
                        #ffffff 45%,
                        #f0f2f5 52%,
                        #e8ecf0 60%,
                        #ffffff 68%,
                        #f0f2f5 75%,
                        #ffffff 83%,
                        #f0f2f5 90%,
                        #ffffff 100%
                    )
                `,
                boxShadow: 'inset 10px -10px 40px -10px rgba(0, 0, 0, 0.1), inset 0 0 60px rgba(0,0,0,0.03), 0 10px 30px rgba(0,0,0,0.1)'
            }}
        >
            <div 
                className="absolute top-0 left-0 h-[10px] w-full shadow-inner" 
                style={{backgroundColor: team.color}} 
            />
            
            <div className="flex-1 flex flex-col items-center justify-start text-center p-4 pt-8">
                <h2 className="text-3xl md:text-4xl font-display" style={{ color: team.color }}>
                    {team.name}
                </h2>
                <div className="flex items-center justify-center text-foreground pt-2">
                    <Users className="mr-2 h-5 w-5" /> 
                    <span className="text-xl md:text-2xl font-semibold drop-shadow-sm">
                        {team.players.length} / {team.capacity}
                    </span>
                </div>
                <div className="flex-1 flex flex-col min-h-0 pt-4 w-full">
                    <ScrollArea className="flex-1">
                        <ul className="space-y-2 text-lg text-center pr-4">
                            {team.players.map(p => (
                                <li 
                                    key={p.id} 
                                    className={`truncate bg-secondary/30 p-2 rounded-md font-medium ${p.id === currentPlayer?.id ? 'ring-2 ring-primary' : ''}`}
                                >
                                    {p.name}
                                </li>
                            ))}
                            {team.players.length === 0 && (
                                <li className="text-muted-foreground italic">
                                    No players yet...
                                </li>
                            )}
                        </ul>
                    </ScrollArea>
                </div>
            </div>

            {team.icon && 
                <div className="relative h-24 md:h-32 mt-4">
                    <Image 
                        src={team.icon} 
                        alt={`${team.name} icon`} 
                        fill 
                        className="object-contain" 
                    /> 
                </div>
            }
        </div>
    );

  if (status === 'starting' && !game.parentSessionId) {
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
      <div className="flex flex-col items-center justify-center text-center flex-1 w-full h-full">
        <h1 className="text-4xl font-bold font-display">Welcome, {currentPlayer.name}!</h1>
        <p className="text-muted-foreground mt-2">You are on <span className="font-bold" style={{color: teams.find(t=>t.name === currentPlayer.teamName)?.color}}>{currentPlayer.teamName}</span>.</p>
        
        <p className="mt-8 text-lg">
            {status === 'starting' 
              ? 'The game is starting...'
              : isAdmin 
              ? "You are the admin. Start the game when you're ready!" 
              : "Waiting for the admin to start the game..."
            }
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full max-w-4xl my-8 flex-1 min-h-0">
            {teams.map((team) => <TeamCard key={team.name} team={team} />)}
        </div>

        {isAdmin && (
          <Button onClick={onStartGame} size="lg" className="font-display tracking-wider" disabled={status === 'starting'}>
            {status === 'starting' ? <Loader2 className="mr-2 animate-spin" /> : <Swords className="mr-2 h-5 w-5" />}
            {status === 'starting' ? 'Starting...' : 'Start Game'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start flex-1 h-full">
        <div className="flex justify-center items-center -space-x-8 mb-8">
            {teams[0]?.icon && (
                <Image src={teams[0].icon} alt={teams[0].name} width={128} height={128} className="drop-shadow-lg"/>
            )}
            {teams[1]?.icon && (
                <Image src={teams[1].icon} alt={teams[1].name} width={128} height={128} className="drop-shadow-lg" />
            )}
        </div>
        <div className="text-center">
            <h1 className="text-5xl font-bold font-display">Join the Battle</h1>
            <p className="text-muted-foreground mt-2 max-w-xl">Enter your name, choose a team, and get ready to prove your knowledge.</p>
        </div>
      
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
          
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teams.map((team) => (
            <Button 
                key={team.name} 
                onClick={() => handleJoin(team.name)} 
                disabled={!playerName.trim() || team.players.length >= team.capacity}
                size="lg"
                style={{backgroundColor: team.color}}
            >
                Join {team.name}
            </Button>
            ))}
        </div>
         {!teams || teams.length === 0 && <p className="text-destructive mt-4">No teams have been configured for this game.</p>}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full max-w-4xl flex-1 min-h-0">
        {teams.map(team => <TeamCard key={team.name} team={team} />)}
      </div>
    </div>
  );
}
