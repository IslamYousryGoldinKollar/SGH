"use client";

import { useState, useEffect, useCallback } from "react";
import type { Team, Player, Question, GameStatus, Game } from "@/lib/types";
import { generateQuestionsAction }from "@/lib/actions";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, setDoc } from "firebase/firestore";

import Lobby from "@/components/game/Lobby";
import GameScreen from "@/components/game/GameScreen";
import ResultsScreen from "@/components/game/ResultsScreen";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const GAME_ID = "main_game"; 
const GAME_DURATION = 5 * 60; // 5 minutes
const QUESTIONS_PER_PLAYER = 2;


export default function Home() {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const gameRef = doc(db, "games", GAME_ID);
    const unsub = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        setGame(docSnap.data() as Game);
      } else {
        // Game doc doesn't exist, create it
        const newGame: Game = {
            id: GAME_ID,
            status: "lobby",
            teams: [
              { name: "Team Alpha", score: 0, players: [] },
              { name: "Team Bravo", score: 0, players: [] },
            ],
            questions: [],
            createdAt: serverTimestamp() as any,
            gameStartedAt: null,
        };
        setDoc(gameRef, newGame).then(() => setGame(newGame));
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleJoinTeam = async (playerName: string, teamName: string) => {
    if (!playerName.trim()) {
      toast({
        title: "Invalid Name",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }
    
    if (!game) return;

    const team = game.teams.find((t) => t.name === teamName);
    if (team && team.players.length >= 10) {
      toast({
        title: "Team Full",
        description: `Sorry, ${teamName} already has 10 players.`,
        variant: "destructive",
      });
      return;
    }

    const newPlayer: Player = {
      id: uuidv4(),
      name: playerName,
      teamName: teamName,
      currentQuestionIndex: 0,
    };
    
    const updatedTeams = game.teams.map(t => 
        t.name === teamName 
            ? { ...t, players: [...t.players, newPlayer] } 
            : t
    );

    await updateDoc(doc(db, "games", GAME_ID), { teams: updatedTeams });
    setCurrentPlayer(newPlayer);
  };

  const handleStartGame = async () => {
    if (!game) return;
    const totalPlayers = game.teams.reduce((sum, t) => sum + t.players.length, 0);
    if (totalPlayers === 0) {
        toast({ title: "No players!", description: "At least one player must join to start.", variant: "destructive" });
        return;
    }
    
    await updateDoc(doc(db, "games", GAME_ID), { status: "starting" });

    try {
      const neededQuestions = totalPlayers * QUESTIONS_PER_PLAYER;
      const result = await generateQuestionsAction({
        topic: "General Knowledge",
        difficulty: "medium",
        numberOfQuestions: neededQuestions,
      });

      if (result.questions) {
         const gameRef = doc(db, "games", GAME_ID);
         await updateDoc(gameRef, {
            questions: result.questions,
            status: 'playing',
            gameStartedAt: serverTimestamp(),
            teams: game.teams.map(team => ({
              ...team,
              players: team.players.map(p => ({ ...p, currentQuestionIndex: 0 }))
            }))
         });
      } else {
        throw new Error("Failed to generate questions.");
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error Starting Game",
        description: "Could not generate trivia questions. Please try again.",
        variant: "destructive",
      });
      await updateDoc(doc(db, "games", GAME_ID), { status: "lobby" });
    }
  };

  const handleAnswer = async (question: Question, answer: string) => {
    if (!game || !currentPlayer) return;
    const isCorrect = question.answer.trim().toLowerCase() === answer.trim().toLowerCase();
    
    const teamIndex = game.teams.findIndex(t => t.name === currentPlayer.teamName);
    if (teamIndex === -1) return;

    const playerIndex = game.teams[teamIndex].players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex === -1) return;
    
    const updatedTeams = [...game.teams];
    const updatedScore = isCorrect ? updatedTeams[teamIndex].score + 10 : updatedTeams[teamIndex].score;
    updatedTeams[teamIndex] = {
      ...updatedTeams[teamIndex],
      score: updatedScore,
      players: updatedTeams[teamIndex].players.map((p, idx) => 
        idx === playerIndex ? { ...p, currentQuestionIndex: p.currentQuestionIndex + 1 } : p
      )
    };
    
    await updateDoc(doc(db, "games", GAME_ID), { teams: updatedTeams });
  };
  
  const handleNextQuestion = useCallback(async () => {
    if (!game || game.status !== 'playing') return;

    const allPlayersFinished = game.teams.flatMap(t => t.players).every(p => p.currentQuestionIndex >= QUESTIONS_PER_PLAYER);
    if (allPlayersFinished && game.teams.flatMap(t => t.players).length > 0) {
      await updateDoc(doc(db, "games", GAME_ID), { status: "finished" });
    }
  }, [game]);

  useEffect(() => {
    if (game?.status === 'playing') {
      handleNextQuestion();
    }
  }, [game, handleNextQuestion]);

  const handleTimeout = async () => {
    if(game?.status === 'playing') {
      await updateDoc(doc(db, "games", GAME_ID), { status: "finished" });
      toast({
        title: "Time's Up!",
        description: `The ${GAME_DURATION/60}-minute timer has expired.`,
      });
    }
  };

  const handlePlayAgain = async () => {
    await updateDoc(doc(db, "games", GAME_ID), {
      status: "lobby",
      teams: [
        { name: "Team Alpha", score: 0, players: [] },
        { name: "Team Bravo", score: 0, players: [] },
      ],
      questions: [],
      gameStartedAt: null,
    });
    setCurrentPlayer(null);
  };

  const renderContent = () => {
    if (loading || !game) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h1 className="text-4xl font-bold mt-4">Loading Game...</h1>
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
          />
        );
      case "starting":
        return (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h1 className="text-4xl font-bold mt-4">Generating Questions...</h1>
            <p className="text-muted-foreground mt-2">Get ready for battle!</p>
          </div>
        );
      case "playing":
        if (!currentPlayer) return (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
               <h1 className="text-4xl font-bold">Waiting for players...</h1>
               <p className="text-muted-foreground mt-2">The game is afoot!</p>
             </div>
        );
        const playerTeam = game.teams.find((t) => t.name === currentPlayer.teamName);
        if (!playerTeam) return <p>Error: Player's team not found.</p>;
        const playerState = playerTeam.players.find(p => p.id === currentPlayer.id);
        if (!playerState) return <p>Error: Player state not found.</p>;
        
        const teamIndex = game.teams.findIndex(t => t.name === playerTeam.name);
        const questionsPerTeam = game.questions.length / game.teams.length;
        const questionIndex = playerState.currentQuestionIndex + (teamIndex * questionsPerTeam);
        const currentQuestion = game.questions[questionIndex];
        
        if (playerState.currentQuestionIndex >= QUESTIONS_PER_PLAYER) {
           return (
             <div className="flex flex-col items-center justify-center flex-1 text-center">
               <h1 className="text-4xl font-bold">You've finished your questions!</h1>
               <p className="text-muted-foreground mt-2">Waiting for other players to finish...</p>
             </div>
           );
        }

        return (
          <GameScreen
            teams={game.teams}
            currentPlayer={currentPlayer}
            question={currentQuestion}
            onAnswer={handleAnswer}
            onNextQuestion={() => {}} // Next question is handled by answer
            duration={GAME_DURATION}
            onTimeout={handleTimeout}
            gameStartedAt={game.gameStartedAt}
          />
        );
      case "finished":
        return <ResultsScreen teams={game.teams} onPlayAgain={handlePlayAgain} />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex-1 flex flex-col">
      {renderContent()}
    </div>
  );
}
