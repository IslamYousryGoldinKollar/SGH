"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Team, Player, Question, GameStatus, Game } from "@/lib/types";
import { generateQuestionsAction }from "@/lib/actions";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";

import Lobby from "@/components/game/Lobby";
import GameScreen from "@/components/game/GameScreen";
import ResultsScreen from "@/components/game/ResultsScreen";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// This constant defines how many questions each player in a team will answer.
// The total questions generated will be (total players) * (QUESTIONS_PER_PLAYER)
// This value is a placeholder and should be made configurable by the admin in a future update.
const QUESTIONS_PER_PLAYER = 1;

export default function GamePage() {
  const params = useParams();
  const GAME_ID = (params.gameId as string).toUpperCase();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthUser(user);
        // Check if the current user is the admin.
        const adminSettingsDoc = await getDoc(doc(db, "settings", "admin"));
        if (adminSettingsDoc.exists() && adminSettingsDoc.data().uid === user.uid) {
            setIsAdmin(true);
        }
      } else {
        // If no user, sign them in anonymously to get a stable UID.
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in error", error);
          toast({ title: "Authentication Error", description: "Could not sign in.", variant: "destructive" });
        });
      }
    });

    // Subscribe to real-time updates for the game document.
    const gameRef = doc(db, "games", GAME_ID);
    const unsubGame = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const gameData = docSnap.data() as Game;
        setGame({ id: docSnap.id, ...gameData });
        
        // If we have an authenticated user, check if they are already a player in this game.
        if (authUser) {
          const player = gameData.teams?.flatMap(t => t.players).find(p => p.id === authUser.uid);
          setCurrentPlayer(player || null);
        }
      } else {
        // Game doc doesn't exist for a player, this is an error.
        toast({ title: "Game not found", description: "This game session does not exist.", variant: "destructive" });
        setGame(null); // Explicitly set game to null
      }
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubGame();
    };
  }, [GAME_ID, authUser?.uid, toast]); // Depend on authUser.uid for re-evaluation

 const handleJoinTeam = async (playerName: string, teamName: string) => {
    if (!playerName.trim()) {
      toast({ title: "Invalid Name", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    
    if (!game || !authUser) return;

    const gameRef = doc(db, "games", GAME_ID);
    const currentGame = (await getDoc(gameRef)).data() as Game; // Get latest state to avoid race conditions

    // Check if player is already in a team
    const isAlreadyInTeam = currentGame.teams.some(t => t.players.some(p => p.id === authUser.uid));
    if(isAlreadyInTeam) {
        toast({ title: "Already in a team", description: "You have already joined a team.", variant: "destructive" });
        return;
    }
    
    const teamIndex = currentGame.teams.findIndex((t) => t.name === teamName);
    if(teamIndex === -1) return;

    const team = currentGame.teams[teamIndex];

    if (team.players.length >= team.capacity) {
      toast({ title: "Team Full", description: `Sorry, ${teamName} is full.`, variant: "destructive" });
      return;
    }

    const newPlayer: Player = {
      id: authUser.uid,
      name: playerName,
      teamName: teamName,
      currentQuestionIndex: 0,
    };
    
    const updatedTeams = [...currentGame.teams];
    updatedTeams[teamIndex].players.push(newPlayer);

    await updateDoc(gameRef, { teams: updatedTeams });
    // Don't need to call setCurrentPlayer here, the onSnapshot listener will handle it.
  };

  const handleStartGame = async () => {
    if (!game) return;
    const totalPlayers = game.teams.reduce((sum, t) => sum + t.players.length, 0);
    if (totalPlayers === 0) {
        toast({ title: "No players!", description: "At least one player must join to start.", variant: "destructive" });
        return;
    }
    
    const gameRef = doc(db, "games", GAME_ID);
    await updateDoc(gameRef, { status: "starting" });

    try {
      let questionsToUse: Question[] = [];

      // If there are custom questions, use them.
      if (game.questions && game.questions.length > 0) {
        questionsToUse = game.questions;
      } else {
        // Otherwise, generate questions with AI.
        const neededQuestions = totalPlayers * QUESTIONS_PER_PLAYER;
        const result = await generateQuestionsAction({
            topic: game.topic || "General Knowledge",
            difficulty: game.difficulty || "medium",
            numberOfQuestions: neededQuestions,
        });
        if (result.questions) {
            questionsToUse = result.questions;
        } else {
            throw new Error("AI failed to generate questions.");
        }
      }

       await updateDoc(gameRef, {
          questions: questionsToUse,
          status: 'playing',
          gameStartedAt: serverTimestamp(),
          // Reset player question index on start
          teams: game.teams.map(team => ({
            ...team,
            players: team.players.map(p => ({ ...p, currentQuestionIndex: 0 }))
          }))
       });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error Starting Game",
        description: "Could not prepare trivia questions. Please check session settings and try again.",
        variant: "destructive",
      });
      await updateDoc(gameRef, { status: "lobby" }); // Revert status
    }
  };

  const handleAnswer = async (question: Question, answer: string) => {
    if (!game || !currentPlayer) return;

    // Use a transaction or a fresh read to prevent race conditions. For simplicity, we'll assume onSnapshot is fast enough.
    const isCorrect = question.answer.trim().toLowerCase() === answer.trim().toLowerCase();
    
    const gameRef = doc(db, "games", GAME_ID);
    const currentGame = (await getDoc(gameRef)).data() as Game;

    const teamIndex = currentGame.teams.findIndex(t => t.name === currentPlayer.teamName);
    if (teamIndex === -1) return;

    const playerIndex = currentGame.teams[teamIndex].players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex === -1) return;
    
    const updatedTeams = [...currentGame.teams];
    const teamToUpdate = updatedTeams[teamIndex];
    const playerToUpdate = teamToUpdate.players[playerIndex];

    // Only update score and index if the player hasn't already answered this question
    // (This check helps prevent multiple submissions for the same question)
    const questionToAnswerIndex = playerToUpdate.currentQuestionIndex;
    const totalQuestionsForPlayer = game.questions.length > 0 ? QUESTIONS_PER_PLAYER : 0;

    if (questionToAnswerIndex < totalQuestionsForPlayer) {
      const updatedScore = isCorrect ? teamToUpdate.score + 10 : teamToUpdate.score;
      teamToUpdate.score = updatedScore;
      playerToUpdate.currentQuestionIndex = questionToAnswerIndex + 1;
    }
    
    await updateDoc(gameRef, { teams: updatedTeams });
  };
  
  // This function checks if all players have completed their questions and ends the game.
  const checkGameCompletion = useCallback(async () => {
    if (!game || game.status !== 'playing') return;

    const totalPlayers = game.teams.flatMap(t => t.players).length;
    if (totalPlayers === 0) return; // Don't end game if no one is playing.

    const allPlayersFinished = game.teams.flatMap(t => t.players).every(p => p.currentQuestionIndex >= QUESTIONS_PER_PLAYER);
    
    if (allPlayersFinished) {
      await updateDoc(doc(db, "games", GAME_ID), { status: "finished" });
    }
  }, [game, GAME_ID]);

  useEffect(() => {
    // Run the completion check whenever the game state (specifically player progress) changes.
    checkGameCompletion();
  }, [game?.teams, checkGameCompletion]);

  const handleTimeout = async () => {
    // Only trigger timeout if the game is currently 'playing'
    if(game?.status === 'playing') {
      await updateDoc(doc(db, "games", GAME_ID), { status: "finished" });
      toast({
        title: "Time's Up!",
        description: `The game timer has expired.`,
      });
    }
  };

  // Resets the game to the lobby state, clearing scores and players.
  const handlePlayAgain = async () => {
    if (!game) return;
    await updateDoc(doc(db, "games", GAME_ID), {
      status: "lobby",
      teams: game.teams.map(t => ({ // Keep team structure, but clear players and score
          name: t.name,
          capacity: t.capacity,
          score: 0, 
          players: [] 
      })),
      questions: [],
      gameStartedAt: null,
    });
    // Don't need to setCurrentPlayer(null), onSnapshot will do it.
  };

  const renderContent = () => {
    if (loading || !game) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h1 className="text-4xl font-bold mt-4 font-display">
                {loading ? 'Finding Session...' : 'Session Not Found'}
            </h1>
            <p className="text-muted-foreground mt-2">
                {loading ? 'Verifying your session PIN...' : 'The session PIN you entered is invalid. Please check the PIN and try again.'}
            </p>
        </div>
      )
    }

    switch (game.status) {
      case "lobby":
        return (
          <Lobby
            teams={game.teams}
            onJoinTeam={handleJoinTeam}
            onStartGame={handleStartGame}
            currentPlayer={currentPlayer}
            isAdmin={isAdmin}
          />
        );
      case "starting":
        return (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h1 className="text-4xl font-bold mt-4 font-display">Generating Questions...</h1>
            <p className="text-muted-foreground mt-2">Get ready for battle!</p>
          </div>
        );
      case "playing":
        if (!currentPlayer) {
            return (
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                    <h1 className="text-4xl font-bold font-display">Game in Progress</h1>
                    <p className="text-muted-foreground mt-2">A game is currently being played. You can join the next round once this one is finished.</p>
                </div>
            );
        }
        
        const playerTeam = game.teams.find((t) => t.name === currentPlayer.teamName);
        if (!playerTeam) return <p>Error: Your team could not be found.</p>;
        
        const playerState = playerTeam.players.find(p => p.id === currentPlayer.id);
        if (!playerState) return <p>Error: Could not find your player state.</p>;
        
        // This logic determines which question the player should see.
        // It's crucial for multiplayer turn-based gameplay.
        // It finds the player's team index and their index within the team to calculate
        // a unique question index from the global questions array.
        const teamIndex = game.teams.findIndex(t => t.name === playerTeam.name);
        const playerIndexInTeam = playerTeam.players.findIndex(p => p.id === currentPlayer.id);
        const questionsPerTeam = Math.floor(game.questions.length / game.teams.length);
        const baseQuestionIndex = teamIndex * questionsPerTeam;
        const playerQuestionOffset = playerIndexInTeam * QUESTIONS_PER_PLAYER;
        
        const currentQuestionIndex = baseQuestionIndex + playerQuestionOffset + playerState.currentQuestionIndex;

        const currentQuestion = game.questions[currentQuestionIndex];
        const gameDuration = game.timer || 300;

        if (playerState.currentQuestionIndex >= QUESTIONS_PER_PLAYER) {
           return (
             <div className="flex flex-col items-center justify-center flex-1 text-center">
               <h1 className="text-4xl font-bold font-display">You've finished your questions!</h1>
               <p className="text-muted-foreground mt-2">Waiting for other players to finish...</p>
             </div>
           );
        }
        
        if (!currentQuestion) {
             return (
             <div className="flex flex-col items-center justify-center flex-1 text-center">
               <h1 className="text-4xl font-bold font-display">Waiting...</h1>
               <p className="text-muted-foreground mt-2">There may not be enough questions for all players. Waiting for admin to resolve.</p>
             </div>
           );
        }

        return (
          <GameScreen
            teams={game.teams}
            currentPlayer={currentPlayer}
            question={currentQuestion}
            onAnswer={handleAnswer}
            onNextQuestion={() => {}} // Next question is auto-handled by `onAnswer`
            duration={gameDuration}
            onTimeout={handleTimeout}
            gameStartedAt={game.gameStartedAt}
          />
        );
      case "finished":
        return <ResultsScreen teams={game.teams} onPlayAgain={handlePlayAgain} isAdmin={isAdmin} />;
      default:
        // This is a fallback for any unexpected game status
        return <div className="text-center">Unknown game state.</div>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex-1 flex flex-col">
      {renderContent()}
    </div>
  );
}

    