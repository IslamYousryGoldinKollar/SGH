
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Team, GridSquare } from "@/lib/types";
import { Loader2, Play, Square, RotateCw, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";


export default function DisplayPage() {
    const params = useParams();
    const gameId = params.gameId as string;
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [joinUrl, setJoinUrl] = useState("");

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
                
                // Recalculate scores based on grid
                const scores = new Map<string, number>();
                gameData.teams.forEach(team => scores.set(team.name, 0));
                gameData.grid?.forEach(square => {
                    if (square.coloredBy) {
                        scores.set(square.coloredBy, (scores.get(square.coloredBy) || 0) + 1);
                    }
                });

                gameData.teams.forEach(team => {
                    team.score = scores.get(team.name) || 0;
                });

                setGame(gameData);
            } else {
                setGame(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [gameId]);

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
        
        const initialGrid: GridSquare[] = Array.from({ length: 100 }, (_, i) => ({
            id: i,
            coloredBy: null,
        }));
        
        await updateDoc(gameRef, {
            status: "lobby",
            teams: game.teams.map(t => ({
                ...t,
                score: 0,
                coloringCredits: 0,
                players: []
            })),
            grid: initialGrid,
            gameStartedAt: null,
        });
    };

    const TeamDisplayCard = ({ team }: { team: Team }) => (
        <Card className="w-full h-full bg-card/50 flex flex-col" style={{ borderColor: team.color }}>
            <CardHeader className="text-center flex-shrink-0">
                <CardTitle className="text-4xl font-display" style={{ color: team.color }}>{team.name}</CardTitle>
                 <div className="flex items-center justify-center text-muted-foreground pt-2">
                    <Users className="mr-2 h-5 w-5" /> 
                    <span className="text-2xl">{team.players.length} / {team.capacity}</span>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1">
                    <ul className="space-y-2 text-lg text-center pr-4">
                        {team.players.map(p => (
                            <li key={p.id} className="truncate bg-secondary/30 p-2 rounded-md">{p.name}</li>
                        ))}
                    </ul>
                </ScrollArea>
            </CardContent>
        </Card>
    );
    
    const renderLobby = () => {
        if (!game || !joinUrl) return null;

        const teamLeft = game.teams.length > 1 ? game.teams[1] : null;
        const teamRight = game.teams.length > 0 ? game.teams[0] : null;

        return (
            <div className="flex-1 w-full max-w-full flex items-stretch justify-around gap-8">
                {/* Left Team */}
                <div className="w-1/3 flex">
                    {teamLeft && <TeamDisplayCard team={teamLeft} />}
                </div>

                {/* Center Content */}
                <div className="w-1/3 flex flex-col items-center justify-center text-center">
                    <h2 className="text-4xl font-display text-accent mb-6">Scan to Join</h2>
                     <div className="bg-white p-4 rounded-lg inline-block shadow-2xl">
                        <QRCodeSVG value={joinUrl} size={256} />
                    </div>
                    <p className="text-xl text-muted-foreground mt-6">Session PIN</p>
                    <h1 className="text-6xl font-bold font-mono tracking-widest text-primary">{game.id}</h1>
                </div>

                {/* Right Team */}
                 <div className="w-1/3 flex">
                    {teamRight && <TeamDisplayCard team={teamRight} />}
                </div>
            </div>
        )
    }

    const GameGrid = () => {
        if (!game) return null;
        const { grid, teams } = game;
        
        const getTeamColor = (teamName: string) => {
            return teams.find(t => t.name === teamName)?.color || '#333';
        }

        return (
            <div className="grid grid-cols-10 gap-2 aspect-square max-w-[60vh] mx-auto">
                {grid.map(square => (
                    <div 
                        key={square.id}
                        className="w-full aspect-square rounded-md border-2 border-border transition-colors duration-500"
                        style={{ backgroundColor: square.coloredBy ? getTeamColor(square.coloredBy) : 'var(--card)'}}
                    />
                ))}
            </div>
        );
    }
    
    const TeamScoreBar = ({ team }: { team: Team }) => (
        <div className="p-6 rounded-lg bg-card/50 text-center transition-all duration-500 border-4" style={{ borderColor: team.color }}>
            <h3 className="text-3xl font-display" style={{ color: team.color }}>{team.name}</h3>
            <p className="text-6xl font-bold font-mono my-2">{team.score}</p>
             <div className="flex items-center justify-center text-muted-foreground text-xl">
                <Users className="mr-2 h-5 w-5" /> 
                <span>{team.players.length}</span>
            </div>
        </div>
    );


    const renderGameInProgress = () => {
         if (!game) return null;
         const teamLeft = game.teams.length > 1 ? game.teams[1] : null;
         const teamRight = game.teams.length > 0 ? game.teams[0] : null;

        return (
             <div className="flex-1 w-full max-w-full flex items-center justify-around gap-8">
                {/* Left Team */}
                <div className="w-1/4 flex justify-center">
                    {teamLeft && <TeamScoreBar team={teamLeft} />}
                </div>

                {/* Center Content */}
                <div className="w-1/2 flex flex-col items-center justify-center text-center">
                    <h2 className="text-5xl font-display text-accent mb-6">Color War</h2>
                    <GameGrid />
                </div>

                {/* Right Team */}
                 <div className="w-1/4 flex justify-center">
                    {teamRight && <TeamScoreBar team={teamRight} />}
                </div>
             </div>
        )
    }
    
    const renderContent = () => {
        if (loading) {
            return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>;
        }
        if (!game) {
            return <div className="flex-1 flex items-center justify-center"><h1 className="text-4xl text-destructive">Session Not Found</h1></div>;
        }

        const renderStatus = () => {
            switch(game.status) {
                case 'lobby': return renderLobby();
                case 'starting': return <h2 className="text-5xl font-display text-accent mt-4 text-center mb-12">Getting ready...</h2>;
                case 'playing': return renderGameInProgress();
                case 'finished': return renderGameInProgress(); // Show final grid state
                default: return <p>{game.status}</p>;
            }
        }
        
        const GameOverOverlay = () => {
            if (game.status !== 'finished') return null;

            const sortedTeams = [...game.teams].sort((a,b) => b.score - a.score);
            const winner = sortedTeams[0];
            const isTie = sortedTeams.length > 1 && sortedTeams[0].score === sortedTeams[1].score;

            return (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10 animate-in fade-in">
                    <h1 className="text-7xl font-display text-yellow-400">Game Over</h1>
                    <h2 className="text-4xl font-display mt-4">{isTie ? "It's a Tie!" : `${winner.name} Wins!`}</h2>
                     <Button size="lg" onClick={handlePlayAgain} className="min-w-[200px] h-14 text-2xl mt-12">
                        <RotateCw className="mr-4"/> Play Again
                    </Button>
                </div>
            )
        }

        return (
            <div className="w-full h-full flex flex-col p-8 relative">
                 <GameOverOverlay />
                <div className="flex-1 flex flex-col justify-start pt-[5%] min-h-0">
                    {renderStatus()}
                </div>
                <div className="text-center py-4 flex-shrink-0">
                    {game.status === 'lobby' && (
                        <Button size="lg" onClick={handleStartGame} className="min-w-[200px] h-14 text-2xl">
                            <Play className="mr-4"/> Start Game
                        </Button>
                    )}
                     {game.status === 'playing' && (
                        <Button size="lg" variant="destructive" onClick={handleEndGame} className="min-w-[200px] h-14 text-2xl">
                            <Square className="mr-4"/> End Game
                        </Button>
                    )}
                    {game.status === 'finished' && (
                         <Button size="lg" onClick={handlePlayAgain} className="min-w-[200px] h-14 text-2xl">
                            <RotateCw className="mr-4"/> Play Again
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
