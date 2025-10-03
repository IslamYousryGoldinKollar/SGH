
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
        const parentGameRef = doc(db, "games", parentGameId);
        const unsubParent = onSnapshot(parentGameRef, (doc) => {
             if (doc.exists()) {
                setParentGame({ id: doc.id, ...doc.data() } as Game);
             } else {
                 setParentGame(null);
                 setLoading(false);
             }
        });

        // Query for all individual games spawned from this parent session
        const gamesQuery = query(
            collection(db, "games"), 
            where("parentSessionId", "==", parentGameId)
        );

        const unsubGames = onSnapshot(gamesQuery, async (querySnapshot) => {
            const allPlayers: LeaderboardPlayer[] = [];
            for (const gameDoc of querySnapshot.docs) {
                const game = gameDoc.data() as Game;
                if (game.sessionType === 'team' && game.teams.length > 0) { // 1v1 games
                     game.teams.forEach(team => {
                         if (team.players.length > 0) {
                             const player = team.players[0];
                             allPlayers.push({
                                 ...player,
                                 finalScore: team.score
                             });
                         }
                     });
                } else if (game.sessionType === 'individual' && game.teams?.[0]?.players.length > 0) { // Individual games
                    const player = game.teams[0].players[0];
                    const hexCount = game.grid.filter(sq => sq.coloredBy === player.teamName).length;
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

    const requiredFields = parentGame.sessionType === 'individual' 
        ? parentGame.requiredPlayerFields 
        : [{id: 'name', label: 'Name', type: 'text'}, {id: 'id', label: 'ID', type: 'text'}];


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
                    <CardTitle>Top Participants</CardTitle>
                    <CardDescription>Scores are based on performance in the game.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">Rank</TableHead>
                                {requiredFields.map(field => (
                                     <TableHead key={field.id}>{field.label}</TableHead>
                                ))}
                                <TableHead className="text-right">Score</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {top10Players.length > 0 ? (
                                top10Players.map((player, index) => (
                                    <TableRow key={`${player.id}-${player.playerId}-${index}`} className={cn(player.id === currentPlayerId && "bg-primary/20")}>
                                        <TableCell className="font-medium text-lg">{index + 1}</TableCell>
                                        {requiredFields.map(field => {
                                            let cellValue = 'N/A';
                                            if (parentGame.sessionType === 'individual') {
                                                cellValue = player.customData?.[field.label] || player.name || 'N/A';
                                            } else {
                                                if (field.id === 'name') cellValue = player.name;
                                                if (field.id === 'id') cellValue = player.playerId;
                                            }
                                            return <TableCell key={field.id}>{cellValue}</TableCell>
                                        })}
                                        <TableCell className="text-right font-bold font-mono text-lg">{player.finalScore}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={requiredFields.length + 2} className="text-center">
                                        No participants have completed the challenge yet.
                                    </TableCell>
                                </TableRow>
                            )}

                             {!isCurrentPlayerInTop10 && currentPlayerRowData && (
                                <>
                                    <TableRow>
                                        <TableCell colSpan={requiredFields.length + 2} className="text-center text-muted-foreground py-2">...</TableCell>
                                    </TableRow>
                                    <TableRow key={`${currentPlayerRowData.id}-${currentPlayerRowData.playerId}-rank`} className="bg-accent/30 border-y-2 border-accent">
                                        <TableCell className="font-medium text-lg">{currentPlayerRank + 1}</TableCell>
                                        {requiredFields.map(field => {
                                            let cellValue = 'N/A';
                                            if (parentGame.sessionType === 'individual') {
                                                cellValue = currentPlayerRowData.customData?.[field.label] || currentPlayerRowData.name || 'N/A';
                                            } else {
                                                if (field.id === 'name') cellValue = currentPlayerRowData.name;
                                                if (field.id === 'id') cellValue = currentPlayerRowData.playerId;
                                            }
                                            return <TableCell key={field.id}>{cellValue}</TableCell>
                                        })}
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
