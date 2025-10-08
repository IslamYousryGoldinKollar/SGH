
"use client";

import type { GridSquare, Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

type LandRushBoardProps = {
    grid: GridSquare[];
    teams: Team[];
    onTileClick: (id: number) => void;
    credits: number;
    currentPlayerId: string;
};

export default function LandRushBoard({ grid, teams, onTileClick, credits, currentPlayerId }: LandRushBoardProps) {
    
    const getTileColor = (coloredBy: string | null): string => {
        if (!coloredBy) return "bg-muted/30 hover:bg-muted/70";
        // In land-rush, coloredBy is a player ID
        const team = teams.find(t => t.players.some(p => p.id === coloredBy));
        if (team) {
            return team.color;
        }
        return "bg-gray-500";
    };

    const handleTileClick = (tile: GridSquare) => {
        if (credits > 0 && !tile.coloredBy) {
            onTileClick(tile.id);
        }
    }

    return (
        <div className="flex-1 flex flex-col bg-card/80 backdrop-blur-sm p-4 rounded-lg shadow-inner">
            <div className="text-center mb-2">
                <h3 className={cn("font-display text-lg", credits > 0 && "text-primary")}>
                    Land Grid
                </h3>
                {credits > 0 && (
                     <p className="text-sm text-primary animate-pulse font-semibold">
                        Claim Your Land! ({credits} available)
                     </p>
                )}
            </div>
            <div className="grid grid-cols-10 gap-1 flex-1">
                {grid.map((tile) => {
                    const color = getTileColor(tile.coloredBy);
                    const canClaim = credits > 0 && !tile.coloredBy;
                    const isSpecial = !tile.coloredBy && tile.specialType;

                    return (
                        <div
                            key={tile.id}
                            onClick={() => handleTileClick(tile)}
                            className={cn(
                                "aspect-square rounded-sm transition-all duration-200 relative",
                                canClaim && "cursor-pointer hover:scale-110 bg-muted/30 hover:bg-primary/50",
                                !canClaim && !tile.coloredBy && "bg-muted/30 cursor-not-allowed",
                                isSpecial && "bg-yellow-400/20"
                            )}
                             style={{ backgroundColor: tile.coloredBy ? color : undefined }}
                        >
                          {isSpecial && (
                            <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-yellow-300 animate-pulse" />
                          )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
