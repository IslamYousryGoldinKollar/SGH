
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game } from "@/lib/types";
import { Loader2, Play, Square, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DisplayPage() {
    const params = useParams();
    const gameId = params.gameId as string;
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!gameId) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        const unsubscribe = onSnapshot(gameRef, (doc) => {
            if (doc.exists()) {
                setGame({ id: doc.id, ...doc.data() } as Game);
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
        // The full game start logic is handled on the player/admin side.
        // This is just a remote control to change the status.
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
        await updateDoc(gameRef, {
            status: "lobby",
            teams: game.teams.map(t => ({
                ...t,
                score: 0,
                players: []
            })),
            gameStartedAt: null,
        });
    };
    
    const renderContent = () => {
        if (loading) {
            return <Loader2 className="h-16 w-16 animate-spin" />;
        }
        if (!game) {
            return <h1 className="text-4xl text-destructive">Session Not Found</h1>;
        }

        const sortedTeams = game.teams ? [...game.teams].sort((a, b) => b.score - a.score) : [];

        const renderStatus = () => {
            switch(game.status) {
                case 'lobby': return 'Waiting for players...';
                case 'starting': return 'Getting ready...';
                case 'playing': return 'Game in Progress!';
                case 'finished': return 'Game Over!';
                default: return game.status;
            }
        }

        return (
            <div className="w-full max-w-6xl mx-auto">
                <div className="text-center mb-12 p-6 bg-primary/10 border-2 border-primary rounded-xl">
                    <p className="text-2xl text-muted-foreground">Session PIN</p>
                    <h1 className="text-8xl font-bold font-mono tracking-widest text-primary">{game.id}</h1>
                    <h2 className="text-5xl font-display text-accent mt-4">{renderStatus()}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-12">
                    {sortedTeams.map(team => (
                        <div key={team.name} className="p-8 border-4 rounded-lg bg-card/50 text-center transition-all duration-500" style={{ borderColor: team.color }}>
                            <h3 className="text-4xl font-display" style={{ color: team.color }}>{team.name}</h3>
                            <p className="text-8xl font-bold font-mono my-4">{team.score}</p>
                            <p className="text-muted-foreground">{team.players.length} players</p>
                        </div>
                    ))}
                </div>

                <div className="text-center mt-12 space-x-4">
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
        <div className="bg-background text-foreground min-h-screen flex flex-col items-center justify-center p-8">
            {renderContent()}
        </div>
    );
}
