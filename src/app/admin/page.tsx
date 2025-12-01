
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp, getDoc, query, where, runTransaction } from "firebase/firestore";
import { Loader2, Plus, Eye, Edit, Trash2, Copy, Users, BarChart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import type { Game, GridSquare } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import ShareSessionModal from "@/components/admin/ShareSessionModal";
import { Badge } from "@/components/ui/badge";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";


// A simple random PIN generator
const generatePin = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const TEAM_GRID_SIZE = 22;

export default function AdminDashboard() {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();
  const [sessions, setSessions] = useState<Game[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sharingSession, setSharingSession] = useState<Game | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/admin/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, "games"), where("adminId", "==", user.uid), where("parentSessionId", "==", null));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const sessionsData: Game[] = [];
        querySnapshot.forEach((doc) => {
          sessionsData.push({ id: doc.id, ...doc.data() } as Game);
        });
        setSessions(sessionsData.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)));
        setIsLoadingSessions(false);
      }, (error) => {
          const permissionError = new FirestorePermissionError({
            path: q.path,
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
          setIsLoadingSessions(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const createNewSession = async () => {
    if (!user) return;
    
    let newPin: string | undefined;
    try {
        await runTransaction(db, async (transaction) => {
            let gameRef;
            let pinExists = true;

            // Loop to ensure the PIN is unique
            while (pinExists) {
                newPin = generatePin();
                gameRef = doc(db, "games", newPin);
                const gameDoc = await transaction.get(gameRef);
                pinExists = gameDoc.exists();
            }
            if (!gameRef) throw new Error("Failed to generate a unique session PIN.");


            const adminRef = doc(db, "admins", user.uid);

            // 1. All READS must happen before any writes.
            const adminDoc = await transaction.get(adminRef);

            // 2. Prepare all data and logic.
            const initialGrid: GridSquare[] = Array.from({ length: TEAM_GRID_SIZE }, (_, i) => ({
                id: i,
                coloredBy: null,
            }));

            const newGame: Omit<Game, 'id'> = {
                title: "Care Clans",
                description: "A live trivia game for the whole team. Join in on the fun!",
                status: "lobby",
                adminId: user.uid,
                teams: [
                  { name: "Team Alpha", score: 0, players: [], capacity: 10, color: "#34D399", icon: "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fgreen%20tower%20copy.png?alt=media&token=fab0d082-5590-4fd7-9d69-a63c101471de" },
                  { name: "Team Bravo", score: 0, players: [], capacity: 10, color: "#60A5FA", icon: "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fblue%20tower%20copy2.png?alt=media&token=81f82f6a-2644-4159-9c08-2d0f3a037f9e" },
                ],
                questions: [],
                grid: initialGrid,
                createdAt: serverTimestamp() as any,
                gameStartedAt: null,
                timer: 300, // 5 minutes default
                topic: "General Knowledge",
                sessionType: 'team',
                requiredPlayerFields: [],
                parentSessionId: null,
            };

            // 3. Now, perform all WRITES.
            transaction.set(gameRef, newGame);

            if (!adminDoc.exists()) {
                transaction.set(adminRef, {
                    uid: user.uid,
                    email: user.email,
                    createdAt: serverTimestamp(),
                    plan: 'basic',
                    sessionCount: 1,
                });
            } else {
                transaction.update(adminRef, {
                    sessionCount: (adminDoc.data().sessionCount || 0) + 1,
                });
            }
            
        });

        if (newPin) {
            router.push(`/admin/session/${newPin}`);
        }

    } catch (e) {
        console.error("Transaction failed: ", e);
        const gameRef = doc(db, "games", newPin || 'unknown');
        const permissionError = new FirestorePermissionError({
          path: gameRef.path,
          operation: 'write',
        });
        errorEmitter.emit('permission-error', permissionError);
        alert("Failed to create new session.");
    }
  };

  const deleteSession = async (gameId: string) => {
    if (window.confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
        const gameRef = doc(db, "games", gameId);
        await deleteDoc(gameRef).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: gameRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
            alert("Failed to delete session.");
        });
    }
  }

  const duplicateSession = async (gameId: string) => {
    if (!user) return;
    const originalGameRef = doc(db, "games", gameId);
    let newGameRef;
    try {
      const originalGameSnap = await getDoc(originalGameRef);

      if (!originalGameSnap.exists()) {
        alert("Session to duplicate not found.");
        return;
      }

      const originalGameData = originalGameSnap.data() as Omit<Game, 'id'>;
      let newPin;
      let pinExists = true;

      while(pinExists) {
        newPin = generatePin();
        newGameRef = doc(db, "games", newPin);
        const gameDoc = await getDoc(newGameRef);
        pinExists = gameDoc.exists();
      }
      
      const newGrid: GridSquare[] = Array.from({ length: TEAM_GRID_SIZE }, (_, i) => ({ id: i, coloredBy: null }));

      const duplicatedGame: Omit<Game, 'id'> = {
        ...originalGameData,
        status: "lobby",
        adminId: user.uid, // Belongs to the user who duplicates it
        teams: originalGameData.teams.map((team: any) => ({ ...team, score: 0, players: [] })),
        grid: newGrid,
        createdAt: serverTimestamp() as any,
        gameStartedAt: null,
      };

      await setDoc(newGameRef, duplicatedGame);
      router.push(`/admin/session/${newPin}`);

    } catch (err) {
      console.error("Failed to duplicate session:", err);
      if (newGameRef) {
        const permissionError = new FirestorePermissionError({
            path: newGameRef.path,
            operation: 'create',
        });
        errorEmitter.emit('permission-error', permissionError);
      }
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
    <>
    <ShareSessionModal session={sharingSession} onClose={() => setSharingSession(null)} />

    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold font-display">Admin Dashboard</h1>
        <Button onClick={() => auth.signOut().then(() => router.push('/'))}>Sign Out</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Session</CardTitle>
          <CardDescription>Start a new game with a unique PIN.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={createNewSession}>
            <Plus className="mr-2"/>
            Create Session
          </Button>
        </CardContent>
      </Card>
      
      <div className="mt-12">
        <h2 className="text-3xl font-bold font-display mb-4">Your Sessions</h2>
        {isLoadingSessions ? (
            <Loader2 className="animate-spin"/>
        ) : sessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map(session => {
                  const isOwner = session.adminId === user.uid;
                  const isIndividual = session.sessionType === 'individual';
                  return (
                    <Card key={session.id} className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex justify-between items-start">
                                <span>{session.title || 'Care Clans'}</span>
                                 <Badge variant="secondary" className="capitalize">{session.sessionType || 'team'}</Badge>
                            </CardTitle>
                            <CardDescription>
                                PIN: {session.id}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                             <p className="text-sm text-muted-foreground flex items-center">
                                <Users className="mr-2 h-4 w-4"/>
                                {isIndividual 
                                    ? `Leaderboard Only`
                                    : `${session.teams?.reduce((acc, t) => acc + (t.players?.length || 0), 0) || 0} players`
                                }
                            </p>
                            {isIndividual ? (
                                 <Button className="w-full mt-4" variant="outline" onClick={() => router.push(`/leaderboard/${session.id}`)}>
                                    <BarChart className="mr-2 h-4 w-4"/>
                                    View Leaderboard
                                </Button>
                            ) : (
                                <Button className="w-full mt-4" variant="outline" onClick={() => window.open(`/admin/display/${session.id}`, '_blank')}>
                                    <Eye className="mr-2"/>
                                    Open Big Screen
                                </Button>
                            )}
                        </CardContent>
                         <CardFooter className="grid grid-cols-2 gap-2">
                             <Button className="w-full" variant="secondary" onClick={() => router.push(`/admin/session/${session.id}`)} disabled={!isOwner}>
                                 <Edit className="mr-2 h-4 w-4"/>
                                 Edit
                             </Button>
                             <Button className="w-full" variant="default" onClick={() => setSharingSession(session)}>
                                 <Share2 className="mr-2 h-4 w-4"/>
                                 Share
                             </Button>
                             <Button className="w-full" variant="outline" onClick={() => duplicateSession(session.id)}>
                                 <Copy className="mr-2 h-4 w-4"/>
                                 Duplicate
                             </Button>
                             <Button className="w-full" variant="destructive" onClick={() => deleteSession(session.id)} disabled={!isOwner}>
                                 <Trash2 className="mr-2 h-4 w-4"/>
                                 Delete
                             </Button>
                        </CardFooter>
                    </Card>
                  )
                })}
            </div>
        ) : (
            <p>No active sessions. Create one to get started!</p>
        )}
      </div>
    </div>
    </>
  );
}

    
