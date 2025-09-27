
"use client";

import type { GridSquare, Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type ColorGridScreenProps = {
  grid: GridSquare[];
  teams: Team[];
  onColorSquare: (squareId: number) => void;
  teamColoring: string;
  credits: number;
  onSkip: () => void;
};

export default function ColorGridScreen({ grid, teams, onColorSquare, teamColoring, credits, onSkip }: ColorGridScreenProps) {
    const getTeamColor = (teamName: string | null) => {
        if (!teamName) return 'hsl(var(--card))';
        return teams.find(t => t.name === teamName)?.color || '#333';
    }

  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center">
        <Card className="w-full max-w-2xl bg-card/50">
            <CardHeader>
                <CardTitle className="font-display text-3xl" style={{color: teamColoring}}>Claim Your Territory!</CardTitle>
                <CardDescription>You have {credits} credit{credits !== 1 && 's'}. Click a square to claim it for your team.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-10 gap-1.5 aspect-square w-full mx-auto my-4">
                    {grid.map(square => (
                        <button
                            key={square.id}
                            onClick={() => onColorSquare(square.id)}
                            disabled={!!square.coloredBy}
                            className="w-full aspect-square rounded-md border-2 border-border transition-all duration-300 disabled:cursor-not-allowed hover:border-primary hover:scale-110 disabled:hover:scale-100 disabled:hover:border-border"
                            style={{ backgroundColor: getTeamColor(square.coloredBy) }}
                            aria-label={`Square ${square.id + 1}, ${square.coloredBy ? `colored by ${square.coloredBy}` : 'uncolored'}`}
                        />
                    ))}
                </div>
                <Button variant="link" onClick={onSkip}>Skip and answer next question</Button>
            </CardContent>
        </Card>
    </div>
  );
}
