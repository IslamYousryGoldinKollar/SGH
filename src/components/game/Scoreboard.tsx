
"use client";

import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, Star } from "lucide-react";


export default function Scoreboard({ team }: { team: Team }) {
  if (!team) return null;

  return (
    <Card className="bg-white/80 backdrop-blur-md border-white/20 shadow-lg">
        <CardHeader>
             <CardTitle className="text-xl font-bold flex items-center gap-2" style={{color: team.color}}>
                <Users className="h-5 w-5" />
                {team.name}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold" style={{color: team.color}}>{team.score}</span>
                <span className="font-semibold" style={{color: team.color}}>PTS</span>
            </div>
        </CardContent>
    </Card>
  );
}
