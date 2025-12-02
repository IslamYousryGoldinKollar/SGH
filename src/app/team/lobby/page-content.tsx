"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  getDoc,
} from "firebase/firestore";
import { Users, Loader2 } from "lucide-react";

interface TeamData {
  name: string;
  color: string;
  players: string[];
  score: number;
}

interface SessionData {
  team1: TeamData;
  team2: TeamData;
  status: string;
  currentQuestion: number;
}

export function TeamLobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [playerName, setPlayerName] = useState("");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinedTeam, setJoinedTeam] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = onSnapshot(
      doc(db, "team_sessions", sessionId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data() as SessionData;
          setSessionData(data);

          // If game started, redirect to quiz
          if (data.status === "playing") {
            router.push(`/team/play?session=${sessionId}&player=${encodeURIComponent(playerName)}&team=${joinedTeam}`);
          }
        }
      }
    );

    return () => unsubscribe();
  }, [sessionId, router, playerName, joinedTeam]);

  const handleJoinTeam = async (teamKey: "team1" | "team2") => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!sessionId) return;

    setJoining(true);
    setError("");

    try {
      const sessionRef = doc(db, "team_sessions", sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        setError("Session not found");
        setJoining(false);
        return;
      }

      const data = sessionDoc.data() as SessionData;
      const team = data[teamKey];

      if (team.players.length >= 10) {
        setError("This team is full (max 10 players)");
        setJoining(false);
        return;
      }

      await updateDoc(sessionRef, {
        [`${teamKey}.players`]: arrayUnion(playerName.trim()),
      });

      setJoinedTeam(teamKey);
    } catch (err) {
      console.error("Error joining team:", err);
      setError("Failed to join team");
    } finally {
      setJoining(false);
    }
  };

  if (!sessionData) {
    return (
      <div className="min-h-screen team-background flex items-center justify-center">
        <div className="water-overlay" />
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen team-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="water-overlay" />
      <div className="bubbles">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="bubble" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${4 + Math.random() * 4}s`
          }} />
        ))}
      </div>

      <div className="relative z-10 min-h-screen flex flex-col px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-700">Care Clans</h1>
          <p className="text-gray-500 text-sm">to prove your knowledge.</p>
        </div>

        {/* Join Form */}
        {!joinedTeam && (
          <div className="space-y-3 mb-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <Input
              type="text"
              placeholder="Enter your full name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="bg-white/90 border-gray-200 text-center py-6"
            />

            <Button
              onClick={() => handleJoinTeam("team1")}
              disabled={joining}
              className="w-full py-6 text-lg font-semibold"
              style={{ backgroundColor: sessionData.team1.color }}
            >
              {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : `Join ${sessionData.team1.name}`}
            </Button>

            <Button
              onClick={() => handleJoinTeam("team2")}
              disabled={joining}
              className="w-full py-6 text-lg font-semibold"
              style={{ backgroundColor: sessionData.team2.color }}
            >
              {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : `Join ${sessionData.team2.name}`}
            </Button>
          </div>
        )}

        {joinedTeam && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-center">
            <p className="text-green-700 font-medium">
              You joined {sessionData[joinedTeam as keyof Pick<SessionData, 'team1' | 'team2'>].name}!
            </p>
            <p className="text-green-600 text-sm">Waiting for the game to start...</p>
          </div>
        )}

        {/* Team Cards */}
        <div className="flex-1 space-y-4">
          {/* Team 1 */}
          <TeamCard
            team={sessionData.team1}
            teamKey="team1"
            maxPlayers={10}
          />

          {/* Team 2 */}
          <TeamCard
            team={sessionData.team2}
            teamKey="team2"
            maxPlayers={10}
          />
        </div>
      </div>

      <style jsx>{`
        .team-background {
          background: linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%);
          min-height: 100vh;
          min-height: 100dvh;
        }

        .water-overlay {
          position: fixed;
          inset: 0;
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(255, 255, 255, 0.2) 0%, transparent 50%);
          pointer-events: none;
        }

        .bubbles {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .bubble {
          position: absolute;
          bottom: -20px;
          width: 20px;
          height: 20px;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.2));
          border-radius: 50%;
          animation: rise linear infinite;
        }

        @keyframes rise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.6;
          }
          100% {
            transform: translateY(-100vh) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function TeamCard({ team, teamKey, maxPlayers }: { team: TeamData; teamKey: string; maxPlayers: number }) {
  return (
    <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-lg overflow-hidden">
      <div className="h-1" style={{ backgroundColor: team.color }} />
      <CardContent className="p-4">
        <div className="text-center mb-3">
          <h3 className="text-xl font-bold" style={{ color: team.color }}>
            {team.name}
          </h3>
          <div className="flex items-center justify-center gap-1 text-gray-500 text-sm">
            <Users className="w-4 h-4" />
            <span>{team.players.length} / {maxPlayers}</span>
          </div>
        </div>

        {/* Player Names Flag */}
        <div className="relative flex justify-center">
          <div className="flag-container">
            <div 
              className="flag-pole"
              style={{ backgroundColor: team.color }}
            />
            <div 
              className="flag-banner"
              style={{ 
                backgroundColor: team.color,
                borderColor: team.color
              }}
            >
              {team.players.length === 0 ? (
                <p className="text-white/70 text-sm italic text-center py-2">
                  No players yet...
                </p>
              ) : (
                <div className="py-2 px-3 space-y-1">
                  {team.players.slice(0, 10).map((player, idx) => (
                    <div 
                      key={idx}
                      className="text-white text-sm truncate text-center"
                    >
                      {player}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div 
              className="flag-tail"
              style={{ borderLeftColor: team.color }}
            />
          </div>

          {/* Castle Image */}
          <div className="absolute -right-4 bottom-0 w-24 h-24 opacity-80">
            <img
              src={teamKey === "team1" ? "/images/blue-castle.png" : "/images/green-castle.png"}
              alt={`${team.name} castle`}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
      </CardContent>

      <style jsx>{`
        .flag-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .flag-pole {
          width: 4px;
          height: 100%;
          position: absolute;
          left: 0;
          top: 0;
          border-radius: 2px;
        }

        .flag-banner {
          margin-left: 4px;
          min-width: 150px;
          max-width: 200px;
          border-radius: 0 4px 4px 0;
          min-height: 60px;
        }

        .flag-tail {
          position: absolute;
          bottom: -8px;
          left: 4px;
          width: 0;
          height: 0;
          border-left: 75px solid;
          border-top: 8px solid transparent;
          border-bottom: 8px solid transparent;
        }
      `}</style>
    </Card>
  );
}
