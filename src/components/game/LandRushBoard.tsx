
"use client";

import type { GridSquare, Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sparkles, Hand } from "lucide-react";

type LandRushBoardProps = {
    grid: GridSquare[];
    teams: Team[];
    onTileClick: (id: number) => void;
    credits: number;
    currentPlayerId: string;
    isStealing: boolean;
};

export default function LandRushBoard({ grid, teams, onTileClick, credits, currentPlayerId, isStealing }: LandRushBoardProps) {
    
    const getTileColor = (coloredBy: string | null): string => {
        if (!coloredBy) return "bg-muted/30 hover:bg-muted/70";
        // In land-rush, coloredBy is a player ID
        const team = teams.find(t => t.players.some(p => p.id === coloredBy));
        if (team) {
            return team.color;
        }
        return "bg-gray-500";
    };

    const isStealable = (tile: GridSquare) => {
        if (!isStealing || !tile.coloredBy || tile.coloredBy === currentPlayerId) {
            return false;
        }
        // This is a simplified version. A full implementation would check adjacency
        // to the tile that triggered the steal. For now, any opponent tile is stealable.
        return true;
    }

    const handleTileClick = (tile: GridSquare) => {
        if (isStealing) {
            if (isStealable(tile)) {
                onTileClick(tile.id);
            }
        } else if (credits > 0 && !tile.coloredBy) {
            onTileClick(tile.id);
        }
    }

    let title = "Land Grid";
    let titleClass = "font-display text-lg";
    let subTitle = null;

    if (isStealing) {
        title = "Steal a Tile!";
        titleClass = "font-display text-lg text-destructive animate-pulse";
        subTitle = "Select an opponent's tile to capture it.";
    } else if (credits > 0) {
        title = "Claim Your Land!";
        titleClass = "font-display text-lg text-primary animate-pulse";
        subTitle = `You have ${credits} claim${credits > 1 ? 's' : ''} available.`;
    }

    return (
        <div className="flex-1 flex flex-col bg-card/80 backdrop-blur-sm p-4 rounded-lg shadow-inner">
            <div className="text-center mb-2">
                <h3 className={cn(titleClass)}>
                    {title}
                </h3>
                {subTitle && (
                     <p className="text-sm text-muted-foreground font-semibold">
                       {subTitle}
                     </p>
                )}
            </div>
            <div className="grid grid-cols-10 gap-1 flex-1">
                {grid.map((tile) => {
                    const color = getTileColor(tile.coloredBy);
                    const canClaim = credits > 0 && !tile.coloredBy && !isStealing;
                    const isSpecial = !tile.coloredBy && tile.specialType;
                    const stealTarget = isStealing && isStealable(tile);

                    return (
                        <div
                            key={tile.id}
                            onClick={() => handleTileClick(tile)}
                            className={cn(
                                "aspect-square rounded-sm transition-all duration-200 relative",
                                canClaim && "cursor-pointer hover:scale-110 bg-muted/30 hover:bg-primary/50",
                                !canClaim && !isStealing && !tile.coloredBy && "bg-muted/30 cursor-not-allowed",
                                stealTarget && "cursor-pointer ring-2 ring-destructive ring-offset-2 ring-offset-background animate-pulse",
                                isSpecial && "bg-yellow-400/20"
                            )}
                             style={{ backgroundColor: tile.coloredBy && !stealTarget ? color : undefined }}
                        >
                          {isSpecial && (
                            <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-yellow-300 animate-pulse" />
                          )}
                          {stealTarget && (
                              <div className="absolute inset-0 bg-destructive/50 flex items-center justify-center">
                                <Hand className="h-4 w-4 text-white" />
                              </div>
                          )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
