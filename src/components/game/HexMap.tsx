
import type { GridSquare, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

type HexMapProps = {
    grid: GridSquare[];
    teams: Team[];
    onHexClick: (id: number) => void;
}

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

const BUCKET_BASE_URL = "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2F";

const accessTokens: Record<string, string> = {
    "01": "3df822fb-e8e5-4ee4-b217-e99b075719e3",
    "02": "a8e68836-42f6-4879-a105-e8546c0e0e6c",
    "03": "430e6620-6659-444b-9d0a-798d8be2a74d",
    "04": "cca66808-6781-4bd9-b279-6aaba57f22fc",
    "05": "0bd5304a-3948-4c87-8c09-9eb95d2defd0",
    "06": "your-token-for-06.png",
    "07": "your-token-for-07.png",
    "08": "your-token-for-08.png",
    "09": "your-token-for-09.png",
    "10": "your-token-for-10.png",
    "11": "your-token-for-11.png",
    "12": "your-token-for-12.png",
    "13": "your-token-for-13.png",
    "14": "your-token-for-14.png",
    "15": "your-token-for-15.png",
    "16": "your-token-for-16.png",
    "17": "your-token-for-17.png",
    "18": "your-token-for-18.png",
    "19": "your-token-for-19.png",
    "20": "your-token-for-20.png",
    "21": "your-token-for-21.png",
    "22": "your-token-for-22.png",
};


const imageMap: Record<number, number> = {
    1: 20, 2: 17, 3: 12, 4: 1, 5: 7, 6: 0, 7: 18, 8: 13, 9: 3,
    10: 10, 11: 6, 12: 14, 13: 4, 14: 15, 15: 8, 16: 19, 17: 21,
    18: 2, 19: 5, 20: 9, 21: 11, 22: 16
};

const pathIndexToImageNumber: Record<number, number> = Object.entries(imageMap).reduce((acc, [imgNum, pathIdx]) => {
    acc[pathIdx] = parseInt(imgNum, 10);
    return acc;
}, {} as Record<number, number>);


export default function HexMap({ grid, teams, onHexClick }: HexMapProps) {
    const getTeamColor = (teamName: string | null) => {
        if (!teamName) return 'transparent';
        return teams.find(t => t.name === teamName)?.color || '#333';
    };

    const isClickable = !!onHexClick;
    
    return (
        <svg viewBox="0 0 2048 2048" className="w-full h-full drop-shadow-lg">
            <defs>
                {hexPaths.map((path, index) => (
                    <clipPath key={`clip-${index}`} id={`clip-hex-${index}`}>
                        <path d={path} />
                    </clipPath>
                ))}
            </defs>

            {hexPaths.map((path, index) => {
                const square = grid.find(s => s.id === index);
                const isColored = !!square?.coloredBy;
                const isDisabled = isColored || !isClickable;
                const imageFileNumber = pathIndexToImageNumber[index];
                const paddedNum = String(imageFileNumber).padStart(2, '0');
                const token = accessTokens[paddedNum];
                const imageUrl = `${BUCKET_BASE_URL}${paddedNum}.png?alt=media${token ? `&token=${token}` : ''}`;

                return (
                    <g key={index} onClick={() => !isDisabled && onHexClick(index)} clipPath={`url(#clip-hex-${index})`}>
                        {/* Background Image */}
                        <image 
                            href={imageUrl} 
                            x="0" 
                            y="0" 
                            width="100%" 
                            height="100%" 
                            preserveAspectRatio="none"
                            className={cn(
                                "transition-all duration-300",
                                isClickable && !isColored && "cursor-pointer group-hover:opacity-80 group-hover:scale-[1.02]",
                            )}
                        />

                        {/* Team Color Overlay */}
                        {isColored && (
                            <path 
                                d={path}
                                style={{ fill: getTeamColor(square?.coloredBy || null), fillOpacity: 0.7 }}
                                className="pointer-events-none"
                            />
                        )}

                        {/* Border (rendered on top) */}
                        <path
                            d={path}
                            fill="none"
                            className={cn(
                                "stroke-black/50 dark:stroke-white/50",
                                "stroke-[3px] transition-all duration-300",
                                isClickable && !isColored && "cursor-pointer group-hover:stroke-primary",
                                isColored && "cursor-not-allowed",
                            )}
                        />
                    </g>
                )
            })}
        </svg>
    )
}
