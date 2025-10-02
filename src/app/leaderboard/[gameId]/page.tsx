
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, getDocs, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Player } from "@/lib/types";
import { Loader2, Trophy, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LeaderboardPlayer = Player & { finalScore: number };

export default function LeaderboardPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    const parentGameId = params.gameId as string;
    const currentPlayerId = searchParams.get('player_id');

    const [parentGame, setParentGame] = useState<Game | null>(null);
    const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!parentGameId) return;

        // Fetch the parent game to get its title and config
        const parentGameRef = doc(db, "games", parentGameId.toUpperCase());
        const unsubParent = onSnapshot(parentGameRef, (doc) => {
             if (doc.exists()) {
                const gameData = { id: doc.id, ...doc.data() } as Game;
                if (gameData.sessionType !== 'individual') {
                    router.replace(`/game/${parentGameId}`);
                    return;
                }
                setParentGame(gameData);
             } else {
                 setParentGame(null);
                 setLoading(false);
             }
        });

        // Query for all individual games spawned from this parent session
        const gamesQuery = query(
            collection(db, "games"), 
            where("parentSessionId", "==", parentGameId.toUpperCase())
        );

        const unsubGames = onSnapshot(gamesQuery, async (querySnapshot) => {
            const allPlayers: LeaderboardPlayer[] = [];
            for (const gameDoc of querySnapshot.docs) {
                const game = gameDoc.data() as Game;
                if (game.players.length > 0) {
                    const player = game.players[0];
                    const hexCount = game.grid.filter(sq => sq.coloredBy === player.id).length;
                    allPlayers.push({
                        ...player,
                        finalScore: hexCount
                    });
                }
            }

            // Sort players by their final score
            const sortedPlayers = allPlayers.sort((a, b) => b.finalScore - a.finalScore);
            setPlayers(sortedPlayers);
            setLoading(false);
        });

        return () => {
            unsubParent();
            unsubGames();
        };

    }, [parentGameId, router]);
    
    if (loading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    if (!parentGame) {
        return <div className="flex h-screen w-full items-center justify-center"><h1>Session not found.</h1></div>;
    }

    const nameField = parentGame.requiredPlayerFields.find(f => f.label.toLowerCase().includes('name'));

    const top10Players = players.slice(0, 10);
    const currentPlayerRank = players.findIndex(p => p.id === currentPlayerId);
    const isCurrentPlayerInTop10 = currentPlayerRank !== -1 && currentPlayerRank < 10;
    const currentPlayerRowData = currentPlayerRank !== -1 ? players[currentPlayerRank] : null;

    return (
        <div className="container mx-auto px-4 py-8">
            <Button variant="outline" onClick={() => router.push(`/admin/`)} className="mb-8">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Button>
            <div className="text-center mb-12">
                <Trophy className="h-16 w-16 text-yellow-400 drop-shadow-lg mx-auto" />
                <h1 className="text-5xl font-bold font-display mt-4">{parentGame.title}</h1>
                <p className="text-muted-foreground mt-2 text-xl">Leaderboard</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Top 10 Participants</CardTitle>
                    <CardDescription>Scores are based on the number of lands colored at the end of the game.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">Rank</TableHead>
                                <TableHead>Name</TableHead>
                                {parentGame.requiredPlayerFields.filter(f => f.id !== nameField?.id).map(field => (
                                     <TableHead key={field.id}>{field.label}</TableHead>
                                ))}
                                <TableHead className="text-right">Score</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {top10Players.length > 0 ? (
                                top10Players.map((player, index) => (
                                    <TableRow key={player.id} className={cn(player.id === currentPlayerId && "bg-primary/20")}>
                                        <TableCell className="font-medium text-lg">{index + 1}</TableCell>
                                        <TableCell>{player.name}</TableCell>
                                        {parentGame.requiredPlayerFields.filter(f => f.id !== nameField?.id).map(field => (
                                            <TableCell key={field.id}>{player.customData?.[field.label] || 'N/A'}</TableCell>
                                        ))}
                                        <TableCell className="text-right font-bold font-mono text-lg">{player.finalScore}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={parentGame.requiredPlayerFields.length + 3} className="text-center">
                                        No participants have completed the challenge yet.
                                    </TableCell>
                                </TableRow>
                            )}

                             {!isCurrentPlayerInTop10 && currentPlayerRowData && (
                                <>
                                    <TableRow>
                                        <TableCell colSpan={parentGame.requiredPlayerFields.length + 3} className="text-center text-muted-foreground py-2">...</TableCell>
                                    </TableRow>
                                    <TableRow key={currentPlayerRowData.id} className="bg-accent/30 border-y-2 border-accent">
                                        <TableCell className="font-medium text-lg">{currentPlayerRank + 1}</TableCell>
                                        <TableCell>{currentPlayerRowData.name}</TableCell>
                                        {parentGame.requiredPlayerFields.filter(f => f.id !== nameField?.id).map(field => (
                                            <TableCell key={field.id}>{currentPlayerRowData.customData?.[field.label] || 'N/A'}</TableCell>
                                        ))}
                                        <TableCell className="text-right font-bold font-mono text-lg">{currentPlayerRowData.finalScore}</TableCell>
                                    </TableRow>
                                </>
                             )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

    