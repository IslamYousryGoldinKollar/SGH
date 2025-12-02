
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Team, GridSquare, Player } from "@/lib/types";
import { Loader2, Play, Square, RotateCw, Users, Trophy, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import HexMap from "@/components/game/HexMap";
import Image from "next/image";
import Timer from "@/components/game/Timer";
import confetti from 'canvas-confetti';


export default function DisplayPage() {
    const params = useParams();
    const gameId = params.gameId as string;
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [joinUrl, setJoinUrl] = useState("");
    const prevGridRef = useRef<GridSquare[] | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setJoinUrl(`${window.location.origin}/game/${gameId}`);
        }
    }, [gameId]);

    useEffect(() => {
        if (!gameId) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        const unsubscribe = onSnapshot(gameRef, (doc) => {
            if (doc.exists()) {
                const gameData = { id: doc.id, ...doc.data() } as Game;
                
                setGame(gameData);
            } else {
                setGame(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [gameId]);

    // Effect for territory capture confetti
    useEffect(() => {
      if (!game || !game.grid) {
        return;
      }
    
      const prevGrid = prevGridRef.current;
      const currentGrid = game.grid;
    
      if (prevGrid) {
        for (let i = 0; i < currentGrid.length; i++) {
          if (prevGrid[i].coloredBy === null && currentGrid[i].coloredBy !== null) {
            // A square has been captured
            const teamName = currentGrid[i].coloredBy;
            const team = game.teams.find(t => t.name === teamName);
            const teamIndex = game.teams.findIndex(t => t.name === teamName);

            if (team) {
              // Pre-defined origins for the towers. These are percentages of the screen width/height.
              const towerOrigins = [
                { x: 0.35, y: 0.3 }, // Left tower (Team Alpha)
                { x: 0.65, y: 0.3 }  // Right tower (Team Bravo)
              ];
              const origin = towerOrigins[teamIndex] || { x: 0.5, y: 0.5 };
              
              confetti({
                particleCount: 100,
                spread: 70,
                origin: origin,
                colors: [team.color],
                angle: 90,
                startVelocity: 40,
                scalar: 1.2
              });
            }
          }
        }
      }
    
      prevGridRef.current = [...currentGrid];
    }, [game]);


    const handleStartGame = async () => {
        if (!gameId) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        await updateDoc(gameRef, { status: "playing", gameStartedAt: serverTimestamp() });
    };

    const handleEndGame = async () => {
        if (!gameId) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        await updateDoc(gameRef, { status: "finished" });
    };

    const handlePlayAgain = async () => {
        if (!game) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        
        const initialGrid: GridSquare[] = Array.from({ length: 22 }, (_, i) => ({
            id: i,
            coloredBy: null,
        }));
        
        await updateDoc(gameRef, {
            status: "lobby",
            teams: game.teams.map(t => ({
                name: t.name,
                capacity: t.capacity,
                color: t.color,
                icon: t.icon,
                score: 0, 
                players: [],
            })),
            grid: initialGrid,
            gameStartedAt: null,
        });
    };

    const TeamDisplayCard = ({ team }: { team: Team }) => (
        <div 
            className="display-card relative w-full h-full text-card-foreground shadow-xl flex flex-col"
            style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
                boxShadow: 'inset 10px -10px 40px -10px rgba(0, 0, 0, 0.1), inset 0 0 60px rgba(0,0,0,0.03), 0 10px 30px rgba(0,0,0,0.1)'
            }}
        >
            <div 
                className="absolute top-0 left-0 h-[10px] w-full shadow-inner" 
                style={{backgroundColor: team.color}} 
            />
            
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <h2 className="text-4xl font-display" style={{ color: team.color }}>
                    {team.name}
                </h2>
                <div className="flex items-center justify-center text-foreground pt-2">
                    <Users className="mr-2 h-5 w-5" /> 
                    <span className="text-2xl font-semibold drop-shadow-sm">
                        {team.players.length} / {team.capacity}
                    </span>
                </div>
                <div className="flex-1 flex flex-col min-h-0 pt-4 w-full">
                    <ScrollArea className="flex-1">
                        <ul className="space-y-2 text-lg text-center pr-4">
                            {team.players.map(p => (
                                <li 
                                    key={p.id} 
                                    className="truncate bg-secondary/30 p-2 rounded-md font-medium"
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

            <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-48 h-48">
                {team.icon ? 
                    <Image 
                        src={team.icon} 
                        alt={`${team.name} icon`} 
                        fill 
                        className="object-contain" 
                    /> 
                    : <Trophy className="w-16 h-16" style={{color: team.color}} />
                }
            </div>
        </div>
    );
    
    const renderLobby = () => {
        if (!game || !joinUrl) return null;

        const teamLeft = game.teams.length > 0 ? game.teams[0] : null;
        const teamRight = game.teams.length > 1 ? game.teams[1] : null;

        return (
            <div className="flex-1 w-full max-w-full flex items-start justify-around gap-8 p-8 pt-[10vh]">
                {/* Left Team */}
                <div className="w-1/4 h-[70vh] flex">
                    {teamLeft && <TeamDisplayCard team={teamLeft} />}
                </div>

                {/* Center Content */}
                <div className="w-1/3 flex flex-col items-center justify-center text-center text-card-foreground">
                    <Card className="rounded-2xl w-full max-w-sm">
                        <CardHeader className="pt-2">
                            <div className="flex justify-center">
                                <Image 
                                    src="https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fsgh.png?alt=media&token=b5eaf98c-f82f-4428-8c60-078a0509dcf2"
                                    alt="Saudi German Health Logo"
                                    width={250}
                                    height={80}
                                    className="object-contain"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center !pt-0">
                             <div className="bg-white p-2 rounded-lg inline-block">
                                <QRCodeSVG value={joinUrl} size={192} />
                            </div>
                            <p className="text-lg text-muted-foreground mt-1">Session PIN</p>
                            <h1 className="text-3xl font-bold font-mono tracking-widest text-primary">{game.id}</h1>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Team */}
                 <div className="w-1/4 h-[70vh] flex">
                    {teamRight && <TeamDisplayCard team={teamRight} />}
                </div>
            </div>
        )
    }

    const TeamScorePod = ({ team }: { team: Team }) => (
        <div
            className="display-card relative w-56 h-[170px] text-card-foreground shadow-xl flex flex-col"
            style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
                boxShadow: 'inset 10px -10px 40px -10px rgba(0, 0, 0, 0.1), inset 0 0 60px rgba(0,0,0,0.03), 0 10px 30px rgba(0,0,0,0.1)'
            }}
        >
             <div 
                className="absolute top-0 left-0 h-[10px] w-full shadow-inner" 
                style={{backgroundColor: team.color}} 
            />
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <h3 className="text-2xl font-display" style={{ color: team.color }}>{team.name}</h3>
                <div className="flex items-center justify-center text-foreground text-base my-1">
                    <Users className="mr-2 h-4 w-4" /> 
                    <span className="drop-shadow-sm font-semibold">{team.players.length}</span>
                </div>
                <p className="text-5xl font-bold font-mono drop-shadow-lg">{team.score}</p>
            </div>
        </div>
    );

    const renderGameInProgress = () => {
         if (!game || !game.grid) return null;
         const teamLeft = game.teams.length > 0 ? game.teams[0] : null;
         const teamRight = game.teams.length > 1 ? game.teams[1] : null;

        return (
             <div className="flex-1 w-full h-full flex items-center justify-center relative p-8">
                 <div className="absolute left-1/2 -translate-x-1/2 top-0 z-10">
                    <Timer initialTime={game.timer} onTimeUp={handleEndGame} isRunning={game.status === 'playing'}/>
                </div>

                <div className="absolute top-8 left-8 z-10">
                   {teamLeft && <TeamScorePod team={teamLeft} />}
                </div>
                
                <div className="absolute top-8 right-8 z-10">
                   {teamRight && <TeamScorePod team={teamRight} />}
                </div>


                <div className="w-auto h-full flex items-center justify-center">
                    <div className="w-auto h-full aspect-[1065/666] relative">
                        <HexMap grid={game.grid} teams={game.teams} onHexClick={() => {}} />
                    </div>
                </div>

                {teamLeft?.icon && (
                    <div className="absolute bottom-0 left-0 w-[480px] h-[480px] pointer-events-none -mb-16 -ml-48">
                         <Image src={teamLeft.icon} alt={`${teamLeft.name} icon`} layout="fill" objectFit="contain" />
                    </div>
                )}
                 {teamRight?.icon && (
                    <div className="absolute bottom-0 right-0 w-[480px] h-[480px] pointer-events-none -mb-16 -mr-48">
                         <Image src={teamRight.icon} alt={`${teamRight.name} icon`} layout="fill" objectFit="contain" />
                    </div>
                )}
             </div>
        )
    }
    
    const GameOverOverlay = () => {
        if (!game || game.status !== 'finished') return null;

        const sortedTeams = [...game.teams].sort((a, b) => b.score - a.score);
        const topScore = sortedTeams.length > 0 ? sortedTeams[0].score : 0;
        const winningTeams = sortedTeams.filter(t => t.score === topScore && topScore > 0);
        const isTie = winningTeams.length > 1;

        useEffect(() => {
            if (winningTeams.length > 0) {
              const duration = 5 * 1000;
              const animationEnd = Date.now() + duration;
              const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
        
              const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
        
              const interval = setInterval(() => {
                const timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) {
                  return clearInterval(interval);
                }
                const particleCount = 50 * (timeLeft / duration);
                const winnerColors = winningTeams.map(t => t.color);
                
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: winnerColors });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: winnerColors });
              }, 250);
            }
        }, [winningTeams]);
        
        const winnerNames = winningTeams.map(t => t.name).join(' & ');

        return (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 animate-in fade-in">
                <Card className="max-w-4xl w-full text-center p-8 bg-slate-900/90 border-0 rounded-xl">
                    <CardHeader>
                        <div className="flex justify-center items-center">
                            <Trophy className="h-16 w-16 text-yellow-400 drop-shadow-lg mr-4" />
                            <CardTitle className="text-7xl font-display text-yellow-400">
                                {winningTeams.length > 0 ? (isTie ? "It's a Tie!" : `${winnerNames} Wins!`) : "Game Over"}
                            </CardTitle>
                        </div>
                         {winningTeams.length > 0 && (
                            <CardDescription className="text-2xl pt-4 text-slate-200">
                                Congratulations to the winning team!
                            </CardDescription>
                        )}
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                         <div className="flex flex-wrap justify-center items-start gap-6 mt-4 w-full">
                            {sortedTeams.map(team => (
                                <div key={team.name} className="p-4 bg-card/10 rounded-lg shadow-lg border-2 flex-1 min-w-[300px]" style={{borderColor: team.color}}>
                                    <p className="text-4xl font-bold font-display" style={{color: team.color}}>{team.name}</p>
                                     <ul className="mt-4 space-y-2 text-left">
                                        {team.players.map(player => (
                                            <li key={player.id} className="text-lg bg-secondary/10 p-2 rounded-md">
                                                <span className="font-semibold text-slate-100">{player.name}</span>
                                                <span className="text-xs text-muted-foreground ml-2">(ID: {player.playerId})</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                         <Button size="lg" onClick={handlePlayAgain} className="min-w-[200px] h-14 text-2xl mt-12">
                            <RotateCw className="mr-4"/> Play Again
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const renderContent = () => {
        if (loading) {
            return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
        }
        if (!game) {
            return <div className="flex-1 flex items-center justify-center"><h1 className="text-4xl text-destructive">Session Not Found</h1></div>;
        }

        const renderStatus = () => {
            switch(game.status) {
                case 'lobby': return renderLobby();
                case 'starting': return <div className="flex-1 flex items-center justify-center"><h2 className="text-5xl font-display text-accent">Getting ready...</h2></div>;
                case 'playing': return renderGameInProgress();
                case 'finished': return renderGameInProgress();
                default: return <p>{game.status}</p>;
            }
        }

        return (
            <div className="w-full h-full flex flex-col relative">
                <GameOverOverlay />
                <div className="flex-1 flex flex-col justify-start min-h-0">
                    {renderStatus()}
                </div>
                 
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex-shrink-0 z-30">
                    {game.status === 'lobby' && (
                        <Button size="lg" onClick={handleStartGame} className="min-w-[200px] h-14 text-2xl shadow-2xl">
                            <Play className="mr-4"/> Start Game
                        </Button>
                    )}
                     {game.status === 'playing' && (
                        <Button size="lg" variant="destructive" onClick={handleEndGame} className="min-w-[200px] h-14 text-2xl shadow-2xl">
                            <StopCircle className="mr-4"/> End Game
                        </Button>
                    )}
                </div>
                 
            </div>
        )
    }

    return (
        <div className="w-full h-screen flex flex-col items-center overflow-hidden">
            {renderContent()}
        </div>
    );

    }
    
    

    
