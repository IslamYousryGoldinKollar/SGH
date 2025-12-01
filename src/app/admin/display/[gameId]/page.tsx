
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, Team, GridSquare, Player } from "@/lib/types";
import { Loader2, Play, Square, RotateCw, Users, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import HexMap from "@/components/game/HexMap";
import Image from "next/image";
import Timer from "@/components/game/Timer";
import confetti from 'canvas-confetti';


export default function DisplayPage() {
    const params = useParams();
    const gameId = params.gameId as string;
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [joinUrl, setJoinUrl] = useState("");
    const prevGridRef = useRef<GridSquare[] | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setJoinUrl(`${window.location.origin}/game/${gameId}`);
        }
    }, [gameId]);

    useEffect(() => {
        if (!gameId) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        const unsubscribe = onSnapshot(gameRef, (doc) => {
            if (doc.exists()) {
                const gameData = { id: doc.id, ...doc.data() } as Game;
                
                setGame(gameData);
            } else {
                setGame(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [gameId]);

    // Effect for territory capture confetti
    useEffect(() => {
      if (!game || !game.grid) {
        return;
      }
    
      const prevGrid = prevGridRef.current;
      const currentGrid = game.grid;
    
      if (prevGrid) {
        for (let i = 0; i < currentGrid.length; i++) {
          if (prevGrid[i].coloredBy === null && currentGrid[i].coloredBy !== null) {
            // A square has been captured
            const teamName = currentGrid[i].coloredBy;
            const team = game.teams.find(t => t.name === teamName);
            const teamIndex = game.teams.findIndex(t => t.name === teamName);

            if (team) {
              // Pre-defined origins for the towers. These are percentages of the screen width/height.
              const towerOrigins = [
                { x: 0.35, y: 0.3 }, // Left tower (Team Alpha)
                { x: 0.65, y: 0.3 }  // Right tower (Team Bravo)
              ];
              const origin = towerOrigins[teamIndex] || { x: 0.5, y: 0.5 };
              
              confetti({
                particleCount: 100,
                spread: 70,
                origin: origin,
                colors: [team.color],
                angle: 90,
                startVelocity: 40,
                scalar: 1.2
              });
            }
          }
        }
      }
    
      prevGridRef.current = [...currentGrid];
    }, [game]);


    const handleStartGame = async () => {
        if (!gameId) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        await updateDoc(gameRef, { status: "playing", gameStartedAt: serverTimestamp() });
    };

    const handleEndGame = async () => {
        if (!gameId) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        await updateDoc(gameRef, { status: "finished" });
    };

    const handlePlayAgain = async () => {
        if (!game) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        
        const initialGrid: GridSquare[] = Array.from({ length: 22 }, (_, i) => ({
            id: i,
            coloredBy: null,
        }));
        
        await updateDoc(gameRef, {
            status: "lobby",
            teams: game.teams.map(t => ({
                name: t.name,
                capacity: t.capacity,
                color: t.color,
                icon: t.icon,
                score: 0, 
                players: [],
            })),
            grid: initialGrid,
            gameStartedAt: null,
        });
    };

    const TeamDisplayCard = ({ team }: { team: Team }) => (
        <div className="relative pt-16 w-full h-full">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-background p-2 rounded-full shadow-lg">
                    <div className="w-32 h-32 rounded-full border-4 flex items-center justify-center" style={{borderColor: team.color, backgroundColor: team.color+'30'}}>
                       {team.icon ? <Image src={team.icon} alt={`${team.name} icon`} width={96} height={96} className="object-contain" /> : <Trophy className="w-16 h-16" style={{color: team.color}} />}
                    </div>
                </div>
            </div>
            <Card className="w-full h-full flex flex-col bg-background/80 backdrop-blur-sm" style={{ borderColor: team.color }}>
                <CardHeader className="text-center flex-shrink-0 p-4 pt-20">
                     <CardTitle className="text-4xl font-display" style={{ color: team.color }}>{team.name}</CardTitle>
                     <div className="flex items-center justify-center text-muted-foreground pt-2">
                        <Users className="mr-2 h-5 w-5" /> 
                        <span className="text-2xl">{team.players.length} / {team.capacity}</span>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 p-4">
                    <ScrollArea className="flex-1">
                        <ul className="space-y-2 text-lg text-center pr-4">
                            {team.players.map(p => (
                                <li key={p.id} className="truncate bg-secondary/30 p-2 rounded-md">{p.name}</li>
                            ))}
                             {team.players.length === 0 && <li className="text-muted-foreground italic">No players yet...</li>}
                        </ul>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
    
    const renderLobby = () => {
        if (!game || !joinUrl) return null;

        const teamLeft = game.teams.length > 0 ? game.teams[0] : null;
        const teamRight = game.teams.length > 1 ? game.teams[1] : null;

        return (
            <div className="flex-1 w-full max-w-full flex items-center justify-around gap-8 p-8">
                {/* Left Team */}
                <div className="w-1/4 h-3/4 flex">
                    {teamLeft && <TeamDisplayCard team={teamLeft} />}
                </div>

                {/* Center Content */}
                <div className="w-1/3 flex flex-col items-center justify-center text-center text-card-foreground relative">
                     <Image 
                        src="https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fnew%20landtt.png?alt=media&token=023703ec-e56c-41f8-a34a-d8dd3b3bf527"
                        alt="Game map background"
                        fill
                        className="object-contain -z-10 opacity-50"
                     />
                    <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl">
                        <div className="mb-6 w-full max-w-sm h-auto text-primary">
                            <svg id="Layer_2" data-name="Layer 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3189.14 1035.43">
                                <defs>
                                    <style>
                                      {`.cls-1 { fill: hsl(var(--primary)); }`}
                                    </style>
                                </defs>
                                <g id="Layer_1-2" data-name="Layer 1">
                                    <g>
                                    <g>
                                        <path className="cls-1" d="M75.76,46.35h81.11v120.33h90.92v65.07h-90.92v284.33c0,12.48.45,22.73,1.34,30.75.89,8.02,2.97,14.41,6.24,19.16,3.26,4.76,8.16,8.02,14.71,9.8,6.53,1.78,15.74,2.67,27.63,2.67h41v67.74h-58.83c-23.17,0-42.05-1.63-56.6-4.9-14.57-3.26-26-9.21-34.32-17.83-8.33-8.61-14.12-20.79-17.38-36.54-3.27-15.74-4.9-36.1-4.9-61.05V231.74H0v-65.07h75.76V46.35Z"/>
                                        <path className="cls-1" d="M432.29,238.87c13.66-22.58,32.83-41.59,57.49-57.04,24.65-15.44,57.18-23.17,97.6-23.17,29.11,0,53.62,4.46,73.53,13.37,19.9,8.91,36.1,21.54,48.58,37.88,12.48,16.35,21.53,35.81,27.18,58.38,5.64,22.59,8.47,47.55,8.47,74.87v303.05h-81.11v-278.98c0-18.41-1.2-35.94-3.57-52.59-2.38-16.63-7.13-31.34-14.26-44.12-7.13-12.77-17.69-22.87-31.64-30.31-13.97-7.42-32.53-11.14-55.71-11.14-39.22,0-70.12,13.23-92.7,39.66-22.59,26.45-33.87,65.51-33.87,117.21v260.27h-81.11V0h81.11v238.87Z"/>
                                        <path className="cls-1" d="M1926.14,166.68h83.78l95.37,354.75,91.8-354.75h87.35l-138.15,479.53h-73.98l-106.07-385.94-102.5,385.94h-73.98l-138.15-479.53h87.35l91.8,354.75,95.37-354.75Z"/>
                                        <path className="cls-1" d="M2480.54,657.79c-22.59,0-43.83-3.12-63.73-9.36-19.92-6.24-37.44-15.15-52.59-26.74-15.15-11.59-27.05-25.99-35.65-43.23-8.62-17.23-12.92-36.84-12.92-58.83,0-28.52,7.72-52.28,23.17-71.31,15.44-19.01,37.28-34.76,65.51-47.24,28.22-12.48,62.24-22.58,102.06-30.3,39.8-7.72,84.37-14.26,133.7-19.61v-11.59c0-21.98-2.83-40.4-8.47-55.26-5.65-14.85-13.37-26.88-23.17-36.1-9.8-9.21-21.39-15.74-34.76-19.61-13.37-3.86-27.49-5.79-42.34-5.79-33.87,0-60.16,8.47-78.88,25.4-18.72,16.94-28.97,40.26-30.75,69.97h-83.78c1.78-25.54,8.47-48.42,20.05-68.63,11.59-20.19,26.29-37.13,44.12-50.81,17.83-13.66,37.88-24.07,60.16-31.2,22.28-7.13,45.01-10.7,68.19-10.7,66.54,0,115.12,16.04,145.73,48.13,30.6,32.09,45.6,82,45.01,149.74l-.89,110.52c-.6,40.42.14,75.02,2.23,103.84,2.08,28.83,5.49,54.52,10.25,77.1h-82c-1.2-8.91-2.38-18.56-3.57-28.97-1.2-10.39-2.09-22.73-2.67-36.99-14.86,24.96-35.21,44.12-61.06,57.49-25.85,13.37-60.16,20.06-102.95,20.06ZM2646.33,415.36c-36.85,3.57-70.12,7.88-99.83,12.92-29.72,5.06-54.97,11.45-75.76,19.16-20.81,7.73-36.85,17.24-48.13,28.52-11.29,11.29-16.93,25.26-16.93,41.89,0,22.59,8.16,40.86,24.51,54.82,16.34,13.97,39.07,20.95,68.19,20.95,19.01,0,37.44-2.37,55.26-7.13,17.83-4.75,33.56-12.92,47.24-24.51,13.66-11.59,24.65-26.74,32.98-45.46,8.31-18.72,12.48-42.34,12.48-70.86v-30.31Z"/>
                                        <path className="cls-1" d="M3189.14,166.68l-171.13,500.03c-8.91,26.14-17.53,47.82-25.85,65.07-8.33,17.23-18.43,31.04-30.31,41.45-11.89,10.39-26.6,17.83-44.12,22.28-17.53,4.46-39.66,6.68-66.4,6.68h-41.89v-67.74h32.98c13.06,0,24.8-.6,35.21-1.78,10.39-1.2,19.46-4.32,27.19-9.36,7.72-5.06,14.71-12.79,20.95-23.17,6.24-10.4,12.03-25.11,17.38-44.12l3.57-9.8-172.92-479.53h90.02l122.11,369.9,118.55-369.9h84.67Z"/>
                                    </g>
                                    <path className="cls-1" d="M1028.22,655.81c65.87,0,115.69-23.89,150.18-57.61,35.15,35.73,87.84,57.7,152.33,57.7,79.54,0,144.12-31.48,193.79-80.34l63.77,69.55h134.85l-138.28-149.6c31.62-56.1,51.37-118.12,57.99-182.18h-99.35c-2.19,38.2-10.02,75.87-23.21,111.77-11.75,32.59-29.13,62.85-51.35,89.42-32.29,37.26-73.65,61.28-120.89,61.28-55.75,0-94-23.89-108.53-63.81h-106.18c-17.39,41.41-57.94,62.1-109.29,62.1-56.31,0-114.3-40.55-120.89-123.38h332.3c8.5-40.74,40.74-71.32,92.85-91.04,0,0,48.2-17.77,96.06-38.22,66.25-30.62,115.93-85.27,115.93-154.86,0-98.54-84.45-132.45-160.63-132.45-96.06,0-167.18,50.5-167.18,130.84,0,47.19,25.7,91.9,63.77,136.61-20.05,7.07-39.28,16.31-57.32,27.56-30.67-84.6-101.26-139.42-197.28-139.42-126.72,0-218.63,95.24-218.63,229.27s81.97,236.82,225.22,236.82h-.02ZM1380.35,108.94v-.33c36.4,0,66.21,20.68,66.21,61.28,0,37.25-22.35,73.71-72.85,96.06l-.81-.86c-29.85-31.48-57.99-67.87-57.99-102.65s30.62-53.49,65.44-53.49h0ZM1021.53,266.85v-.19c57.94,0,110.96,42.27,113.45,111.82h-231.85c8.27-84.26,72.03-111.63,118.41-111.63h0Z"/>
                                    </g>
                                    <g>
                                    <g>
                                        <path className="cls-1" d="M1871.57,937.48c0,10.19-1.52,19.51-4.55,27.94-3.04,8.44-7.37,15.65-13.02,21.66s-12.44,10.65-20.39,13.93c-7.95,3.28-16.84,4.91-26.67,4.91s-18.72-1.64-26.67-4.91c-7.95-3.28-14.75-7.92-20.39-13.93-5.64-6.01-9.98-13.23-13.01-21.66-3.03-8.43-4.55-17.75-4.55-27.94s1.52-19.51,4.55-27.95c3.03-8.43,7.37-15.62,13.01-21.57,5.65-5.95,12.44-10.56,20.39-13.84,7.95-3.28,16.84-4.92,26.67-4.92s18.72,1.64,26.67,4.92c7.95,3.27,14.75,7.89,20.39,13.84,5.64,5.95,9.98,13.14,13.02,21.57,3.03,8.44,4.55,17.75,4.55,27.95ZM1769.26,937.48c0,7.77,1,14.62,3,20.57,2,5.95,4.7,10.93,8.1,14.93,3.39,4,7.4,7.04,12.01,9.1,4.61,2.06,9.47,3.09,14.56,3.09s9.95-1.03,14.56-3.09c4.61-2.06,8.62-5.1,12.02-9.1,3.39-4,6.1-8.98,8.1-14.93,2-5.94,3.01-12.8,3.01-20.57s-1-14.59-3.01-20.48c-2-5.89-4.71-10.83-8.1-14.84-3.4-4.01-7.4-7.04-12.02-9.11-4.61-2.06-9.47-3.09-14.56-3.09s-9.95,1.03-14.56,3.09c-4.61,2.07-8.62,5.1-12.01,9.11-3.4,4-6.1,8.95-8.1,14.84-2,5.89-3,12.71-3,20.48Z"/>
                                        <path className="cls-1" d="M1947.49,990.64c-2.79,4.98-6.74,8.77-11.83,11.38-5.1,2.61-10.68,3.91-16.75,3.91-11.78,0-20.21-3.39-25.31-10.19-5.1-6.8-7.65-16.2-7.65-28.22v-61.89h25.13v56.44c0,3.27.18,6.34.55,9.19.36,2.85,1.09,5.37,2.18,7.56,1.09,2.18,2.7,3.88,4.83,5.09,2.12,1.21,4.94,1.82,8.46,1.82,4.12,0,7.52-.79,10.19-2.37,2.67-1.58,4.77-3.7,6.28-6.37,1.51-2.67,2.55-5.76,3.09-9.28.55-3.52.82-7.22.82-11.11v-50.97h25.12v97.94h-25.12v-12.93Z"/>
                                        <path className="cls-1" d="M2051.26,929.84c-1.82-.24-3.55-.39-5.19-.46-1.64-.06-3.37-.09-5.19-.09-3.16,0-5.98.33-8.46,1-2.49.67-4.64,1.85-6.46,3.55-1.82,1.7-3.22,4.04-4.19,7.01-.97,2.97-1.45,6.77-1.45,11.38v51.34h-25.13v-97.94h24.76v17.11c2.79-6.07,6.37-10.4,10.74-13.01,4.37-2.61,9.4-3.92,15.11-3.92.85,0,1.76.03,2.73.09.97.06,1.88.15,2.73.27v23.67Z"/>
                                        <path className="cls-1" d="M2210.55,968.25l18.02-96.67h26.58l-29.31,131.99h-30.76l-20.03-98.31-20.02,98.31h-30.77l-29.31-131.99h26.95l19.66,96.12,18.39-96.12h30.4l20.2,96.67Z"/>
                                        <path className="cls-1" d="M2323.06,991.37c-3.52,5.1-7.89,8.8-13.11,11.1-5.22,2.3-11.53,3.46-18.93,3.46-4.73,0-9.23-.67-13.47-2-4.25-1.33-7.98-3.25-11.2-5.74-3.22-2.48-5.8-5.49-7.74-9.01-1.94-3.52-2.91-7.53-2.91-12.02,0-5.83,1.55-10.68,4.64-14.56,3.09-3.88,7.47-7.1,13.11-9.65,5.64-2.55,12.44-4.61,20.39-6.19,7.95-1.58,16.72-2.91,26.31-4v-1.64c0-7.52-1.8-12.8-5.37-15.84-3.58-3.03-7.92-4.55-13.02-4.55s-9.04,1.27-12.56,3.82c-3.52,2.55-5.4,6.55-5.64,12.01h-23.49c.48-4.85,1.82-9.31,4-13.38,2.18-4.06,5.1-7.58,8.74-10.56,3.64-2.97,8.01-5.31,13.11-7.01,5.1-1.7,10.8-2.55,17.11-2.55,5.82,0,11.29.7,16.38,2.09,5.1,1.4,9.56,3.76,13.38,7.1,3.82,3.34,6.86,7.77,9.11,13.29,2.24,5.53,3.37,12.41,3.37,20.66,0,.73-.03,2.03-.09,3.91-.06,1.88-.09,4.01-.09,6.37s-.03,4.86-.09,7.47c-.06,2.61-.09,5.01-.09,7.19,0,7.77.24,14.08.73,18.93.48,4.85,1.21,9.35,2.18,13.47h-23.12c-.36-1.58-.67-3.39-.91-5.46-.24-2.06-.48-4.3-.73-6.73ZM2320.87,958.78c-7.04.73-13.05,1.52-18.02,2.37s-9.04,1.91-12.2,3.18c-3.16,1.27-5.46,2.85-6.92,4.73-1.45,1.88-2.18,4.16-2.18,6.83,0,3.52,1.39,6.55,4.19,9.1,2.79,2.55,7.04,3.82,12.74,3.82,7.89,0,13.59-2,17.11-6.01,3.52-4,5.28-9.59,5.28-16.75v-7.28Z"/>
                                        <path className="cls-1" d="M2363.66,1035.43v-19.3h9.46c2.06,0,3.88-.03,5.46-.09,1.58-.06,3.01-.42,4.28-1.09,1.27-.67,2.42-1.7,3.46-3.09,1.03-1.4,2.09-3.37,3.19-5.92l1.09-2.73-37.5-97.58h27.49l22.21,70.64,22.76-70.64h25.49l-35.86,95.03c-2.91,7.65-5.52,13.75-7.83,18.3-2.31,4.55-4.91,8.04-7.83,10.47-2.91,2.42-6.34,4.03-10.29,4.83-3.94.79-8.95,1.18-15.02,1.18h-10.56Z"/>
                                        <path className="cls-1" d="M2465.79,964.61l-4.55-59.17v-33.86h25.12v33.86l-4,59.17h-16.57ZM2460.33,1003.57v-27.31h26.94v27.31h-26.94Z"/>
                                    </g>
                                    <g>
                                        <path className="cls-1" d="M831.13,937.2c0,10.19-1.52,19.51-4.55,27.94-3.04,8.44-7.37,15.65-13.02,21.66-5.64,6.01-12.44,10.65-20.39,13.93-7.95,3.28-16.84,4.91-26.67,4.91s-18.72-1.64-26.67-4.91c-7.95-3.28-14.75-7.92-20.39-13.93-5.64-6.01-9.98-13.23-13.01-21.66-3.03-8.43-4.55-17.75-4.55-27.94s1.52-19.51,4.55-27.95c3.03-8.43,7.37-15.62,13.01-21.57,5.65-5.95,12.44-10.56,20.39-13.84,7.95-3.28,16.84-4.92,26.67-4.92s18.72,1.64,26.67,4.92c7.95,3.27,14.75,7.89,20.39,13.84,5.64,5.95,9.98,13.14,13.02,21.57,3.03,8.44,4.55,17.75,4.55,27.95ZM728.82,937.2c0,7.77,1,14.62,3,20.57,2,5.95,4.7,10.93,8.1,14.93,3.39,4,7.4,7.04,12.01,9.1,4.61,2.06,9.47,3.09,14.56,3.09s9.95-1.03,14.56-3.09c4.61-2.06,8.62-5.1,12.02-9.1,3.39-4,6.1-8.98,8.1-14.93,2-5.94,3.01-12.8,3.01-20.57s-1-14.59-3.01-20.48c-2-5.89-4.71-10.83-8.1-14.84-3.4-4.01-7.4-7.04-12.02-9.11-4.61-2.06-9.47-3.09-14.56-3.09s-9.95,1.03-14.56,3.09c-4.61,2.07-8.62,5.1-12.01,9.11-3.4,4-6.1,8.95-8.1,14.84-2,5.89-3,12.71-3,20.48Z"/>
                                        <path className="cls-1" d="M907.04,990.36c-2.79,4.98-6.74,8.77-11.83,11.38-5.1,2.61-10.68,3.91-16.75,3.91-11.78,0-20.21-3.39-25.31-10.19-5.1-6.8-7.65-16.2-7.65-28.22v-61.89h25.13v56.44c0,3.27.18,6.34.55,9.19.36,2.85,1.09,5.37,2.18,7.56,1.09,2.18,2.7,3.88,4.83,5.09,2.12,1.21,4.94,1.82,8.46,1.82,4.12,0,7.52-.79,10.19-2.37,2.67-1.58,4.77-3.7,6.28-6.37,1.51-2.67,2.55-5.76,3.09-9.28.55-3.52.82-7.22.82-11.11v-50.97h25.12v97.94h-25.12v-12.93Z"/>
                                        <path className="cls-1" d="M1010.81,929.56c-1.82-.24-3.55-.39-5.19-.46-1.64-.06-3.37-.09-5.19-.09-3.16,0-5.98.33-8.46,1-2.49.67-4.64,1.85-6.46,3.55-1.82,1.7-3.22,4.04-4.19,7.01-.97,2.97-1.45,6.77-1.45,11.38v51.34h-25.13v-97.94h24.76v17.11c2.79-6.07,6.37-10.4,10.74-13.01,4.37-2.61,9.4-3.92,15.11-3.92.85,0,1.76.03,2.73.09.97.06,1.88.15,2.73.27v23.67Z"/>
                                        <path className="cls-1" d="M1080.9,871.3l31.5,99.4,30.58-99.4h27.67l-45.51,131.99h-26.58l-45.87-131.99h28.22Z"/>
                                        <path className="cls-1" d="M1230.91,991.09c-3.52,5.1-7.89,8.8-13.11,11.1-5.22,2.3-11.53,3.46-18.93,3.46-4.73,0-9.23-.67-13.47-2-4.25-1.33-7.98-3.25-11.2-5.74-3.22-2.48-5.8-5.49-7.74-9.01-1.94-3.52-2.91-7.53-2.91-12.02,0-5.83,1.55-10.68,4.64-14.56s7.47-7.1,13.11-9.65c5.64-2.55,12.44-4.61,20.39-6.19,7.95-1.58,16.72-2.91,26.31-4v-1.64c0-7.52-1.8-12.8-5.37-15.84-3.58-3.03-7.92-4.55-13.02-4.55s-9.04,1.27-12.56,3.82c-3.52,2.55-5.4,6.55-5.64,12.01h-23.49c.48-4.85,1.82-9.31,4-13.38,2.18-4.06,5.1-7.58,8.74-10.56,3.64-2.97,8.01-5.31,13.11-7.01,5.1-1.7,10.8-2.55,17.11-2.55,5.82,0,11.29.7,16.38,2.09,5.1,1.4,9.56,3.76,13.38,7.1,3.82,3.34,6.86,7.77,9.11,13.29,2.24,5.53,3.37,12.41,3.37,20.66,0,.73-.03,2.03-.09,3.91-.06,1.88-.09,4.01-.09,6.37s-.03,4.86-.09,7.47c-.06,2.61-.09,5.01-.09,7.19,0,7.77.24,14.08.73,18.93.48,4.85,1.21,9.35,2.18,13.47h-23.12c-.36-1.58-.67-3.39-.91-5.46-.24-2.06-.48-4.3-.73-6.73ZM1228.73,958.5c-7.04.73-13.05,1.52-18.02,2.37s-9.04,1.91-12.2,3.18c-3.16,1.27-5.46,2.85-6.92,4.73-1.45,1.88-2.18,4.16-2.18,6.83,0,3.52,1.39,6.55,4.19,9.1,2.79,2.55,7.04,3.82,12.74,3.82,7.89,0,13.59-2,17.11-6.01,3.52-4,5.28-9.59,5.28-16.75v-7.28Z"/>
                                        <path className="cls-1" d="M1299.18,1003.29h-25.13v-131.99h25.13v131.99Z"/>
                                        <path className="cls-1" d="M1382.01,990.36c-2.79,4.98-6.74,8.77-11.83,11.38-5.1,2.61-10.68,3.91-16.75,3.91-11.78,0-20.21-3.39-25.31-10.19-5.1-6.8-7.65-16.2-7.65-28.22v-61.89h25.13v56.44c0,3.27.18,6.34.55,9.19.36,2.85,1.09,5.37,2.18,7.56,1.09,2.18,2.7,3.88,4.83,5.09,2.12,1.21,4.94,1.82,8.46,1.82,4.12,0,7.52-.79,10.19-2.37,2.67-1.58,4.77-3.7,6.28-6.37,1.51-2.67,2.55-5.76,3.09-9.28.55-3.52.82-7.22.82-11.11v-50.97h25.12v97.94h-25.12v-12.93Z"/>
                                        <path className="cls-1" d="M1448.28,961.23c.36,4.25,1.27,7.92,2.73,11.01,1.45,3.1,3.33,5.68,5.64,7.74,2.3,2.06,4.88,3.61,7.74,4.64,2.85,1.03,5.74,1.55,8.65,1.55,3.88,0,7.65-.82,11.29-2.46,3.64-1.64,6.74-4.58,9.29-8.83h25.85c-1.34,3.64-3.25,7.28-5.74,10.92-2.49,3.64-5.62,6.95-9.38,9.92-3.76,2.97-8.22,5.37-13.38,7.19-5.16,1.82-11.08,2.73-17.75,2.73-7.89,0-14.93-1.36-21.12-4.1-6.19-2.73-11.41-6.46-15.65-11.19-4.25-4.73-7.49-10.22-9.74-16.48-2.25-6.25-3.37-12.89-3.37-19.94s1.21-14.02,3.64-20.2c2.42-6.19,5.8-11.56,10.1-16.11,4.3-4.55,9.47-8.1,15.47-10.65,6.01-2.55,12.65-3.82,19.94-3.82s14.32,1.39,20.39,4.18c6.07,2.79,11.19,6.74,15.38,11.84,4.19,5.1,7.34,11.23,9.47,18.38,2.12,7.17,3.06,15.05,2.82,23.67h-72.28ZM1472.31,921.54c-2.43,0-4.91.4-7.46,1.18-2.55.79-4.95,2.07-7.19,3.82-2.25,1.76-4.19,4.07-5.83,6.92-1.64,2.85-2.7,6.34-3.19,10.47h46.42c-.12-4.12-.88-7.62-2.28-10.47-1.39-2.85-3.19-5.15-5.37-6.92-2.18-1.76-4.58-3.03-7.19-3.82-2.61-.79-5.25-1.18-7.92-1.18Z"/>
                                        <path className="cls-1" d="M1592.83,934.83c-.97-4.12-3.25-7.49-6.83-10.1-3.58-2.61-8.28-3.91-14.11-3.91-4.62,0-8.41.82-11.38,2.46-2.98,1.64-4.46,3.98-4.46,7.01,0,2.67,1.03,4.98,3.09,6.92,2.06,1.94,5.4,3.4,10.01,4.37l13.11,2.91c4.85,1.09,9.47,2.31,13.84,3.64,4.37,1.34,8.19,3.07,11.47,5.19,3.28,2.13,5.89,4.83,7.83,8.1,1.94,3.27,2.91,7.46,2.91,12.56s-1.18,9.41-3.55,13.29c-2.37,3.88-5.49,7.19-9.38,9.92-3.88,2.73-8.37,4.83-13.47,6.28-5.1,1.46-10.44,2.18-16.02,2.18-6.07,0-11.68-.76-16.84-2.27-5.16-1.52-9.68-3.76-13.56-6.74s-7.07-6.61-9.55-10.92c-2.49-4.31-4.04-9.25-4.65-14.84h24.22c.73,4.73,2.79,8.68,6.19,11.83,3.39,3.16,8.37,4.73,14.93,4.73,5.46,0,9.77-.97,12.93-2.91,3.15-1.94,4.73-4.67,4.73-8.19s-1.61-6.31-4.83-8.01c-3.22-1.7-6.95-3.03-11.2-4l-14.56-3.1c-4.62-.97-8.8-2.21-12.56-3.73-3.76-1.51-6.98-3.43-9.65-5.74-2.67-2.3-4.73-5.07-6.19-8.28-1.46-3.21-2.18-7.07-2.18-11.56s1.09-8.34,3.27-11.92c2.18-3.58,5.13-6.65,8.83-9.19,3.7-2.55,7.95-4.52,12.75-5.92,4.79-1.39,9.86-2.09,15.2-2.09s10.04.61,14.84,1.82c4.79,1.21,9.16,3.13,13.11,5.74,3.94,2.61,7.25,5.95,9.92,10.01,2.67,4.07,4.43,8.89,5.28,14.47h-23.49Z"/>
                                        <path className="cls-1" d="M1631.97,932.65v-27.31h26.94v27.31h-26.94ZM1631.97,1003.29v-27.31h26.94v27.31h-26.94Z"/>
                                    </g>
                                    </g>
                                </g>
                                </svg>
                        </div>
                         <div className="bg-white p-4 rounded-lg inline-block">
                            <QRCodeSVG value={joinUrl} size={256} />
                        </div>
                        <p className="text-xl text-muted-foreground mt-6">Session PIN</p>
                        <h1 className="text-3xl font-bold font-mono tracking-widest text-primary">{game.id}</h1>
                    </div>
                </div>

                {/* Right Team */}
                 <div className="w-1/4 h-3/4 flex">
                    {teamRight && <TeamDisplayCard team={teamRight} />}
                </div>
            </div>
        )
    }

    const TeamScorePod = ({ team }: { team: Team }) => (
        <div className={cn(
            "p-6 rounded-2xl bg-card/80 backdrop-blur-sm shadow-xl text-center transition-all duration-500 border-4 w-64",
             "rounded-2xl"
            )} 
            style={{ borderColor: team.color }}>
            <div className="flex items-center justify-center gap-4">
                {team.icon && <Image src={team.icon} alt={`${team.name} icon`} width={40} height={40} />}
                <h3 className="text-3xl font-display" style={{ color: team.color }}>{team.name}</h3>
            </div>
             <div className="flex items-center justify-center text-muted-foreground text-xl my-2">
                <Users className="mr-2 h-5 w-5" /> 
                <span>{team.players.length}</span>
            </div>
            <p className="text-6xl font-bold font-mono my-2">{team.score}</p>
        </div>
    );

    const renderGameInProgress = () => {
         if (!game || !game.grid) return null;
         const teamLeft = game.teams.length > 0 ? game.teams[0] : null;
         const teamRight = game.teams.length > 1 ? game.teams[1] : null;

        return (
             <div className="flex-1 w-full h-full flex items-center justify-center relative p-8">
                <div className="absolute left-4 top-4 z-10 w-48 h-24">
                    <Timer duration={game.timer} onTimeout={handleEndGame} gameStartedAt={game.gameStartedAt}/>
                </div>
                <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10">
                    {teamLeft && <TeamScorePod team={teamLeft} />}
                </div>
                <div className="w-auto h-full flex items-center justify-center">
                    <div className="w-auto h-full aspect-[1065/666] relative">
                        <HexMap grid={game.grid} teams={game.teams} onHexClick={() => {}} />
                    </div>
                </div>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10">
                    {teamRight && <TeamScorePod team={teamRight} />}
                </div>
             </div>
        )
    }
    
    const GameOverOverlay = () => {
        if (!game || game.status !== 'finished') return null;

        const sortedTeams = [...game.teams].sort((a, b) => b.score - a.score);
        const topScore = sortedTeams.length > 0 ? sortedTeams[0].score : 0;
        const winningTeams = sortedTeams.filter(t => t.score === topScore && topScore > 0);
        const isTie = winningTeams.length > 1;

        useEffect(() => {
            if (winningTeams.length > 0) {
              const duration = 5 * 1000;
              const animationEnd = Date.now() + duration;
              const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
        
              const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
        
              const interval = setInterval(() => {
                const timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) {
                  return clearInterval(interval);
                }
                const particleCount = 50 * (timeLeft / duration);
                const winnerColors = winningTeams.map(t => t.color);
                
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: winnerColors });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: winnerColors });
              }, 250);
            }
        }, [winningTeams]);

        return (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 animate-in fade-in">
                <Card className="max-w-4xl w-full text-center p-8 bg-slate-900/90">
                    <CardHeader>
                        <div className="flex justify-center items-center">
                            <Trophy className="h-16 w-16 text-yellow-400 drop-shadow-lg mr-4" />
                            <CardTitle className="text-7xl font-display text-yellow-400">
                                {winningTeams.length > 0 ? (isTie ? "It's a Tie!" : "Team Wins!") : "Game Over"}
                            </CardTitle>
                        </div>
                         {winningTeams.length > 0 && (
                            <CardDescription className="text-2xl pt-4 text-slate-200">
                                Congratulations to the Trivia Titans!
                            </CardDescription>
                        )}
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                         <div className="flex flex-wrap justify-center items-start gap-6 mt-4 w-full">
                            {winningTeams.map(team => (
                                <div key={team.name} className="p-4 bg-card rounded-lg shadow-lg border-2 flex-1 min-w-[300px]" style={{borderColor: team.color}}>
                                    <p className="text-4xl font-bold font-display" style={{color: team.color}}>{team.name}</p>
                                     <ul className="mt-4 space-y-2 text-left">
                                        {team.players.map(player => (
                                            <li key={player.id} className="text-lg bg-secondary/30 p-2 rounded-md">
                                                <span className="font-semibold">{player.name}</span>
                                                <span className="text-xs text-muted-foreground ml-2">(ID: {player.playerId})</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                         <Button size="lg" onClick={handlePlayAgain} className="min-w-[200px] h-14 text-2xl mt-12">
                            <RotateCw className="mr-4"/> Play Again
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const renderContent = () => {
        if (loading) {
            return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
        }
        if (!game) {
            return <div className="flex-1 flex items-center justify-center"><h1 className="text-4xl text-destructive">Session Not Found</h1></div>;
        }

        const renderStatus = () => {
            switch(game.status) {
                case 'lobby': return renderLobby();
                case 'starting': return <div className="flex-1 flex items-center justify-center"><h2 className="text-5xl font-display text-accent">Getting ready...</h2></div>;
                case 'playing': return renderGameInProgress();
                case 'finished': return renderGameInProgress();
                default: return <p>{game.status}</p>;
            }
        }

        return (
            <div className="w-full h-full flex flex-col relative">
                <GameOverOverlay />
                <div className="flex-1 flex flex-col justify-start min-h-0">
                    {renderStatus()}
                </div>
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex-shrink-0 z-20">
                    {game.status === 'lobby' && (
                        <Button size="lg" onClick={handleStartGame} className="min-w-[200px] h-14 text-2xl shadow-2xl">
                            <Play className="mr-4"/> Start Game
                        </Button>
                    )}
                     {game.status === 'playing' && (
                        <Button size="lg" variant="destructive" onClick={handleEndGame} className="min-w-[200px] h-14 text-2xl shadow-2xl">
                            <Square className="mr-4"/> End Game
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="w-full h-screen flex flex-col items-center overflow-hidden">
            {renderContent()}
        </div>
    );

    }

    

    