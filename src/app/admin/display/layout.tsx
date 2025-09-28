
"use client";

import type { Metadata } from "next";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game } from "@/lib/types";
import { cn } from "@/lib/utils";
import Particles from "@/components/ui/particles";

// Note: We can't export metadata from a client component. 
// This should be handled in a parent server component if needed.
// export const metadata: Metadata = {
//   title: "Trivia Titans - Big Screen",
//   description: "Live game display for Trivia Titans",
// };

export default function DisplayLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    const params = useParams();
    const gameId = params.gameId as string;
    const [theme, setTheme] = useState<Game['theme']>('default');

    useEffect(() => {
        if (!gameId) return;
        const gameRef = doc(db, "games", gameId.toUpperCase());
        const unsubscribe = onSnapshot(gameRef, (doc) => {
            if (doc.exists()) {
                const gameData = doc.data() as Game;
                setTheme(gameData.theme || 'default');
            }
        });
        return () => unsubscribe();
    }, [gameId]);

    useEffect(() => {
        if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }, [theme]);

  return (
    <div className={cn(
        "bg-transparent text-foreground h-screen w-screen overflow-hidden"
        )}>
        <Particles className="absolute inset-0 -z-10" quantity={150} />
        {children}
    </div>
  );
}
