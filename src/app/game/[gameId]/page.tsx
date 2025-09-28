
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Player, Question, Game, Team, GridSquare } from "@/lib/types";
import { generateQuestionsAction }from "@/lib/actions";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";

import Lobby from "@/components/game/Lobby";
import GameScreen from "@/components/game/GameScreen";
import ColorGridScreen from "@/components/game/ColorGridScreen";
import ResultsScreen from "@/components/game/ResultsScreen";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";


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
  const [view, setView] = useState<'question' | 'grid'>('question');

  useEffect(() => {
    // Apply theme from game data
    if (game?.theme) {
      document.documentElement.setAttribute('data-theme', game.theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [game?.theme]);


  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthUser(user);
        // Admin check will now happen inside the game snapshot useEffect
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in error", error);
          toast({ title: "Authentication Error", description: "Could not sign in.", variant: "destructive" });
        });
      }
    });

    return () => unsubAuth();
  }, [toast]);

  useEffect(() => {
    if (!GAME_ID) return;
    const gameRef = doc(db, "games", GAME_ID);
    const unsubGame = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const gameData = { id: docSnap.id, ...docSnap.data() } as Game;
        
        // Check for admin status
        if (authUser && gameData.adminId === authUser.uid) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
        
        const scores = new Map<string, number>();
        gameData.teams.forEach(team => {
            const teamGridScore = gameData.grid?.filter(sq => sq.coloredBy === team.name).length || 0;
            const teamAnswerScore = team.players.reduce((sum, p) => sum + p.score, 0);
            scores.set(team.name, teamGridScore + teamAnswerScore);
        });

        gameData.teams.forEach(team => {
            team.score = scores.get(team.name) || 0;
        });

        setGame(gameData);
        
        if (authUser) {
          const player = gameData.teams?.flatMap(t => t.players).find(p => p.id === authUser.uid);
          setCurrentPlayer(player || null);
        }
      } else {
        toast({ title: "Game not found", description: "This game session does not exist.", variant: "destructive" });
        setGame(null);
      }
      setLoading(false);
    });

    return () => unsubGame();
  }, [GAME_ID, authUser, toast]);

 const handleJoinTeam = async (playerName: string, playerId: string, teamName: string) => {
    if (!playerName.trim()) {
      toast({ title: "Invalid Name", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    
    if (!game || !authUser) return;

    const gameRef = doc(db, "games", GAME_ID);
    
    await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw "Game does not exist!";
        
        const currentGame = gameDoc.data() as Game;

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
          playerId: playerId,
          name: playerName,
          teamName: teamName,
          answeredQuestions: [],
          coloringCredits: 0,
          score: 0,
        };
        
        const updatedTeams = [...currentGame.teams];
        updatedTeams[teamIndex].players.push(newPlayer);

        transaction.update(gameRef, { teams: updatedTeams });
    });
  };

  const handleStartGame = async () => {
    if (!game) return;
    if (!isAdmin) {
      toast({ title: "Not Authorized", description: "Only the session admin can start the game.", variant: "destructive"});
      return;
    }

    const totalPlayers = game.teams.reduce((sum, t) => sum + t.players.length, 0);
    if (totalPlayers === 0) {
        toast({ title: "No players!", description: "At least one player must join to start.", variant: "destructive" });
        return;
    }
    
    const gameRef = doc(db, "games", GAME_ID);
    await updateDoc(gameRef, { status: "starting" });

    try {
      let questionsToUse: Question[] = game.questions || [];

      if (questionsToUse.length === 0) {
        const result = await generateQuestionsAction({
            topic: game.topic || "General Knowledge",
            numberOfQuestions: 20, // Generate a pool of 20 questions
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
          teams: game.teams.map(team => ({
            ...team,
            players: team.players.map(p => ({ ...p, answeredQuestions: [], coloringCredits: 0, score: 0 })),
            score: 0
          }))
       });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error Starting Game",
        description: "Could not prepare trivia questions. Please check session settings and try again.",
        variant: "destructive",
      });
      await updateDoc(gameRef, { status: "lobby" });
    }
  };

  const getNextQuestion = useCallback(() => {
    if (!game || !currentPlayer) return null;
    
    const answered = currentPlayer.answeredQuestions || [];
    const allQuestionsAnswered = answered.length >= game.questions.length;
    if (allQuestionsAnswered) return null;

    const availableQuestions = game.questions.filter(
        q => !answered.includes(q.question)
    );

    if (availableQuestions.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    return availableQuestions[randomIndex];
  }, [game, currentPlayer]);

  useEffect(() => {
    if (game?.status !== 'playing' || !currentPlayer) {
      return;
    }
  
    // Logic for view switching and fetching new questions
    if (currentPlayer.coloringCredits > 0) {
      setView('grid');
    } else {
      if (!currentQuestion) {
        setCurrentQuestion(getNextQuestion());
      }
      setView('question');
    }
  }, [game?.status, currentPlayer, currentQuestion, getNextQuestion]);


  const handleAnswer = async (question: Question, answer: string) => {
    if (!game || !currentPlayer) return;

    const isCorrect = question.answer.trim().toLowerCase() === answer.trim().toLowerCase();
    
    const gameRef = doc(db, "games", GAME_ID);
    
    await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw "Game does not exist!";
        const currentGame = gameDoc.data() as Game;

        const teamIndex = currentGame.teams.findIndex(t => t.name === currentPlayer.teamName);
        if (teamIndex === -1) return;

        const playerIndex = currentGame.teams[teamIndex].players.findIndex(p => p.id === currentPlayer.id);
        if (playerIndex === -1) return;
        
        const updatedTeams = [...currentGame.teams];
        const playerToUpdate = updatedTeams[teamIndex].players[playerIndex];

        playerToUpdate.answeredQuestions = [...(playerToUpdate.answeredQuestions || []), question.question];

        if (isCorrect) {
            playerToUpdate.coloringCredits += 1;
            playerToUpdate.score += 1; // Add 1 point for a correct answer
        }
        
        transaction.update(gameRef, { teams: updatedTeams });
    });

    // We don't need to manually set the view here. The useEffect hook will react
    // to the `currentPlayer` state update from Firestore and switch the view.
    if (!isCorrect) {
       // If wrong, immediately fetch the next question to show after feedback animation
        setCurrentQuestion(getNextQuestion());
    }
  };
  
  const handleColorSquare = async (squareId: number) => {
    if (!game || !currentPlayer) return;
    
    const gameRef = doc(db, "games", GAME_ID);

    try {
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw "Game does not exist!";
        const currentGame = gameDoc.data() as Game;

        const teamIndex = currentGame.teams.findIndex(t => t.name === currentPlayer.teamName);
        if (teamIndex === -1) throw "Team not found!";
        
        const playerIndex = currentGame.teams[teamIndex].players.findIndex(p => p.id === currentPlayer.id);
        if (playerIndex === -1) throw "Player not found!";
        
        const playerToUpdate = currentGame.teams[teamIndex].players[playerIndex];
        
        if (playerToUpdate.coloringCredits <= 0) {
            toast({ title: "No credits!", description: "Answer more questions correctly to earn credits.", variant: "destructive" });
            throw "No coloring credits!";
        }

        const squareIndex = currentGame.grid.findIndex(s => s.id === squareId);
        if (squareIndex === -1) throw "Square not found!";
        
        if (currentGame.grid[squareIndex].coloredBy) {
            toast({ title: "Already colored!", description: "This square has already been claimed.", variant: "destructive" });
            throw "Square already colored!";
        }

        const updatedGrid = [...currentGame.grid];
        updatedGrid[squareIndex].coloredBy = currentPlayer.teamName;
        
        const updatedTeams = [...currentGame.teams];
        updatedTeams[teamIndex].players[playerIndex].coloringCredits -= 1;
        updatedTeams[teamIndex].players[playerIndex].score += 1; // Add 1 point for coloring a square

        transaction.update(gameRef, { grid: updatedGrid, teams: updatedTeams });
      });

      // After coloring, fetch next question and the useEffect will switch the view
      setCurrentQuestion(getNextQuestion());

    } catch (error: any) {
        console.error("Failed to color square: ", error);
        if (error.message && !error.message.includes('No coloring credits') && !error.message.includes('Square already colored')) {
            toast({ title: "Error", description: "Could not color the square. Please try again.", variant: "destructive" });
        }
    }
  };

  const handleTimeout = async () => {
    if(game?.status === 'playing' && isAdmin) {
      await updateDoc(doc(db, "games", GAME_ID), { status: "finished" });
      toast({
        title: "Time's Up!",
        description: `The game timer has expired.`,
      });
    }
  };
  
   const handleSkipColoring = () => {
    setCurrentQuestion(getNextQuestion());
    setView('question');
  };

  const handlePlayAgain = async () => {
    if (!game || !isAdmin) return;
    const initialGrid: GridSquare[] = Array.from({ length: 22 }, (_, i) => ({ id: i, coloredBy: null }));
    
    await updateDoc(doc(db, "games", GAME_ID), {
      status: "lobby",
      teams: game.teams.map(t => ({
          name: t.name,
          capacity: t.capacity,
          color: t.color,
          icon: t.icon,
          score: 0, 
          players: [],
      })),
      grid: initialGrid,
      gameStartedAt: null,
    });
    setCurrentQuestion(null);
    setView('question');
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
      case "starting":
        return (
          <Lobby
            game={game}
            onJoinTeam={handleJoinTeam}
            onStartGame={handleStartGame}
            currentPlayer={currentPlayer}
            isAdmin={isAdmin}
          />
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
        
        if (view === 'grid') {
             return (
                <ColorGridScreen 
                    grid={game.grid}
                    teams={game.teams}
                    onColorSquare={handleColorSquare}
                    teamColoring={playerTeam.color}
                    credits={currentPlayer.coloringCredits}
                    onSkip={handleSkipColoring}
                />
            );
        }

        if (!currentQuestion) {
             return (
             <div className="flex flex-col items-center justify-center flex-1 text-center">
               <h1 className="text-4xl font-bold font-display">You've answered all available questions!</h1>
               <p className="text-muted-foreground mt-2">Great job! Waiting for the game to end...</p>
             </div>
           );
        }

        return (
          <GameScreen
            teams={game.teams}
            currentPlayer={currentPlayer}
            question={currentQuestion}
            onAnswer={handleAnswer}
            duration={game.timer || 300}
            onTimeout={handleTimeout}
            gameStartedAt={game.gameStartedAt}
          />
        );
      case "finished":
        return <ResultsScreen teams={game.teams} onPlayAgain={handlePlayAgain} isAdmin={isAdmin} />;
      default:
        return <div className="text-center">Unknown game state.</div>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex-1 flex flex-col">
      {renderContent()}
    </div>
  );
}
