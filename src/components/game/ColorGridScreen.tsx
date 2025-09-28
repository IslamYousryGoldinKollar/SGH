
"use client";

import type { GridSquare, Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import HexMap from "@/components/game/HexMap";

type ColorGridScreenProps = {
  grid: GridSquare[];
  teams: Team[];
  onColorSquare: (squareId: number) => void;
  teamColoring: string;
  credits: number;
  onSkip: () => void;
};

export default function ColorGridScreen({ grid, teams, onColorSquare, teamColoring, credits, onSkip }: ColorGridScreenProps) {

  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center w-full">
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle className="font-display text-3xl" style={{color: teamColoring}}>Claim Your Territory!</CardTitle>
                <CardDescription>You have {credits} credit{credits !== 1 && 's'}. Click a hex to claim it for your team.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="w-full max-w-lg mx-auto my-4 px-4 sm:px-0">
                  <HexMap 
                    grid={grid}
                    teams={teams}
                    onHexClick={onColorSquare}
                  />
                </div>
                <Button variant="link" onClick={onSkip}>Skip and answer next question</Button>
            </CardContent>
        </Card>
    </div>
  );
}

    