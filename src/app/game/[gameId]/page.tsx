
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Player, Question, Game, Team, GridSquare, MatchmakingTicket } from "@/lib/types";
import { generateQuestionsAction } from "@/lib/actions";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  getDoc,
  serverTimestamp,
  runTransaction,
  collection,
  addDoc,
  Timestamp,
  query,
  where,
  limit,
  writeBatch,
} from "firebase/firestore";
import {
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import Lobby from "@/components/game/Lobby";
import GameScreen from "@/components/game/GameScreen";
import ColorGridScreen from "@/components/game/ColorGridScreen";
import ResultsScreen from "@/components/game/ResultsScreen";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { v4 as uuidv4 } from 'uuid';

// A simple random PIN generator
const generatePin = () => Math.random().toString(36).substring(2, 6).toUpperCase();

const IndividualLobby = ({ game, onJoin }: { game: Game, onJoin: (formData: Record<string, string>) => void }) => {
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const allFieldsFilled = game.requiredPlayerFields.every(field => formData[field.id] && formData[field.id].trim() !== '');
        if (!allFieldsFilled) {
            setError('Please fill out all fields.');
            return;
        }
        setError('');
        onJoin(formData);
    }

    const handleChange = (fieldId: string, value: string) => {
        setFormData(prev => ({...prev, [fieldId]: value}));
    }

    return (
        <div className="flex flex-col items-center justify-center flex-1">
            <div className="text-center">
                <h1 className="text-5xl font-bold font-display">{game.title}</h1>
                <p className="text-muted-foreground mt-2 max-w-xl">Enter your details to start the challenge. You will have {Math.floor(game.timer / 60)} minutes to answer questions and capture territory.</p>
            </div>

            <Card className="my-8 w-full max-w-md">
                <CardHeader>
                    <CardTitle>Your Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {game.requiredPlayerFields.map(field => (
                            <div key={field.id} className="space-y-2">
                                <Label htmlFor={field.id}>{field.label}</Label>
                                <Input
                                    id={field.id}
                                    type={field.type}
                                    value={formData[field.id] || ''}
                                    onChange={(e) => handleChange(field.id, e.target.value)}
                                    required
                                    className="text-lg p-6 w-full"
                                />
                            </div>
                        ))}
                        {error && <p className="text-destructive text-sm">{error}</p>}
                        <Button type="submit" size="lg" className="w-full">
                            Start Challenge
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

const MatchmakingLobby = ({ onJoinQueue, isJoining, onCancel, ticket }: { onJoinQueue: (name: string, id:string) => void, isJoining: boolean, onCancel: () => void, ticket: MatchmakingTicket | null }) => {
    const [playerName, setPlayerName] = useState("");
    const [idNumber, setIdNumber] = useState("");

    const handleJoin = () => {
        if (!playerName.trim() || !idNumber.trim()) {
            alert("Please enter your name and ID.");
            return;
        }
        onJoinQueue(playerName.trim(), idNumber.trim());
    }

    if (ticket && ticket.status === 'waiting') {
        return (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <h1 className="text-4xl font-bold mt-4 font-display">Waiting for an opponent...</h1>
                <p className="text-muted-foreground mt-2">You are in the queue, {ticket.playerName}. A match will begin automatically.</p>
                <Button variant="outline" className="mt-8" onClick={onCancel}>Cancel</Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center flex-1">
            <div className="text-center">
                <Swords className="h-16 w-16 text-primary mx-auto mb-4" />
                <h1 className="text-5xl font-bold font-display">1v1 Matchmaking</h1>
                <p className="text-muted-foreground mt-2 max-w-xl">Enter your name and ID to find a worthy opponent. The battle begins soon!</p>
            </div>
             <div className="my-8 w-full max-w-md space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="playerName" className="sr-only">Full Name</Label>
                    <Input id="playerName" type="text" placeholder="Enter your full name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="text-lg p-6 w-full text-center" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="idNumber" className="sr-only">ID Number</Label>
                    <Input id="idNumber" type="text" placeholder="Enter your ID number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="text-lg p-6 w-full text-center" />
                </div>
                <Button size="lg" className="w-full" onClick={handleJoin} disabled={isJoining || !playerName.trim() || !idNumber.trim()}>
                    {isJoining ? <Loader2 className="animate-spin" /> : "Find Match"}
                </Button>
            </div>
        </div>
    )
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const GAME_ID = (params.gameId as string).toUpperCase();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [view, setView] = useState<"question" | "grid">("question");
  const [ticket, setTicket] = useState<MatchmakingTicket | null>(null);
  const [isJoining, setIsJoining] = useState(false);


  useEffect(() => {
    if (game?.theme) {
      document.documentElement.setAttribute("data-theme", game.theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [game?.theme]);

  // Authenticate user
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthUser(user);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in error", error);
          toast({
            title: "Authentication Error",
            description: "Could not sign in.",
            variant: "destructive",
          });
        });
      }
    });
    return () => unsubAuth();
  }, [toast]);

  // Listen to game document and player state
  useEffect(() => {
    if (!GAME_ID || !authUser) return;
    const gameRef = doc(db, "games", GAME_ID);

    const unsubGame = onSnapshot(gameRef, (docSnap) => {
      setLoading(true);
      if (docSnap.exists()) {
        const gameData = { id: docSnap.id, ...docSnap.data() } as Game;
        setGame(gameData);
        
        const isUserAdmin = gameData.adminId === authUser.uid;
        setIsAdmin(isUserAdmin);
        
        const player = gameData.teams?.flatMap((t) => t.players).find((p) => p.id === authUser.uid) || null;
        setCurrentPlayer(player);

      } else {
        toast({
          title: "Game not found",
          description: "This game session does not exist.",
          variant: "destructive",
        });
        setGame(null);
        setCurrentPlayer(null);
      }
      setLoading(false);
    });

    return () => unsubGame();
  }, [GAME_ID, authUser, toast]);

    // Matchmaking Logic
    useEffect(() => {
        if (!game || game.sessionType !== 'matchmaking' || !authUser) return;

        // Listen to player's own ticket
        const ticketRef = doc(db, "matchmakingTickets", authUser.uid);
        const unsubTicket = onSnapshot(ticketRef, (docSnap) => {
            if (docSnap.exists()) {
                const ticketData = docSnap.data() as MatchmakingTicket;
                setTicket(ticketData);
                if (ticketData.status === 'matched' && ticketData.gameId) {
                    router.replace(`/game/${ticketData.gameId}`);
                }
            } else {
                setTicket(null);
            }
        });

        // Trigger matchmaking logic if we are an admin (for simulation)
        if(isAdmin) {
            const q = query(
                collection(db, "matchmakingTickets"),
                where("status", "==", "waiting"),
                where("matchmakingSessionId", "==", game.id),
                limit(2)
            );
            const unsubQueue = onSnapshot(q, async (snapshot) => {
                if (snapshot.docs.length >= 2) {
                    const player1Ticket = snapshot.docs[0].data() as MatchmakingTicket;
                    const player2Ticket = snapshot.docs[1].data() as MatchmakingTicket;
                    
                    const batch = writeBatch(db);
                    
                    // Create new private game
                    const newGameId = generatePin();
                    const newGameRef = doc(db, "games", newGameId);
                    
                    const newGame: Omit<Game, 'id'> = {
                        ...game,
                        id: newGameId,
                        title: `1v1: ${player1Ticket.playerName} vs ${player2Ticket.playerName}`,
                        status: "playing",
                        sessionType: "team", // Treat it as a team game for UI purposes
                        teams: [
                            { name: player1Ticket.playerName, score: 0, players: [{id: player1Ticket.playerId, playerId: player1Ticket.playerId, name: player1Ticket.playerName, teamName: player1Ticket.playerName, answeredQuestions: [], coloringCredits: 0, score: 0 }], capacity: 1, color: "#FF6347", icon: "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fred.png?alt=media&token=8dee418c-6d1d-4558-84d2-51909b71a258" },
                            { name: player2Ticket.playerName, score: 0, players: [{id: player2Ticket.playerId, playerId: player2Ticket.playerId, name: player2Ticket.playerName, teamName: player2Ticket.playerName, answeredQuestions: [], coloringCredits: 0, score: 0 }], capacity: 1, color: "#4682B4", icon: "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fblue.png?alt=media&token=0cd4ea1b-4005-4101-950f-a04500d708dd" },
                        ],
                        gameStartedAt: serverTimestamp(),
                    };
                    batch.set(newGameRef, newGame);

                    // Update tickets
                    batch.update(doc(db, "matchmakingTickets", player1Ticket.playerId), { status: 'matched', gameId: newGameId });
                    batch.update(doc(db, "matchmakingTickets", player2Ticket.playerId), { status: 'matched', gameId: newGameId });
                    
                    await batch.commit();
                }
            });
             return () => unsubQueue();
        }

        return () => unsubTicket();

    }, [game, authUser, isAdmin, router]);

  const handleJoinQueue = async (playerName: string, playerId: string) => {
      if (!game || !authUser) return;
      setIsJoining(true);
      try {
          const ticketRef = doc(db, "matchmakingTickets", authUser.uid);
          const newTicket: MatchmakingTicket = {
              id: authUser.uid,
              playerId: authUser.uid,
              playerName: playerName,
              status: 'waiting',
              createdAt: serverTimestamp() as Timestamp,
              matchmakingSessionId: game.id,
          };
          await setDoc(ticketRef, newTicket);
      } catch (error) {
          console.error("Error joining queue:", error);
          toast({ title: "Error", description: "Could not join the matchmaking queue.", variant: "destructive" });
      } finally {
          setIsJoining(false);
      }
  };

  const handleCancelQueue = async () => {
    if(!authUser) return;
    const ticketRef = doc(db, "matchmakingTickets", authUser.uid);
    await deleteDoc(ticketRef);
  }

  // Handler for team mode
  const handleJoinTeam = async (playerName: string, playerId: string, teamName: string) => {
    if (!playerName.trim()) { toast({ title: "Invalid Name", description: "Please enter your name.", variant: "destructive" }); return; }
    if (!game || !authUser) return;

    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, "games", GAME_ID);
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game does not exist!");
        const currentGame = gameDoc.data() as Game;

        if (currentGame.sessionType !== 'team') throw new Error("This is not a team game.");

        const isAlreadyInAnyTeam = currentGame.teams.some((t) => t.players.some((p) => p.id === authUser.uid));
        if (isAlreadyInAnyTeam) { toast({ title: "Already in a team", description: "You have already joined a team.", variant: "destructive" }); return; }
        
        const teamIndex = currentGame.teams.findIndex((t) => t.name === teamName);
        if (teamIndex === -1) throw new Error("Team not found!");
        if (currentGame.teams[teamIndex].players.length >= currentGame.teams[teamIndex].capacity) throw new Error(`Sorry, ${teamName} is full.`);

        const newPlayer: Player = { id: authUser.uid, playerId, name: playerName, teamName, answeredQuestions: [], coloringCredits: 0, score: 0 };
        const updatedTeams = [...currentGame.teams];
        updatedTeams[teamIndex].players.push(newPlayer);
        transaction.update(gameRef, { teams: updatedTeams });
      });
    } catch (error: any) {
      console.error("Error joining team: ", error);
      toast({ title: "Could Not Join", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  };

  // Handler for individual mode
  const handleJoinIndividual = async (customData: Record<string, string>) => {
      if (!game || !authUser) return;

      try {
          await runTransaction(db, async (transaction) => {
              const gameRef = doc(db, "games", GAME_ID);
              const gameDoc = await transaction.get(gameRef);
              if (!gameDoc.exists()) throw new Error("Game does not exist!");
              const currentGame = gameDoc.data() as Game;

              if (currentGame.sessionType !== 'individual') throw new Error("This is an individual challenge.");

              const isAlreadyPlaying = currentGame.teams?.[0]?.players.some(p => p.id === authUser.uid);
              if (isAlreadyPlaying) {
                  toast({ title: "Already Joined", description: "You have already started this challenge.", variant: "destructive" });
                  return;
              }
              
              const newPlayer: Player = {
                  id: authUser.uid,
                  playerId: customData['ID Number'] || uuidv4(), // Use a default or specific field
                  name: customData['Full Name'] || 'Anonymous', // Use a default or specific field
                  teamName: "Participants",
                  answeredQuestions: [],
                  coloringCredits: 0,
                  score: 0,
                  customData: customData,
                  gameStartedAt: serverTimestamp() as Timestamp,
              };

              const updatedTeams = currentGame.teams?.[0] ? [...currentGame.teams] : [{ name: "Participants", score: 0, players: [], capacity: 999, color: '#888888', icon: '' }];
              updatedTeams[0].players.push(newPlayer);

              transaction.update(gameRef, { teams: updatedTeams });
          });
      } catch (error: any) {
          console.error("Error joining individual challenge: ", error);
          toast({ title: "Could Not Join", description: error.message || "An unexpected error occurred.", variant: "destructive" });
      }
  }


  const handleStartGame = async () => {
    if (!game || !isAdmin) { toast({ title: "Not Authorized", description: "Only the admin can start.", variant: "destructive" }); return; }
    if (game.teams.reduce((sum, t) => sum + t.players.length, 0) === 0) { toast({ title: "No players!", description: "At least one player must join.", variant: "destructive" }); return; }
    
    const gameRef = doc(db, "games", GAME_ID);
    await updateDoc(gameRef, { status: "starting" });

    try {
      let questionsToUse: Question[] = game.questions || [];
      if (questionsToUse.length === 0) {
        const result = await generateQuestionsAction({ topic: game.topic || "General Knowledge", numberOfQuestions: 20 });
        if (result.questions) { questionsToUse = result.questions; } else { throw new Error("AI failed to generate questions."); }
      }
      await updateDoc(gameRef, { questions: questionsToUse, status: "playing", gameStartedAt: serverTimestamp() });
    } catch (error) {
      console.error(error);
      toast({ title: "Error Starting Game", description: "Could not prepare questions.", variant: "destructive" });
      await updateDoc(gameRef, { status: "lobby" });
    }
  };
  
  const getNextQuestion = useCallback(() => {
    if (!game || !currentPlayer) return null;
    const answered = currentPlayer.answeredQuestions || [];
    const availableQuestions = game.questions.filter((q) => !answered.includes(q.question));
    if (availableQuestions.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    return availableQuestions[randomIndex];
  }, [game, currentPlayer]);

  useEffect(() => {
    if (!game || !currentPlayer) return;
    
    if(game.status !== "playing") return;
    
    // Logic for individual mode (check timer)
    if(game.sessionType === 'individual') {
      const playerStartTime = currentPlayer.gameStartedAt?.toMillis();
      if (!playerStartTime) return; // Not started yet
      const endTime = playerStartTime + game.timer * 1000;
      if(Date.now() > endTime) {
          // Player's time is up, but don't change game status, just UI
          return;
      }
    }

    if (currentPlayer.coloringCredits > 0) {
      setView("grid");
    } else {
      if (!currentQuestion) setCurrentQuestion(getNextQuestion());
      setView("question");
    }
  }, [game, currentPlayer, currentQuestion, getNextQuestion]);

  const handleAnswer = async (question: Question, answer: string) => {
    if (!game || !currentPlayer) return;
    const isCorrect = question.answer.trim().toLowerCase() === answer.trim().toLowerCase();
    
    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, "games", GAME_ID);
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game does not exist!");
        const currentGame = gameDoc.data() as Game;

        const teamIndex = currentGame.teams.findIndex((t) => t.name === currentPlayer.teamName);
        if (teamIndex === -1) return;
        const playerIndex = currentGame.teams[teamIndex].players.findIndex((p) => p.id === currentPlayer.id);
        if (playerIndex === -1) return;

        const updatedTeams = [...currentGame.teams];
        const playerToUpdate = updatedTeams[teamIndex].players[playerIndex];
        const teamToUpdate = updatedTeams[teamIndex];

        playerToUpdate.answeredQuestions = [...(playerToUpdate.answeredQuestions || []), question.question];
        if (isCorrect) {
          playerToUpdate.coloringCredits += 1;
          playerToUpdate.score += 1;
          teamToUpdate.score += 1; // In individual mode, team score is the sum of all player scores
        }
        transaction.update(gameRef, { teams: updatedTeams });
      });
    } catch (error) {
        console.error("Error handling answer:", error);
    }
  };

  const handleNextQuestion = () => setCurrentQuestion(getNextQuestion());

  const handleColorSquare = async (squareId: number) => {
    if (!game || !currentPlayer) return;
    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, "games", GAME_ID);
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game does not exist!");
        let currentGame = gameDoc.data() as Game;
        
        const playerTeamIndex = currentGame.teams.findIndex(t => t.name === currentPlayer.teamName);
        if(playerTeamIndex === -1) throw new Error("Could not find player's team.");
        const playerIndex = currentGame.teams[playerTeamIndex].players.findIndex(p => p.id === currentPlayer.id);
        if (playerIndex === -1) throw new Error("Could not find player data.");
        
        let currentGrid = currentGame.grid;
        
        const playerToUpdate = currentGame.teams[playerTeamIndex].players[playerIndex];
        if (playerToUpdate.coloringCredits <= 0) throw new Error("You have no coloring credits.");
        
        const squareIndex = currentGrid.findIndex((s) => s.id === squareId);
        if (squareIndex === -1) throw new Error("Square not found.");
        
        const originalOwnerName = currentGrid[squareIndex].coloredBy;
        const coloredByName = game.sessionType === 'individual' ? playerToUpdate.id : currentPlayer.teamName;

        if (originalOwnerName === coloredByName) return;

        playerToUpdate.coloringCredits -= 1;
        playerToUpdate.score += 1;
        currentGame.teams[playerTeamIndex].score += 1;

        if (originalOwnerName) { // A square is being captured
            const originalOwnerTeamIndex = currentGame.teams.findIndex(t => t.name === originalOwnerName);
            if (originalOwnerTeamIndex !== -1) {
                currentGame.teams[originalOwnerTeamIndex].score = Math.max(0, currentGame.teams[originalOwnerTeamIndex].score - 1);
            }
        }
        
        currentGrid[squareIndex].coloredBy = coloredByName;

        const isGridFull = currentGrid.every((s) => s.coloredBy !== null);
        
        transaction.update(gameRef, {
          grid: currentGrid,
          teams: currentGame.teams,
          status: isGridFull ? "finished" : currentGame.status,
        });
      });
      setCurrentQuestion(getNextQuestion());
    } catch (error: any) {
      console.error("Failed to color square: ", error);
      toast({ title: "Error Coloring Square", description: error.message, variant: "destructive" });
    }
  };

  const handleTimeout = async () => {
    if (game?.status === "playing" && isAdmin) {
      await updateDoc(doc(db, "games", GAME_ID), { status: "finished" });
      toast({ title: "Time's Up!", description: `The game timer has expired.` });
    }
    // For individual mode, timeout is handled client-side to show results.
  };

  const handleSkipColoring = () => {
    setCurrentQuestion(getNextQuestion());
    setView("question");
  };

  const renderContent = () => {
    if (loading || !authUser || !game) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <h1 className="mt-4 text-4xl font-bold font-display">Loading Session...</h1>
        </div>
      );
    }
    
    if (game.sessionType === 'matchmaking' && game.status === 'lobby') {
        return <MatchmakingLobby onJoinQueue={handleJoinQueue} isJoining={isJoining} onCancel={handleCancelQueue} ticket={ticket} />;
    }

    if (game.sessionType === 'individual') {
        if (!currentPlayer) {
            return <IndividualLobby game={game} onJoin={handleJoinIndividual} />;
        }
        
        const playerStartTime = currentPlayer.gameStartedAt?.toMillis();
        const isTimeUp = playerStartTime && (Date.now() > playerStartTime + game.timer * 1000);
        const isGridFull = game.grid.every(s => s.coloredBy !== null);

        if (isTimeUp || isGridFull) {
             return <ResultsScreen teams={game.teams} isAdmin={false} onPlayAgain={() => {}} individualPlayerId={currentPlayer.id}/>;
        }

        const playerTeam = game.teams.find(t => t.name === currentPlayer?.teamName);
        if (!playerTeam) return <p>Error: Player data could not be found.</p>;

        if (view === "grid") {
            return <ColorGridScreen grid={game.grid} teams={game.teams} onColorSquare={handleColorSquare} teamColoring={playerTeam.color} credits={currentPlayer.coloringCredits} onSkip={handleSkipColoring} sessionType='individual'/>;
        }

        if (!currentQuestion) {
            return (
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                    <h1 className="text-4xl font-bold font-display">You've answered all available questions!</h1>
                    <p className="mt-2 text-muted-foreground">Great job! See your final score when time is up.</p>
                </div>
            );
        }

        return <GameScreen teams={game.teams} currentPlayer={currentPlayer} question={currentQuestion} onAnswer={handleAnswer} onNextQuestion={handleNextQuestion} duration={game.timer} onTimeout={handleTimeout} gameStartedAt={currentPlayer.gameStartedAt}/>;
    }

    // Team Mode Logic (and private 1v1 rooms)
    if (game.status === 'lobby' || game.status === 'starting' || ((game.status === 'playing' || game.status === 'finished') && !currentPlayer)) {
      if ((game.status === 'playing' || game.status === 'finished') && !currentPlayer) {
        return (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <h1 className="text-4xl font-bold font-display">Game in Progress</h1>
            <p className="mt-2 text-muted-foreground">A game is currently being played. You can join the next round.</p>
          </div>
        );
      }
      return <Lobby game={game} onJoinTeam={handleJoinTeam} onStartGame={handleStartGame} currentPlayer={currentPlayer} isAdmin={isAdmin} />;
    }

    switch (game.status) {
      case "playing":
        if (!currentPlayer) return <p>Joining game...</p>;
        const playerTeam = game.teams.find((t) => t.name === currentPlayer?.teamName);
        if (!playerTeam) return <p>Error: Your team or player data could not be found.</p>;

        if (view === "grid") {
          return <ColorGridScreen grid={game.grid} teams={game.teams} onColorSquare={handleColorSquare} teamColoring={playerTeam.color} credits={currentPlayer.coloringCredits} onSkip={handleSkipColoring} sessionType='team' />;
        }
        if (!currentQuestion) {
          return (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
              <h1 className="text-4xl font-bold font-display">You've answered all questions!</h1>
              <p className="mt-2 text-muted-foreground">Waiting for the game to end...</p>
            </div>
          );
        }
        return <GameScreen teams={game.teams} currentPlayer={currentPlayer} question={currentQuestion} onAnswer={handleAnswer} onNextQuestion={handleNextQuestion} duration={game.timer || 300} onTimeout={handleTimeout} gameStartedAt={game.gameStartedAt} />;
      case "finished":
        return <ResultsScreen teams={game.teams} onPlayAgain={() => {}} isAdmin={isAdmin} />;
      default:
        return <div className="text-center">Unknown game state.</div>;
    }
  };

  return (
    <div className="container mx-auto flex flex-1 flex-col px-4 py-8">
      {renderContent()}
    </div>
  );
}
