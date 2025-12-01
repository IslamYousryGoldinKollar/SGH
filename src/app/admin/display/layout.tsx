
"use client";

import type { Metadata } from "next";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game } from "@/lib/types";
import { cn } from "@/lib/utils";
import Particles from "@/components/ui/particles";
import "../../globals.css";

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

  return (
    <div className="bg-background text-foreground h-screen w-screen overflow-hidden relative">
        <div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage: "url('https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2FBackground.png?alt=media&token=11c26d82-783e-40d0-aa51-5cbc533d5788')"}} />
        <Particles className="absolute inset-0" quantity={250} />
        <div className="relative z-10 h-full w-full">
            {children}
        </div>
    </div>
  );
}

    