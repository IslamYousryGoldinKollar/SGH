
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Team, GridSquare } from "@/lib/types";
import { Loader2, Play, Square, RotateCw, Users, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import HexMap from "@/components/game/HexMap";


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
                
                const scores = new Map<string, number>();
                gameData.teams.forEach(team => scores.set(team.name, 0));
                
                if (gameData.grid) {
                    gameData.grid.forEach(square => {
                        if (square.coloredBy) {
                            scores.set(square.coloredBy, (scores.get(square.coloredBy) || 0) + 1);
                        }
                    });
                }

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
                score: 0, 
                players: [],
            })),
            grid: initialGrid,
            gameStartedAt: null,
        });
    };

    const TeamDisplayCard = ({ team }: { team: Team }) => (
        <Card className="w-full h-full flex flex-col bg-background/80 backdrop-blur-sm" style={{ borderColor: team.color }}>
            <CardHeader className="text-center flex-shrink-0 relative p-4">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-1 rounded-full">
                    <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center" style={{borderColor: team.color, backgroundColor: team.color+'30'}}>
                       <Trophy className="w-8 h-8" style={{color: team.color}} />
                    </div>
                </div>
                 <CardTitle className="text-4xl font-display pt-8" style={{ color: team.color }}>{team.name}</CardTitle>
                 <div className="flex items-center justify-center text-muted-foreground pt-2">
                    <Users className="mr-2 h-5 w-5" /> 
                    <span className="text-2xl">{team.players.length} / {team.capacity}</span>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 p-4">
                <ScrollArea className="flex-1">
                    <ul className="space-y-2 text-lg text-center pr-4">
                        {team.players.map(p => (
                            <li key={p.id} className="truncate bg-secondary/30 p-2 rounded-md">{p.name}</li>
                        ))}
                         {team.players.length === 0 && <li className="text-muted-foreground italic">No players yet...</li>}
                    </ul>
                </ScrollArea>
            </CardContent>
        </Card>
    );
    
    const renderLobby = () => {
        if (!game || !joinUrl) return null;

        const teamLeft = game.teams.length > 0 ? game.teams[0] : null;
        const teamRight = game.teams.length > 1 ? game.teams[1] : null;

        return (
            <div className="flex-1 w-full max-w-full flex items-center justify-around gap-8 p-8">
                {/* Left Team */}
                <div className="w-1/4 h-3/4 flex">
                    {teamLeft && <TeamDisplayCard team={teamLeft} />}
                </div>

                {/* Center Content */}
                <div className="w-1/3 flex flex-col items-center justify-center text-center text-card-foreground">
                    <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl">
                        <h2 className="text-4xl font-display text-accent mb-6">{game.title || 'Scan to Join'}</h2>
                         <div className="bg-white p-4 rounded-lg inline-block">
                            <QRCodeSVG value={joinUrl} size={256} />
                        </div>
                        <p className="text-xl text-muted-foreground mt-6">Session PIN</p>
                        <h1 className="text-6xl font-bold font-mono tracking-widest text-primary">{game.id}</h1>
                    </div>
                </div>

                {/* Right Team */}
                 <div className="w-1/4 h-3/4 flex">
                    {teamRight && <TeamDisplayCard team={teamRight} />}
                </div>
            </div>
        )
    }

    const TeamScorePod = ({ team, alignment = 'left' }: { team: Team, alignment?: 'left' | 'right' }) => (
        <div className={cn(
            "p-6 rounded-2xl bg-card/80 backdrop-blur-sm shadow-xl text-center transition-all duration-500 border-4 w-64",
            alignment === 'left' ? "rounded-l-2xl" : "rounded-r-2xl"
            )} 
            style={{ borderColor: team.color }}>
            <h3 className="text-3xl font-display" style={{ color: team.color }}>{team.name}</h3>
             <div className="flex items-center justify-center text-muted-foreground text-xl my-2">
                <Users className="mr-2 h-5 w-5" /> 
                <span>{team.players.length}</span>
            </div>
            <p className="text-6xl font-bold font-mono my-2">{team.score}</p>
        </div>
    );

    const renderGameInProgress = () => {
         if (!game || !game.grid) return null;
         const teamLeft = game.teams.length > 0 ? game.teams[0] : null;
         const teamRight = game.teams.length > 1 ? game.teams[1] : null;

        return (
             <div className="flex-1 w-full h-full flex items-center justify-center relative">
                <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10">
                    {teamLeft && <TeamScorePod team={teamLeft} alignment="left" />}
                </div>
                <div className="h-full w-full flex items-center justify-center">
                    <div className="w-full h-full max-h-[100vh] max-w-[100vw] aspect-[1065/666] p-4">
                        <HexMap grid={game.grid} teams={game.teams} onHexClick={() => {}}/>
                    </div>
                </div>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10">
                    {teamRight && <TeamScorePod team={teamRight} alignment="right" />}
                </div>
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
        
        const GameOverOverlay = () => {
            if (game.status !== 'finished') return null;

            const sortedTeams = [...game.teams].sort((a,b) => b.score - a.score);
            const winner = sortedTeams[0];
            const isTie = sortedTeams.length > 1 && sortedTeams[0].score === sortedTeams[1].score;

            return (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 animate-in fade-in">
                    <Card className="max-w-xl text-center p-8 bg-background/90">
                        <CardHeader>
                            <CardTitle className="text-7xl font-display text-yellow-400">{isTie ? "Draw!" : "Game Over"}</CardTitle>
                            <CardDescription className="text-2xl pt-4">
                                {isTie ? "Both teams got the same score!" : `${winner.name} Wins!`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Button size="lg" onClick={handlePlayAgain} className="min-w-[200px] h-14 text-2xl mt-8">
                                <RotateCw className="mr-4"/> Play Again
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )
        }

        return (
            <div className="w-full h-full flex flex-col relative">
                <GameOverOverlay />
                <div className="flex-1 flex flex-col justify-start min-h-0">
                    {renderStatus()}
                </div>
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex-shrink-0 z-20">
                    {game.status === 'lobby' && (
                        <Button size="lg" onClick={handleStartGame} className="min-w-[200px] h-14 text-2xl shadow-2xl">
                            <Play className="mr-4"/> Start Game
                        </Button>
                    )}
                     {game.status === 'playing' && (
                        <Button size="lg" variant="destructive" onClick={handleEndGame} className="min-w-[200px] h-14 text-2xl shadow-2xl">
                            <Square className="mr-4"/> End Game
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

    