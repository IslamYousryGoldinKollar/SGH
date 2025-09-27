
"use client";

import type { Metadata } from "next";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game } from "@/lib/types";
import { cn } from "@/lib/utils";

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
        "bg-background text-foreground h-screen w-screen overflow-hidden",
        "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-200/50 to-green-400/50"
        )}>
        <div className="h-full w-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%232c7a3f%22%20fill-opacity%3D%220.1%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')]">
            {children}
        </div>
    </div>
  );
}
