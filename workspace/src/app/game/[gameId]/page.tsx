
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
  updateDoc,
  serverTimestamp,
  runTransaction,
  Timestamp,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

import Lobby from "@/components/game/Lobby";
import GameScreen from "@/components/game/GameScreen";
import ResultsScreen from "@/components/game/ResultsScreen";
import PreGameCountdown from "@/components/game/PreGameCountdown";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { v4 as uuidv4 } from "uuid";
import ColorGridScreen from "@/components/game/ColorGridScreen";

type QuestionPhase = 'answering' | 'feedback' | 'coloring' | 'transitioning';

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
    
    const nameToSubmit = nameField ? playerName : formData[Object.keys(formData)[0]];

    if (!nameToSubmit || !nameToSubmit.trim()) {
      setError("Please fill out your name.");
      return;
    }
    const allFieldsFilled = game.requiredPlayerFields.every(field => {
        if (nameField && field.id === nameField.id) return !!playerName.trim();
        return formData[field.id] && formData[field.id].trim() !== ""
    });

    if (!allFieldsFilled) {
      setError("Please fill out all required fields.");
      return;
    }

    setError("");
    onJoin(formData, nameToSubmit);
  };

  const handleChange = (fieldId: string, value: string) => {
    if (nameField && fieldId === nameField.id) {
      setPlayerName(value);
    } else {
      setFormData((prev) => ({ ...prev, [fieldId]: value }));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md mx-auto">
       <div className="text-center mb-8">
        <h1 className="text-5xl font-bold font-display text-white drop-shadow-lg">{game.title}</h1>
        <CardDescription className="mt-2 max-w-xl text-lg text-slate-200">
          You have {Math.floor(game.timer / 60)} minutes to prove your knowledge.
        </CardDescription>
      </div>
      <Card className="w-full">
        <CardHeader className="text-center items-center">
            <div className="bg-primary/20 p-4 rounded-full mb-2">
                <UserIcon className="h-8 w-8 text-primary" />
            </div>
          <CardTitle>Enter the Challenge</CardTitle>
          <CardDescription>Fill in your details below to begin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {game.requiredPlayerFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <Input
                    id={field.id}
                    type={field.type}
                    value={nameField && field.id === nameField.id ? playerName : formData[field.id] || ""}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    required
                    className="text-lg h-12 w-full"
                  />
                </div>
              ))}
            {error && <p className="text-destructive text-sm">{error}</p>}
             <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isJoining}
            >
              {isJoining ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( "Start Challenge" )}
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
  const [authUser, authLoading] = useAuthState(auth);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const { toast } = useToast();
  const [isJoining, setIsJoining] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // NEW STATE MACHINE FOR FLOW CONTROL
  const [questionPhase, setQuestionPhase] = useState<QuestionPhase>('answering');
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [pendingColorCredits, setPendingColorCredits] = useState(0);

  // Refs for timeout management to prevent race conditions
  const phaseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const isAdmin = game?.adminId === authUser?.uid;
  const isIndividualMode = game?.sessionType === 'individual' || !!game?.parentSessionId;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!gameId) return;

    let foundGame = false;
  
    const handleDocSnapshot = (doc: any) => {
        if (doc.exists()) {
            foundGame = true;
            const gameData = { id: doc.id, ...doc.data() } as Game;
            setGame(gameData);

            if(gameData.questions && gameData.questions.length > 0){
              setCurrentQuestion(gameData.questions[0]);
            }

            if (authUser) {
                const player =
                    gameData.teams
                        ?.flatMap((t) => t.players)
                        .find((p) => p.id === authUser.uid) || null;
                setCurrentPlayer(player);

                if (player && gameData.status === "playing") {
                    const answeredCount = player.answeredQuestions?.length || 0;
                    setCurrentQuestionIndex(answeredCount);
                    if (answeredCount < gameData.questions.length) {
                        setCurrentQuestion(gameData.questions[answeredCount]);
                    } else {
                        setCurrentQuestion(null);
                    }
                }
            }
            setLoading(false);
        }
    };
    
    // Check both games and individual_games collections
    const gamesRef = doc(db, "games", gameId.toUpperCase());
    const individualGamesRef = doc(db, "individual_games", gameId.toUpperCase());

    const unsubscribeGames = onSnapshot(gamesRef, handleDocSnapshot);
    const unsubscribeIndividualGames = onSnapshot(individualGamesRef, handleDocSnapshot);
    
    // If neither collection has the game, show error after a short delay
    const timeout = setTimeout(() => {
        if (!foundGame) {
            setGame(null);
            toast({
                title: "Session Not Found",
                description: "This game session does not exist or has expired.",
                variant: "destructive",
            });
            router.push("/");
            setLoading(false);
        }
    }, 2000);
  
    return () => {
      unsubscribeGames();
      unsubscribeIndividualGames();
      clearTimeout(timeout);
    };
  }, [gameId, authUser, router, toast]);

    
  // Effect to manage game state transitions and redirects
  useEffect(() => {
    if (!game || !authUser) return;

    if (game.status === 'playing' && !currentPlayer && game.parentSessionId) {
        toast({ title: "Game in progress", description: "This match has already started.", variant: "destructive"});
        router.replace(`/game/${game.parentSessionId}`);
        return;
    }
    
    if (game.status === 'starting' && game.gameStartedAt && (game.gameStartedAt.toMillis() < Date.now())) {
        if (isAdmin || game.sessionType === 'individual' || game.parentSessionId) {
             updateDoc(doc(db, "games", gameId), { status: "playing" });
        }
    }
  }, [game, currentPlayer, authUser, isAdmin, gameId, router, toast]);

  const handleTimeout = useCallback(async () => {
    if (!game || loading) return;
    const is1v1 = !!game.parentSessionId;
    if (game.status === "playing" && (isAdmin || game.sessionType === 'individual' || is1v1)) {
      await updateDoc(doc(db, "games", gameId), { status: "finished" });
    }
  }, [game, isAdmin, gameId, loading]);

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
    if (!game || !authUser) return;

    const gameRef = doc(db, "games", gameId);
    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) {
          throw new Error("Game does not exist");
        }

        const currentGame = gameDoc.data() as Game;

        if (currentGame.status !== "lobby") {
          throw new Error("Game has already started");
        }

        const existingPlayer = currentGame.teams
          .flatMap((t) => t.players)
          .find((p) => p.id === authUser.uid);
        if (existingPlayer) {
          throw new Error("You have already joined a team.");
        }

        const team = currentGame.teams.find((t) => t.name === teamName);
        if (!team) throw new Error("Team not found");
        if (team.players.length >= team.capacity)
          throw new Error("Team is full");

        const newPlayer: Player = {
          id: authUser.uid,
          playerId,
          name: playerName,
          teamName: team.name,
          answeredQuestions: [],
          coloringCredits: 0,
          score: 0,
        };

        const updatedTeams = currentGame.teams.map((t) => {
          if (t.name === teamName) {
            return { ...t, players: [...t.players, newPlayer] };
          }
          return t;
        });

        transaction.update(gameRef, { teams: updatedTeams });
      });
    } catch (error: any) {
      toast({
        title: "Could not join team",
        description: error.message,
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

    const newGameId = `${gameId}-${authUser.uid.slice(0, 5)}-${generatePin()}`;
    const newGameRef = doc(db, "games", newGameId);
    const templateGameRef = doc(db, "games", gameId);

    try {
      let templateGameData = { ...game };

      if (!templateGameData.questions || templateGameData.questions.length === 0) {
        const result = await generateQuestionsAction({
          topic: templateGameData.topic || "General Knowledge",
          numberOfQuestions: 20,
        });
        if (result.questions) {
          templateGameData.questions = result.questions;
          await updateDoc(templateGameRef, { questions: result.questions });
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
        teamName: "Team", // Dummy team
        answeredQuestions: [],
        coloringCredits: 0,
        score: 0,
        customData: newCustomData,
      };

      const newGame: Game = {
        ...templateGameData,
        id: newGameId,
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

      await setDoc(newGameRef, newGame);
      router.push(`/game/${newGameId}`);

    } catch (error: any) {
      console.error("Error joining individual challenge: ", error);
      toast({
        title: "Could Not Join",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      setIsJoining(false);
    }
  };


  const handleStartGame = async () => {
    if (!game || !isAdmin) {
      toast({ title: "Not Authorized", description: "Only the admin can start.", variant: "destructive" });
      return;
    }
    if (game.teams.reduce((sum, t) => sum + t.players.length, 0) === 0) {
      toast({ title: "No players!", description: "At least one player must join.", variant: "destructive" });
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
      await updateDoc(gameRef, updateData);
    } catch (error) {
      console.error(error);
      toast({ title: "Error Starting Game", description: "Could not prepare questions.", variant: "destructive" });
      updateDoc(gameRef, { status: "lobby" });
    }
  };
  
    // 3. CENTRALIZED NEXT QUESTION LOGIC
  const moveToNextQuestion = useCallback(() => {
    if (!game) return;

    if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
    
    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);

    if (nextIndex < game.questions.length) {
      setCurrentQuestion(game.questions[nextIndex]);
    } else {
      setCurrentQuestion(null);
    }

    // Reset phase state for the new question
    setQuestionPhase('answering');
    setLastAnswerCorrect(null);
    setPendingColorCredits(0);
  }, [game, currentQuestionIndex]);

  // 4. HANDLE ANSWER WITH PHASE TRANSITIONS
  const handleAnswer = async (question: Question, answer: string) => {
    // Prevent double clicking or answering during wrong phase
    if (!game || !currentPlayer || questionPhase !== 'answering') return;
    
    const isCorrect = question.answer.trim().toLowerCase() === answer.trim().toLowerCase();

    // A. Immediate Feedback (Optimistic UI)
    setQuestionPhase('feedback');
    setLastAnswerCorrect(isCorrect);
    
    const gameRef = doc(db, "games", gameId);

    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        
        const currentGame = gameDoc.data() as Game;
        const teamIndex = currentGame.teams.findIndex(t => t.name === currentPlayer.teamName);
        if (teamIndex === -1) throw new Error("Team not found");
        
        const playerIndex = currentGame.teams[teamIndex].players.findIndex(p => p.id === currentPlayer.id);
        if (playerIndex === -1) throw new Error("Player not found");
        
        const updatedTeams = [...currentGame.teams];
        const playerToUpdate = { ...updatedTeams[teamIndex].players[playerIndex] };

        playerToUpdate.answeredQuestions = [
          ...(playerToUpdate.answeredQuestions || []),
          question.question,
        ];

        let scoreChange = 0;
        let newColorCredits = playerToUpdate.coloringCredits || 0;

        if (isCorrect) {
          scoreChange = 1;
          newColorCredits += 1;
          playerToUpdate.coloringCredits = newColorCredits;
        } else if (isIndividualMode) {
          scoreChange = -1; // Penalty for individual mode
        }

        updatedTeams[teamIndex].score += scoreChange;
        playerToUpdate.score += scoreChange;
        updatedTeams[teamIndex].players[playerIndex] = playerToUpdate;
        
        transaction.update(gameRef, { teams: updatedTeams });

        // Store credits locally to decide next phase
        if (isCorrect) {
          setPendingColorCredits(newColorCredits);
        }
      });

      // B. Schedule Next Phase
      phaseTimeoutRef.current = setTimeout(() => {
        // If correct AND Team Mode -> Go to Coloring
        if (isCorrect && !isIndividualMode) {
           setQuestionPhase('coloring');
        } else {
           // If Wrong OR Individual Mode -> Skip coloring, go to next
           setQuestionPhase('transitioning');
           phaseTimeoutRef.current = setTimeout(() => {
             moveToNextQuestion();
           }, 500);
        }
      }, 2000); // Show feedback for 2 seconds

    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Could not submit answer.", variant: "destructive" });
      // On error, force move next after delay
      setTimeout(moveToNextQuestion, 2000);
    }
  };

  // 5. HANDLE COLORING SELECTION
  const handleColorSquare = async (squareId: number) => {
    // If skipping (squareId -1) or error
    if (!game || !currentPlayer || squareId < 0) {
      moveToNextQuestion();
      return;
    }

    const gameRef = doc(db, "games", gameId);
    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        
        const currentGame = gameDoc.data() as Game;
        const teamIndex = currentGame.teams.findIndex(t => t.name === currentPlayer.teamName);
        if (teamIndex === -1) return;

        const playerIndex = currentGame.teams[teamIndex].players.findIndex(p => p.id === currentPlayer.id);
        if (playerIndex === -1) return;

        const updatedTeams = [...currentGame.teams];
        const playerToUpdate = updatedTeams[teamIndex].players[playerIndex];
        if (playerToUpdate.coloringCredits <= 0) return;

        const updatedGrid = [...currentGame.grid];
        const gridIndex = updatedGrid.findIndex(s => s.id === squareId);
        if (gridIndex === -1) return;

        if (updatedGrid[gridIndex].coloredBy) {
            // Already colored
        } else {
            updatedGrid[gridIndex].coloredBy = currentPlayer.teamName;
            playerToUpdate.coloringCredits -= 1;
        }
        
        updatedTeams[teamIndex].players[playerIndex] = playerToUpdate;
        transaction.update(gameRef, { grid: updatedGrid, teams: updatedTeams });
      });
    } catch (error) {
      console.error(error);
    }
    // Always move next after attempt
    moveToNextQuestion();
  };

  const renderContent = () => {
    if (loading || authLoading) {
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

    if (!currentPlayer && (game.sessionType === 'team' || game.parentSessionId)) {
        if(game.status !== 'lobby') {
            return <div className="text-center p-8">This game is already in progress. You cannot join now.</div>;
        }
        // If it's lobby, the Lobby component will handle the join UI
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

    switch (game.status) {
      case "lobby":
        return (
          <Lobby
            game={game}
            onJoinTeam={handleJoinTeam}
            onStartGame={handleStartGame}
            currentPlayer={currentPlayer}
            isAdmin={isAdmin}
          />
        );
      case "starting":
        return <PreGameCountdown gameStartedAt={game.gameStartedAt} />;
      case "playing":
        if (!currentPlayer) return <p>Joining game...</p>;
        
        const playerTeam = game.teams.find((t) => t.name === currentPlayer?.teamName);
        if (!playerTeam) return (<p>Error: Your team or player data could not be found.</p>);

        const freshPlayer = playerTeam.players.find(p => p.id === currentPlayer.id);

        if (questionPhase === 'coloring' && freshPlayer && freshPlayer.coloringCredits > 0 && !isIndividualMode) {
            return (
                <ColorGridScreen 
                    grid={game.grid}
                    teams={game.teams}
                    onColorSquare={handleColorSquare}
                    teamColoring={playerTeam.color}
                    credits={freshPlayer.coloringCredits}
                    onSkip={() => handleColorSquare(-1)}
                />
            )
        }

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
            currentPlayer={freshPlayer || currentPlayer}
            question={currentQuestion}
            questionPhase={questionPhase}
            lastAnswerCorrect={lastAnswerCorrect}
            onAnswer={handleAnswer}
            grid={game.grid}
            duration={game.timer || 300}
            onTimeout={handleTimeout}
            gameStartedAt={game.gameStartedAt}
            isIndividualMode={isIndividualMode}
            totalQuestions={game.questions.length}
            currentQuestionIndex={currentQuestionIndex}
          />
        );
      case "finished":
        return (
          <ResultsScreen
            game={game}
            onPlayAgain={() => {}}
            isAdmin={isAdmin}
            individualPlayerId={game.parentSessionId ? currentPlayer?.id : undefined}
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
