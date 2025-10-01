
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Player, Question, Game, Team, GridSquare, CustomPlayerField, SessionType } from "@/lib/types";
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
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { v4 as uuidv4 } from 'uuid';

const GRID_SIZE_INDIVIDUAL = 22;

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

export default function GamePage() {
  const params = useParams();
  const GAME_ID = (params.gameId as string).toUpperCase();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [view, setView] = useState<"question" | "grid">("question");

  useEffect(() => {
    if (game?.theme) {
      document.documentElement.setAttribute("data-theme", game.theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [game?.theme]);

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

  useEffect(() => {
    if (!GAME_ID) return;
    const gameRef = doc(db, "games", GAME_ID);

    const unsubGame = onSnapshot(gameRef, (docSnap) => {
      setLoading(true);
      if (docSnap.exists()) {
        const gameData = { id: docSnap.id, ...docSnap.data() } as Game;
        setGame(gameData);

        if (authUser) {
          const isUserAdmin = gameData.adminId === authUser.uid;
          setIsAdmin(isUserAdmin);
          
          // The "team" is the container for all players in both modes
          const player = gameData.teams?.flatMap((t) => t.players).find((p) => p.id === authUser.uid) || null;
          setCurrentPlayer(player);
        }

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

    // Logic for team mode game status
    if(game.sessionType === 'team' && game.status !== "playing") return;
    
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
        
        let currentGrid: GridSquare[];
        let playerTeamIndex: number, playerIndex: number;
        
        // For individual games, player state is stored in the main team array.
        playerTeamIndex = currentGame.teams.findIndex(t => t.name === currentPlayer.teamName);
        if(playerTeamIndex === -1) throw new Error("Could not find player's team.");
        playerIndex = currentGame.teams[playerTeamIndex].players.findIndex(p => p.id === currentPlayer.id);
        if (playerIndex === -1) throw new Error("Could not find player data.");
        
        currentGrid = currentGame.grid;

        const playerToUpdate = currentGame.teams[playerTeamIndex].players[playerIndex];
        if (playerToUpdate.coloringCredits <= 0) throw new Error("You have no coloring credits.");
        
        const squareIndex = currentGrid.findIndex((s) => s.id === squareId);
        if (squareIndex === -1) throw new Error("Square not found.");
        
        const originalOwnerName = currentGrid[squareIndex].coloredBy;
        const coloredByName = game.sessionType === 'individual' ? playerToUpdate.id : currentPlayer.teamName;

        if (originalOwnerName === coloredByName) throw new Error("You already own this square.");

        playerToUpdate.coloringCredits -= 1;
        playerToUpdate.score += 1;
        currentGame.teams[playerTeamIndex].score += 1;

        if (originalOwnerName && game.sessionType === 'team') {
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
          status: isGridFull && game.sessionType === 'team' ? "finished" : currentGame.status,
        });
      });
      setCurrentQuestion(getNextQuestion());
    } catch (error: any) {
      console.error("Failed to color square: ", error);
      toast({ title: "Error Coloring Square", description: error.message, variant: "destructive" });
    }
  };

  const handleTimeout = async () => {
    if (game?.sessionType === 'team' && game?.status === "playing" && isAdmin) {
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

    if (game.sessionType === 'individual') {
        if (!currentPlayer) {
            return <IndividualLobby game={game} onJoin={handleJoinIndividual} />;
        }
        
        const playerStartTime = currentPlayer.gameStartedAt?.toMillis();
        const isTimeUp = playerStartTime && (Date.now() > playerStartTime + game.timer * 1000);
        const isGridFull = game.grid.every(s => s.coloredBy !== null);

        if (isTimeUp || isGridFull) {
            // Show a summary for the individual player
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

    // Team Mode Logic
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
