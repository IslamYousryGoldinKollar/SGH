
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
        <video 
            autoPlay
            loop
            muted
            playsInline
            className="absolute top-0 left-0 w-full h-full object-cover z-0"
        >
          <source 
            src="https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Floop-1.mp4?alt=media&token=5fc4b71c-bf5b-4c47-ba8e-ee6647cfab5a"
            type="video/mp4"
          />
        </video>
        <div className="absolute inset-0 bg-black/30 z-10" />
        <Particles className="absolute inset-0 z-20" quantity={250} />
        <div className="relative z-30 h-full w-full">
            {children}
        </div>
    </div>
  );
}
