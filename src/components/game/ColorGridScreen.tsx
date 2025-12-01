
"use client";

import type { GridSquare, Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import HexMap from "@/components/game/HexMap";
import { cn } from "@/lib/utils";

type ColorGridScreenProps = {
  grid: GridSquare[];
  teams: Team[];
  onColorSquare: (squareId: number) => void;
  teamColoring: string; // The color of the current player/team
  credits: number;
  onSkip: () => void;
};

export default function ColorGridScreen({ grid, teams, onColorSquare, teamColoring, credits, onSkip }: ColorGridScreenProps) {
  return (
    <div className="flex flex-col items-center justify-between flex-1 text-center w-full relative mobile-grid-background p-4">
      <div className="relative z-10 w-full">
        <div className="bg-background/80 backdrop-blur-sm p-4 rounded-lg shadow-xl text-center">
            <h1 className="font-display text-2xl" style={{color: teamColoring}}>Claim Your Territory!</h1>
            <p className="text-muted-foreground mt-1 text-sm">You have {credits} credit{credits !== 1 && 's'}. Tap a hex to claim it.</p>
             <Button variant="link" onClick={onSkip} className="text-foreground drop-shadow-md mt-1 text-sm h-auto py-1">Skip and answer next question</Button>
        </div>
      </div>

      <div className="absolute inset-0 z-0 flex items-center justify-center mt-12">
        <HexMap 
            grid={grid}
            teams={teams}
            onHexClick={(id) => onColorSquare(id)}
        />
      </div>
    </div>
  );
}
