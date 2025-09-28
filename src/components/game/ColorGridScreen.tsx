
"use client";

import type { GridSquare, Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import HexMap from "@/components/game/HexMap";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-col items-center justify-center flex-1 text-center w-full relative mobile-grid-background">
      <div className="absolute inset-0 z-0">
        <HexMap 
          grid={grid}
          teams={teams}
          onHexClick={onColorSquare}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-between h-full w-full pt-8 pb-4">
        <div className="bg-background/80 backdrop-blur-sm p-4 rounded-lg shadow-xl">
            <h1 className="font-display text-3xl" style={{color: teamColoring}}>Claim Your Territory!</h1>
            <p className="text-muted-foreground mt-1">You have {credits} credit{credits !== 1 && 's'}. Click a hex to claim it for your team.</p>
        </div>

        <Button variant="link" onClick={onSkip} className="text-background drop-shadow-md">Skip and answer next question</Button>
      </div>
    </div>
  );
}
