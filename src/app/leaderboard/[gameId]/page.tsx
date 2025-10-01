
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Player } from "@/lib/types";
import { Loader2, Trophy, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default function LeaderboardPage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.gameId as string;
    const [game, setGame] = useState<Game | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!gameId) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        const unsubscribe = onSnapshot(gameRef, (doc) => {
            if (doc.exists()) {
                const gameData = { id: doc.id, ...doc.data() } as Game;
                if (gameData.sessionType !== 'individual') {
                    // Redirect if it's not an individual game
                    router.replace(`/game/${gameId}`);
                    return;
                }
                setGame(gameData);
                const sortedPlayers = (gameData.teams?.[0]?.players || []).sort((a, b) => b.score - a.score);
                setPlayers(sortedPlayers);
            } else {
                setGame(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [gameId, router]);
    
    if (loading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    if (!game) {
        return <div className="flex h-screen w-full items-center justify-center"><h1>Session not found.</h1></div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <Button variant="outline" onClick={() => router.push(`/admin/`)} className="mb-8">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Button>
            <div className="text-center mb-12">
                <Trophy className="h-16 w-16 text-yellow-400 drop-shadow-lg mx-auto" />
                <h1 className="text-5xl font-bold font-display mt-4">{game.title}</h1>
                <p className="text-muted-foreground mt-2 text-xl">Leaderboard</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Participants</CardTitle>
                    <CardDescription>Scores are updated in real-time as participants play.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">Rank</TableHead>
                                {game.requiredPlayerFields.map(field => (
                                     <TableHead key={field.id}>{field.label}</TableHead>
                                ))}
                                <TableHead className="text-right">Score</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {players.length > 0 ? (
                                players.map((player, index) => (
                                    <TableRow key={player.id}>
                                        <TableCell className="font-medium text-lg">{index + 1}</TableCell>
                                        {game.requiredPlayerFields.map(field => (
                                            <TableCell key={field.id}>{player.customData?.[field.id] || 'N/A'}</TableCell>
                                        ))}
                                        <TableCell className="text-right font-bold font-mono text-lg">{player.score}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={game.requiredPlayerFields.length + 2} className="text-center">
                                        No participants have joined yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
