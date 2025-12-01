
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  Player,
  Question,
  Game,
  Team,
  GridSquare,
} from "@/lib/types";
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
  deleteDoc,
  setDoc,
  orderBy,
  getDocs,
  arrayUnion,
} from "firebase/firestore";
import {
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import Lobby from "@/components/game/Lobby";
import GameScreen from "@/components/game/GameScreen";
import ResultsScreen from "@/components/game/ResultsScreen";
import PreGameCountdown from "@/components/game/PreGameCountdown";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { v4 as uuidv4 } from "uuid";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const generatePin = () =>
  Math.random().toString(36).substring(2, 6).toUpperCase();

const IndividualLobby = ({
  game,
  onJoin,
  isJoining,
}: {
  game: Game;
  onJoin: (formData: Record<string, string>, name: string) => void;
  isJoining: boolean;
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState("");
  const nameField = game.requiredPlayerFields.find((f) =>
    f.label.toLowerCase().includes("name")
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError("Please fill out your name.");
      return;
    }
    const otherFields = game.requiredPlayerFields.filter(
      (f) => f.label.toLowerCase() !== "full name"
    );
    const allOtherFieldsFilled = otherFields.every(
      (field) =>
        formData[field.id] && formData[field.id].trim() !== ""
    );

    if (!allOtherFieldsFilled) {
      setError("Please fill out all fields.");
      return;
    }

    setError("");
    onJoin(formData, playerName);
  };

  const handleChange = (fieldId: string, value: string) => {
    if (nameField && fieldId === nameField.id) {
      setPlayerName(value);
    } else {
      setFormData((prev) => ({ ...prev, [fieldId]: value }));
    }
  };

  const nameInputId = nameField?.id || 'player-name-field';

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <div className="text-center text-white drop-shadow-lg">
        <h1 className="text-5xl font-bold font-display">{game.title}</h1>
        <CardDescription className="mt-2 max-w-xl text-lg text-slate-200">
          Enter your details to start the challenge. You will have{" "}
          {Math.floor(game.timer / 60)} minutes to answer questions
          and capture territory.
        </CardDescription>
      </div>

      <Card className="my-8 w-full max-w-md">
        <CardHeader>
          <CardTitle>Your Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {game.requiredPlayerFields
              .map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <Input
                    id={field.id}
                    type={field.type}
                    value={nameField && field.id === nameField.id ? playerName : formData[field.id] || ""}
                    onChange={(e) =>
                      handleChange(field.id, e.target.value)
                    }
                    required
                    className="text-lg p-6 w-full"
                  />
                </div>
              ))}
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isJoining}
            >
              {isJoining ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Start Challenge"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentQuestion, setCurrentQuestion] =
    useState<Question | null>(null);
  const [isJoining, setIsJoining] = useState(false);

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

  // Main game state listener
  useEffect(() => {
    if (!gameId || !authUser) return;
    setLoading(true);
    const gameRef = doc(db, "games", gameId.toUpperCase());

    const unsubGame = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const gameData = {
          id: docSnap.id,
          ...docSnap.data(),
        } as Game;
        
        setGame(gameData);

        const isUserAdmin = gameData.adminId === authUser.uid;
        setIsAdmin(isUserAdmin);

        const player =
          gameData.teams
            ?.flatMap((t) => t.players)
            .find((p) => p.id === authUser.uid) || null;
            
        setCurrentPlayer(player);
        
        if (gameData.status === 'playing' && !player && gameData.parentSessionId) {
             toast({ title: "Game in progress", description: "This match has already started.", variant: "destructive"});
             router.replace(`/game/${gameData.parentSessionId}`);
             return;
        }
        
        // This is the fix for the game not starting after countdown
        if (gameData.status === 'starting' && gameData.gameStartedAt && (gameData.gameStartedAt.toMillis() < Date.now())) {
            if (isUserAdmin || gameData.sessionType === 'individual' || gameData.parentSessionId) {
                 updateDoc(gameRef, { status: "playing" }).catch((serverError) => {
                    const permissionError = new FirestorePermissionError({
                        path: gameRef.path,
                        operation: 'update',
                        requestResourceData: { status: 'playing' },
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
            }
        }


        setLoading(false);
      } else {
        setGame(null);
        setCurrentPlayer(null);
        setLoading(false);
      }
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: gameRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubGame();
  }, [gameId, authUser, toast, router, isAdmin]);

  const handleTimeout = useCallback(async () => {
    if (!game) return;
    const is1v1 = !!game.parentSessionId;
    if (game.status === "playing" && (isAdmin || game.sessionType === 'individual' || is1v1)) {
      const gameRef = doc(db, "games", gameId);
      updateDoc(gameRef, { status: "finished" }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: gameRef.path,
            operation: 'update',
            requestResourceData: { status: 'finished' },
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    }
  }, [game, isAdmin, gameId]);
  
  const getNextQuestion = useCallback(() => {
    if (!game || !currentPlayer) return null;
    const answeredCount = currentPlayer.answeredQuestions?.length || 0;
    if (answeredCount < game.questions.length) {
      return game.questions[answeredCount];
    }
    return null;
  }, [game, currentPlayer]);

  useEffect(() => {
    if (!game || !currentPlayer || game.status !== 'playing') return;
    const nextQ = getNextQuestion();
    setCurrentQuestion(nextQ);
  }, [currentPlayer?.answeredQuestions, game, getNextQuestion, game?.status]);


  // Effect for game timeout
  useEffect(() => {
    if (game?.status === 'playing' && game.gameStartedAt && game.timer) {
      const gameStartTime = game.gameStartedAt.toMillis();
      const endTime = gameStartTime + game.timer * 1000;
      const now = Date.now();
      
      if (now >= endTime) {
        handleTimeout();
      } else {
        const timeoutId = setTimeout(handleTimeout, endTime - now);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [game?.status, game?.gameStartedAt, game?.timer, handleTimeout]);


  const handleJoinTeam = async (
    playerName: string,
    playerId: string,
    teamName: string
  ) => {
    if (!playerName.trim()) {
      toast({
        title: "Invalid Name",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }
    if (!game || !authUser) return;

    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, "games", gameId);
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game does not exist!");
        const currentGame = gameDoc.data() as Game;

        if (currentGame.sessionType !== "team")
          throw new Error("This is not a team game.");

        const isAlreadyInAnyTeam = currentGame.teams.some((t) =>
          t.players.some((p) => p.id === authUser.uid)
        );
        if (isAlreadyInAnyTeam) {
          toast({
            title: "Already in a team",
            description: "You have already joined a team.",
            variant: "destructive",
          });
          return;
        }

        const teamIndex = currentGame.teams.findIndex(
          (t) => t.name === teamName
        );
        if (teamIndex === -1) throw new Error("Team not found!");
        if (
          currentGame.teams[teamIndex].players.length >=
          currentGame.teams[teamIndex].capacity
        )
          throw new Error(`Sorry, ${teamName} is full.`);

        const newPlayer: Player = {
          id: authUser.uid,
          playerId,
          name: playerName,
          teamName,
          answeredQuestions: [],
          coloringCredits: 0,
          score: 0,
        };
        const updatedTeams = [...currentGame.teams];
        updatedTeams[teamIndex].players.push(newPlayer);
        transaction.update(gameRef, { teams: updatedTeams });
      });
    } catch (error: any) {
      console.error("Error joining team: ", error);
      const gameRef = doc(db, "games", gameId);
      const permissionError = new FirestorePermissionError({
        path: gameRef.path,
        operation: 'update',
        requestResourceData: { teams: "..." } // Cannot get full data in transaction error
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        title: "Could Not Join",
        description:
          error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleJoinIndividual = async (
    customData: Record<string, string>,
    name: string
  ) => {
    if (!game || !authUser) return;
    setIsJoining(true);

    const newGameRef = doc(db, "games", `${gameId}-${authUser.uid.slice(0, 5)}-${generatePin()}`);
    const templateGameRef = doc(db, "games", gameId);

    try {
      
      let templateGameData = game;

      if (!templateGameData.questions || templateGameData.questions.length === 0) {
        const result = await generateQuestionsAction({
          topic: templateGameData.topic || "General Knowledge",
          numberOfQuestions: 20,
        });
        if (result.questions) {
          templateGameData.questions = result.questions;
          updateDoc(templateGameRef, { questions: result.questions }).catch((serverError) => {
              const permissionError = new FirestorePermissionError({
                  path: templateGameRef.path,
                  operation: 'update',
                  requestResourceData: { questions: result.questions },
              });
              errorEmitter.emit('permission-error', permissionError);
          });
        } else {
          throw new Error("AI failed to generate questions.");
        }
      }

      const idNumberField = game.requiredPlayerFields.find(f => f.label.toLowerCase().includes('id number'));
      const nameField = game.requiredPlayerFields.find(f => f.label.toLowerCase().includes('name'));
      
      const playerId = idNumberField ? customData[idNumberField.id] || uuidv4() : uuidv4();
      const playerName = nameField ? name : customData[Object.keys(customData)[0]];

      const newCustomData: Record<string, string> = {};
      game.requiredPlayerFields.forEach(field => {
        newCustomData[field.label] = customData[field.id] || '';
      });
       if(nameField) {
        newCustomData[nameField.label] = name;
       }


      const newPlayer: Player = {
        id: authUser.uid,
        playerId: playerId,
        name: playerName,
        teamName: "Team", 
        answeredQuestions: [],
        coloringCredits: 0,
        score: 0,
        customData: newCustomData,
      };

      const newGame: Omit<Game, "id"> = {
        ...templateGameData,
        title: `${templateGameData.title} - ${playerName}`,
        status: "playing",
        parentSessionId: gameId,
        teams: [
          {
            name: "Team",
            score: 0,
            players: [newPlayer],
            capacity: 1,
            color: templateGameData.teams[0]?.color || "#888888",
            icon: templateGameData.teams[0]?.icon || "",
          },
        ],
        grid: templateGameData.grid.map(g => ({ ...g, coloredBy: null })),
        gameStartedAt: serverTimestamp() as Timestamp,
      };

      await setDoc(newGameRef, newGame).catch((serverError) => {
          const permissionError = new FirestorePermissionError({
              path: newGameRef.path,
              operation: 'create',
              requestResourceData: newGame,
          });
          errorEmitter.emit('permission-error', permissionError);
          throw serverError; // re-throw to be caught by outer catch
      });
      
      router.push(`/game/${newGameRef.id}`);

    } catch (error: any) {
      console.error("Error joining individual challenge: ", error);
      if (!(error instanceof FirestorePermissionError)) {
          toast({
            title: "Could Not Join",
            description: error.message || "An unexpected error occurred.",
            variant: "destructive",
          });
      }
      setIsJoining(false);
    }
  };


  const handleStartGame = async () => {
    if (!game || !isAdmin) {
      toast({
        title: "Not Authorized",
        description: "Only the admin can start.",
        variant: "destructive",
      });
      return;
    }
    if (
      game.teams.reduce(
        (sum, t) => sum + t.players.length,
        0
      ) === 0
    ) {
      toast({
        title: "No players!",
        description: "At least one player must join.",
        variant: "destructive",
      });
      return;
    }

    const gameRef = doc(db, "games", gameId);
    
    try {
      let questionsToUse: Question[] = game.questions || [];
      if (questionsToUse.length === 0) {
        const result = await generateQuestionsAction({
          topic: game.topic || "General Knowledge",
          numberOfQuestions: 20,
        });
        if (result.questions) {
          questionsToUse = result.questions;
        } else {
          throw new Error("AI failed to generate questions.");
        }
      }
      const updateData = {
        questions: questionsToUse,
        status: "playing",
        gameStartedAt: serverTimestamp(),
      };
      await updateDoc(gameRef, updateData).catch((serverError) => {
          const permissionError = new FirestorePermissionError({
              path: gameRef.path,
              operation: 'update',
              requestResourceData: updateData,
          });
          errorEmitter.emit('permission-error', permissionError);
          throw serverError;
      });
    } catch (error) {
      console.error(error);
      if (!(error instanceof FirestorePermissionError)) {
        toast({
            title: "Error Starting Game",
            description: "Could not prepare questions.",
            variant: "destructive",
        });
      }
      updateDoc(gameRef, { status: "lobby" }).catch((serverError) => {
          const permissionError = new FirestorePermissionError({
              path: gameRef.path,
              operation: 'update',
              requestResourceData: { status: 'lobby' },
          });
          errorEmitter.emit('permission-error', permissionError);
      });
    }
  };

  const handleAnswer = async (
    question: Question,
    answer: string
  ) => {
    if (!game || !currentPlayer || !authUser) return;
    const isCorrect =
      question.answer.trim().toLowerCase() ===
      answer.trim().toLowerCase();

    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, "games", gameId);
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game does not exist!");
        const currentGame = gameDoc.data() as Game;

        const teamIndex = currentGame.teams.findIndex(
          (t) => t.name === currentPlayer.teamName
        );
        if (teamIndex === -1) return;
        const playerIndex =
          currentGame.teams[teamIndex].players.findIndex(
            (p) => p.id === currentPlayer.id
          );
        if (playerIndex === -1) return;

        const updatedTeams = [...currentGame.teams];
        const playerToUpdate =
          updatedTeams[teamIndex].players[playerIndex];
        
        playerToUpdate.answeredQuestions = [
          ...(playerToUpdate.answeredQuestions || []),
          question.question,
        ];

        if (isCorrect) {
          updatedTeams[teamIndex].score += 1;
        }
        transaction.update(gameRef, { teams: updatedTeams });
      });
    } catch (error) {
      console.error("Error handling answer:", error);
      const gameRef = doc(db, "games", gameId);
      const permissionError = new FirestorePermissionError({
        path: gameRef.path,
        operation: 'update',
        requestResourceData: { teams: "..." } // Cannot get full data in transaction error
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  };

  const handleNextQuestion = () =>
    setCurrentQuestion(getNextQuestion());

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <h1 className="mt-4 text-4xl font-bold font-display text-white drop-shadow-lg">
            Loading Session...
          </h1>
        </div>
      );
    }
    
    if (!game) {
        return (
             <div className="flex flex-col items-center justify-center flex-1 text-center">
                <h1 className="text-4xl font-bold font-display text-destructive">Session Not Found</h1>
                <p className="mt-2 text-muted-foreground">The game PIN you entered does not exist or has expired.</p>
                <Button onClick={() => router.push('/')} className="mt-8">Back to Home</Button>
            </div>
        )
    }

    if (game.sessionType === "individual" && !currentPlayer && !game.parentSessionId) {
      return (
        <IndividualLobby
          game={game}
          onJoin={handleJoinIndividual}
          isJoining={isJoining}
        />
      );
    }

    if (!currentPlayer && game.parentSessionId) {
        return <div className="flex items-center justify-center h-full">Error: Could not find player data in this game.</div>
    }
    
    if(game.parentSessionId && game.status === 'lobby' && currentPlayer) {
      return (
         <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h1 className="text-4xl font-bold mt-4 font-display">
              Waiting for an opponent...
            </h1>
            <p className="text-muted-foreground mt-2">
              You are in the queue, {currentPlayer.name}. A match will begin automatically.
            </p>
        </div>
      )
    }

     if (game.status === "lobby") {
      return (
        <Lobby
          game={game}
          onJoinTeam={handleJoinTeam}
          onStartGame={handleStartGame}
          currentPlayer={currentPlayer}
          isAdmin={isAdmin}
        />
      );
    }
    
    if (game.status === "starting") {
        return <PreGameCountdown gameStartedAt={game.gameStartedAt} />;
    }

    switch (game.status) {
      case "playing":
        if (!currentPlayer) return <p>Joining game...</p>;
        const playerTeam = game.teams.find(
          (t) => t.name === currentPlayer?.teamName
        );
        if (!playerTeam)
          return (
            <p>Error: Your team or player data could not be found.</p>
          );
        
        const isIndividualMode = game.sessionType === 'individual' || !!game.parentSessionId;
        
        if (!currentQuestion) {
          return (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
              <h1 className="text-4xl font-bold font-display">
                You've answered all questions!
              </h1>
              <p className="mt-2 text-muted-foreground">
                Great job! See your final score when time is up.
              </p>
            </div>
          );
        }
        return (
          <GameScreen
            teams={game.teams}
            currentPlayer={currentPlayer}
            question={currentQuestion}
            onAnswer={handleAnswer}
            onNextQuestion={handleNextQuestion}
            duration={game.timer || 300}
            onTimeout={handleTimeout}
            gameStartedAt={game.gameStartedAt}
            isIndividualMode={isIndividualMode}
          />
        );
      case "finished":
        return (
          <ResultsScreen
            game={game}
            onPlayAgain={() => {}}
            isAdmin={isAdmin}
            individualPlayerId={game.sessionType === 'individual' ? currentPlayer?.id : undefined}
          />
        );
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
