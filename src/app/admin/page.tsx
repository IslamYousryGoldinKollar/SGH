
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp, getDoc, query, where, runTransaction } from "firebase/firestore";
import { Loader2, Plus, Eye, Edit, Trash2, Copy, Users, BarChart, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import type { Game, GridSquare } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import ShareSessionModal from "@/components/admin/ShareSessionModal";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";


// A simple random PIN generator
const generatePin = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const GRID_SIZE = 22; // Based on the number of hexagons in the SVG
const STORAGE_RULES_KEY = 'storageRulesInfoDismissed';

export default function AdminDashboard() {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();
  const [sessions, setSessions] = useState<Game[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sharingSession, setSharingSession] = useState<Game | null>(null);
  const [showStorageInfo, setShowStorageInfo] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/admin/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, "games"), where("adminId", "==", user.uid));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const sessionsData: Game[] = [];
        querySnapshot.forEach((doc) => {
          sessionsData.push({ id: doc.id, ...doc.data() } as Game);
        });
        setSessions(sessionsData.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)));
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
            const initialGrid: GridSquare[] = Array.from({ length: GRID_SIZE }, (_, i) => ({
                id: i,
                coloredBy: null,
            }));

            const newGame: Omit<Game, 'id'> = {
                title: "Trivia Titans",
                description: "A live trivia game for the whole team. Join in on the fun!",
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
                sessionType: 'team',
                requiredPlayerFields: [],
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

         // This part runs after the transaction is successful
        if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_RULES_KEY)) {
            setShowStorageInfo(true);
        } else {
            if (newPin) {
                router.push(`/admin/session/${newPin}`);
            }
        }

    } catch (e) {
        console.error("Transaction failed: ", e);
        alert("Failed to create new session.");
    }
  };

  const handleDismissStorageInfo = () => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_RULES_KEY, 'true');
    }
    setShowStorageInfo(false);
    // Find the newest session to redirect to
    const newestSession = sessions.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))[0];
    if (newestSession) {
        router.push(`/admin/session/${newestSession.id}`);
    }
  }

  const deleteSession = async (gameId: string) => {
    if (window.confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "games", gameId));
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

      const originalGameData = originalGameSnap.data() as Omit<Game, 'id'>;
      let newPin;
      let newGameRef;
      let pinExists = true;

      while(pinExists) {
        newPin = generatePin();
        newGameRef = doc(db, "games", newPin);
        const gameDoc = await getDoc(newGameRef);
        pinExists = gameDoc.exists();
      }
      
      const duplicatedGame: Omit<Game, 'id'> = {
        ...originalGameData,
        status: "lobby",
        adminId: user.uid, // Belongs to the user who duplicates it
        teams: originalGameData.teams.map((team: any) => ({ ...team, score: 0, players: [] })),
        grid: Array.from({ length: GRID_SIZE }, (_, i) => ({ id: i, coloredBy: null })),
        createdAt: serverTimestamp() as any,
        gameStartedAt: null,
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

  const storageRules = `
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow public read access to assets
    match /assets/{allPaths=**} {
      allow read;
    }
    // Allow authenticated users to write to their own thumbnail folder
    match /game-thumbnails/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}`.trim();


  return (
    <>
    <ShareSessionModal session={sharingSession} onClose={() => setSharingSession(null)} />

    <AlertDialog open={showStorageInfo} onOpenChange={setShowStorageInfo}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><ShieldCheck /> Required: Update Storage Rules</AlertDialogTitle>
                <AlertDialogDescription>
                    To enable thumbnail uploads for shared sessions, you need to update your Firebase Storage security rules. This is a one-time setup.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="text-sm">
                <p className="mb-2">Please go to your Firebase project's <strong>Storage &gt; Rules</strong> tab and replace the existing content with the following:</p>
                <pre className="p-4 rounded-md bg-muted text-xs overflow-x-auto">
                    <code>
                        {storageRules}
                    </code>
                </pre>
            </div>
            <AlertDialogFooter>
                <AlertDialogAction onClick={handleDismissStorageInfo}>I've updated the rules</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

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
                                <span>{session.title || 'Trivia Titans'}</span>
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
                                    ? `${session.teams?.[0]?.players?.length || 0} participants`
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

    