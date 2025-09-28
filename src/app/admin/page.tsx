
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { Loader2, Plus, Eye, Edit, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import type { Game, GridSquare } from "@/lib/types";

// A simple random PIN generator
const generatePin = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const GRID_SIZE = 22; // Based on the number of hexagons in the SVG

export default function AdminDashboard() {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();
  const [sessions, setSessions] = useState<Game[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/admin/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = collection(db, "games");
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const sessionsData: Game[] = [];
        querySnapshot.forEach((doc) => {
          sessionsData.push({ id: doc.id, ...doc.data() } as Game);
        });
        setSessions(sessionsData);
        setIsLoadingSessions(false);
      }, (error) => {
          console.error("Error fetching sessions: ", error);
          setIsLoadingSessions(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const createNewSession = async () => {
    if (!user) return;
    const newPin = generatePin();
    const gameRef = doc(db, "games", newPin);
    
    const initialGrid: GridSquare[] = Array.from({ length: GRID_SIZE }, (_, i) => ({
        id: i,
        coloredBy: null,
    }));

    // Default structure for a new game
    const newGame: Omit<Game, 'id'> = {
        title: "Trivia Titans",
        status: "lobby",
        adminId: user.uid,
        teams: [
          { name: "Team Alpha", score: 0, players: [], capacity: 10, color: "#FF6347", icon: "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fred.png?alt=media&token=8dee418c-6d1d-4558-84d2-51909b71a258" },
          { name: "Team Bravo", score: 0, players: [], capacity: 10, color: "#4682B4", icon: "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fblue.png?alt=media&token=0cd4ea1b-4005-4101-950f-a04500d708dd" },
        ],
        questions: [],
        grid: initialGrid,
        createdAt: serverTimestamp() as any,
        gameStartedAt: null,
        timer: 300, // 5 minutes default
        topic: "General Knowledge",
        theme: "team-alpha",
    };

    await setDoc(gameRef, newGame);
    router.push(`/admin/session/${newPin}`);
  };

  const deleteSession = async (gameId: string) => {
    if (window.confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "games", gameId));
            // Let onSnapshot handle the state update
        } catch (err) {
            console.error("Failed to delete session:", err);
            alert("Failed to delete session.");
        }
    }
  }

  const duplicateSession = async (gameId: string) => {
    if (!user) return;
    try {
      const originalGameRef = doc(db, "games", gameId);
      const originalGameSnap = await getDoc(originalGameRef);

      if (!originalGameSnap.exists()) {
        alert("Session to duplicate not found.");
        return;
      }

      const originalGameData = originalGameSnap.data();
      const newPin = generatePin();
      const newGameRef = doc(db, "games", newPin);
      
      const duplicatedGame: Omit<Game, 'id'> = {
        title: originalGameData.title,
        status: "lobby",
        adminId: user.uid,
        teams: originalGameData.teams.map((team: any) => ({ ...team, score: 0, players: [] })),
        questions: originalGameData.questions,
        grid: originalGameData.grid,
        createdAt: serverTimestamp() as any,
        gameStartedAt: null,
        timer: originalGameData.timer,
        topic: originalGameData.topic,
        theme: originalGameData.theme,
      };

      await setDoc(newGameRef, duplicatedGame);
      router.push(`/admin/session/${newPin}`);

    } catch (err) {
      console.error("Failed to duplicate session:", err);
      alert("Failed to duplicate session.");
    }
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold font-display">Admin Dashboard</h1>
        <Button onClick={() => auth.signOut().then(() => router.push('/'))}>Sign Out</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Session</CardTitle>
          <CardDescription>Start a new trivia game with a unique PIN.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={createNewSession}>
            <Plus className="mr-2"/>
            Create Session
          </Button>
        </CardContent>
      </Card>
      
      <div className="mt-12">
        <h2 className="text-3xl font-bold font-display mb-4">Current Sessions</h2>
        {isLoadingSessions ? (
            <Loader2 className="animate-spin"/>
        ) : sessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map(session => (
                    <Card key={session.id} className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex justify-between items-start">
                                <span>{session.title || 'Trivia Titans'}</span>
                                <span className="text-sm px-2 py-1 rounded-md bg-secondary text-secondary-foreground">{session.status}</span>
                            </CardTitle>
                            <CardDescription>
                                PIN: {session.id}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                             <p className="text-sm text-muted-foreground">
                                {session.teams?.length || 0} teams, {session.teams?.reduce((acc, t) => acc + (t.players?.length || 0), 0) || 0} players
                            </p>
                             <p className="text-xs text-muted-foreground mt-1">
                                Admin: {session.adminId ? "Assigned" : "None"}
                            </p>
                            <Button className="w-full mt-4" variant="outline" onClick={() => window.open(`/admin/display/${session.id}`, '_blank')}>
                                <Eye className="mr-2"/>
                                Open Big Screen
                            </Button>
                        </CardContent>
                         <CardFooter className="grid grid-cols-3 gap-2">
                             <Button className="w-full" variant="secondary" onClick={() => router.push(`/admin/session/${session.id}`)} disabled={session.adminId !== user.uid}>
                                 <Edit className="mr-2 h-4 w-4"/>
                                 Edit
                             </Button>
                              <Button className="w-full" variant="outline" onClick={() => duplicateSession(session.id)}>
                                 <Copy className="mr-2 h-4 w-4"/>
                                 Duplicate
                             </Button>
                             <Button className="w-full" variant="destructive" onClick={() => deleteSession(session.id)} disabled={session.adminId !== user.uid}>
                                 <Trash2 className="mr-2 h-4 w-4"/>
                                 Delete
                             </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        ) : (
            <p>No active sessions. Create one to get started!</p>
        )}
      </div>
    </div>
  );
}
