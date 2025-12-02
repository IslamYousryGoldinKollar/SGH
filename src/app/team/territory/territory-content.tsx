"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface HexTile {
  id: number;
  claimed: boolean;
  teamColor?: string;
}

export default function TerritoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const credits = parseInt(searchParams.get("credits") || "1");

  const [hexTiles, setHexTiles] = useState<HexTile[]>(
    Array.from({ length: 19 }, (_, i) => ({
      id: i,
      claimed: i === 9, // Center tile claimed
      teamColor: i === 9 ? "#22d3ee" : undefined,
    }))
  );
  const [remainingCredits, setRemainingCredits] = useState(credits);

  const handleClaimHex = (hexId: number) => {
    if (remainingCredits <= 0) return;

    setHexTiles((prev) =>
      prev.map((hex) =>
        hex.id === hexId && !hex.claimed
          ? { ...hex, claimed: true, teamColor: "#22d3ee" }
          : hex
      )
    );
    setRemainingCredits((prev) => prev - 1);
  };

  const handleSkip = () => {
    router.push(`/team/play?session=${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm py-4 px-6 text-center">
        <h1 className="text-2xl font-bold text-cyan-600">Claim Your Territory!</h1>
        <p className="text-gray-600 text-sm mt-1">
          You have {remainingCredits} credit{remainingCredits !== 1 ? "s" : ""}. Tap a hex to claim it.
        </p>
        <Button
          variant="link"
          onClick={handleSkip}
          className="text-gray-500 mt-2"
        >
          Skip and answer next question
        </Button>
      </div>

      {/* Island Map */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative">
          {/* Island background image */}
          <img
            src="/images/island-map.png"
            alt="Island"
            className="w-80 h-80 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />

          {/* Hex grid overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="hex-grid">
              {hexTiles.map((hex) => (
                <button
                  key={hex.id}
                  onClick={() => handleClaimHex(hex.id)}
                  disabled={hex.claimed || remainingCredits <= 0}
                  className={`hex-tile ${hex.claimed ? "claimed" : "available"}`}
                  style={{
                    backgroundColor: hex.claimed
                      ? hex.teamColor
                      : "rgba(255, 255, 255, 0.3)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hex-grid {
          display: grid;
          grid-template-columns: repeat(5, 40px);
          gap: 4px;
        }

        .hex-tile {
          width: 40px;
          height: 46px;
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          border: 2px solid rgba(255, 255, 255, 0.5);
          transition: all 0.2s;
        }

        .hex-tile.available:hover {
          background-color: rgba(34, 211, 238, 0.5) !important;
          transform: scale(1.1);
        }

        .hex-tile.claimed {
          cursor: default;
        }

        .hex-tile.available {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
