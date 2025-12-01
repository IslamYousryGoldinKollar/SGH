
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Game, GameTheme } from "@/lib/types";
import { cn } from "@/lib/utils";
import "../../dynamic-theme.css";

function hexToHsl(hex: string): string {
    if (!hex) return "0 0% 0%";
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "0 0% 0%";
    
    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);
    
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}


export default function GameLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const params = useParams();
  const gameId = params.gameId as string;
  const [theme, setTheme] = useState<GameTheme>('default');
  const [dynamicStyle, setDynamicStyle] = useState<React.CSSProperties>({});
  const [themeClass, setThemeClass] = useState('');

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
        if (typeof theme === 'object' && theme?.background) {
            setDynamicStyle({
                '--dynamic-background-hsl': hexToHsl(theme.background),
                '--dynamic-card-hsl': hexToHsl(theme.card),
                '--dynamic-accent-hsl': hexToHsl(theme.accent),
                '--dynamic-foreground-hsl': hexToHsl(theme.foreground),
                '--dynamic-card-foreground-hsl': hexToHsl(theme.cardForeground),
            } as React.CSSProperties);
            setThemeClass('dynamic-theme');
            document.documentElement.removeAttribute('data-theme');
        } else if (typeof theme === 'string') {
            setDynamicStyle({});
            setThemeClass('');
            document.documentElement.setAttribute('data-theme', theme);
        } else {
            setDynamicStyle({});
            setThemeClass('');
            document.documentElement.removeAttribute('data-theme');
        }
    }, [theme]);

  return (
    <div 
        className={cn(
            "flex flex-col min-h-screen bg-background text-foreground",
            themeClass
        )}
        style={dynamicStyle}
    >
      {children}
    </div>
  );
}

    