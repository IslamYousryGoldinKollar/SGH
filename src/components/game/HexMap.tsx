
"use client";

import { useEffect, useRef, forwardRef } from "react";
import type { GridSquare, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

const hexPaths = [
    "M826 969.8 826 1038.2 1004 1116.3 1181.9 1038.2 1181.9 969.8 1004 891.7 826 969.8",
    "M471.1 969.8 471.1 1038.2 649 1116.3 827 1038.2 827 969.8 649 891.7 471.1 969.8",
    "M293.1 1116.3 293.1 1184.7 471.1 1262.8 649 1184.7 649 1116.3 471.1 1038.2 293.1 1116.3",
    "M648 1116.3 648 1184.8 826 1262.8 1004 1184.8 1004 1116.3 826 1038.2 648 1116.3",
    "M471.1 1262.8 471.1 1331.3 649 1409.3 827 1331.3 827 1262.8 649 1184.7 471.1 1262.8",
    "M826 1262.9 826 1331.3 1004 1409.4 1181.9 1331.3 1181.9 1262.9 1004 1184.8 826 1262.9",
    "M1004 1116.3 1004 1184.8 1181.9 1262.8 1359.9 1184.8 1359.9 1116.3 1181.9 1038.2 1004 1116.3",
    "M1181.9 969.8 1181.9 1038.3 1359.9 1116.3 1537.9 1038.3 1537.9 969.8 1359.9 891.7 1181.9 969.8",
    "M648 1409.4 648 1477.9 826 1555.9 1004 1477.9 1004 1409.4 826 1331.3 648 1409.4",
    "M1004 1409.4 1004 1477.9 1181.9 1555.9 1359.9 1477.9 1359.9 1409.4 1181.9 1331.3 1004 1409.4",
    "M1181.9 1262.9 1181.9 1331.3 1359.9 1409.4 1537.9 1331.3 1537.9 1262.9 1359.9 1184.8 1181.9 1262.9",
    "M1359.9 1116.3 1359.9 1184.7 1537.9 1262.8 1715.8 1184.7 1715.8 1116.3 1537.9 1038.2 1359.9 1116.3",
    "M293.1 823.3 293.1 891.7 471.1 969.8 649 891.7 649 823.3 471.1 745.2 293.1 823.3",
    "M648 823.3 648 891.8 826 969.8 1004 891.8 1004 823.3 826 745.2 648 823.3",
    "M1004 823.3 1004 891.8 1181.9 969.8 1359.9 891.8 1359.9 823.3 1181.9 745.2 1004 823.3",
    "M1359.9 823.3 1359.9 891.8 1537.9 969.8 1715.8 891.8 1715.8 823.3 1537.9 745.2 1359.9 823.3",
    "M1537.9 969.8 1537.9 1038.2 1715.8 1116.3 1893.8 1038.2 1893.8 969.8 1715.8 891.7 1537.9 969.8",
    "M470.1 676.8 470.1 745.3 648 823.3 826 745.3 826 676.8 648 598.7 470.1 676.8",
    "M826 676.8 826 745.3 1004 823.3 1181.9 745.3 1181.9 676.8 1004 598.7 826 676.8",
    "M1181.9 676.8 1181.9 745.3 1359.9 823.3 1537.9 745.3 1537.9 676.8 1359.9 598.7 1181.9 676.8",
    "M648 530.3 648 598.8 826 676.8 1004 598.8 1004 530.3 826 452.2 648 530.3",
    "M1004 530.3 1004 598.8 1181.9 676.8 1359.9 598.8 1359.9 530.3 1181.9 452.2 1004 530.3"
];

type HexMapProps = {
    grid: GridSquare[];
    teams: Team[];
    onHexClick?: (id: number, event: React.MouseEvent<SVGPathElement>) => void;
}

const HexMap = forwardRef<SVGSVGElement, HexMapProps>(({ grid, teams, onHexClick }, ref) => {
    
    // Function to convert hex color to rgba with 70% opacity
    const hexToRgba = (hex: string, alpha = 0.7) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const getTeamColor = (teamName: string | null) => {
        if (!teamName) return 'transparent';
        const teamColor = teams.find(t => t.name === teamName)?.color;
        return teamColor ? hexToRgba(teamColor) : 'rgba(51, 51, 51, 0.7)';
    };

    const isClickable = !!onHexClick;
    
    return (
        <div className="relative w-full h-full pointer-events-none">
            <div className="absolute inset-0">
                <img
                    src="https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fnew%20land%20copy.png?alt=media&token=ff315d80-6d9c-40ac-a7fd-b23ac0c19cfb"
                    alt="Game Map"
                    className="w-full h-full object-contain"
                />
            </div>
            <svg viewBox="0 0 2048 2048" ref={ref} className="absolute inset-0 w-full h-full">
                <g transform="scale(0.92) translate(85, 170)">
                    {hexPaths.map((path, index) => {
                        const square = grid.find(s => s.id === index);
                        const isColored = !!square?.coloredBy;
                        
                        return (
                            <path
                                key={index}
                                d={path}
                                data-hex-id={index}
                                onClick={(e) => isClickable && onHexClick(index, e)}
                                fill={getTeamColor(square?.coloredBy || null)}
                                className={cn(
                                    "stroke-black/50 dark:stroke-white/50",
                                    "transition-all duration-300 [stroke-dasharray:10_10] [stroke-width:1.5px]",
                                    isClickable && "pointer-events-auto cursor-pointer",
                                    isClickable && !isColored && "hover:fill-white/30"
                                )}
                            />
                        );
                    })}
                </g>
            </svg>
        </div>
    );
});

HexMap.displayName = 'HexMap';

export default HexMap;

    
