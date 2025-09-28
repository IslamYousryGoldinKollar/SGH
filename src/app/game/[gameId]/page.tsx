
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Player, Question, Game, Team, GridSquare } from "@/lib/types";
import { generateQuestionsAction }from "@/lib/actions";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp, runTransaction, collection, addDoc } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";

import Lobby from "@/components/game/Lobby";
import GameScreen from "@/components/game/GameScreen";
import ColorGridScreen from "@/components/game/ColorGridScreen";
import ResultsScreen from "@/components/game/ResultsScreen";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const ADMIN_UIDS = ["qBMAWCoI5naA7P67tLqg2AbeV3t1", "DqPp28DfHAPTibRoMXNoPtj67Mt1"];

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
      setLoading(true);
      if (docSnap.exists()) {
        const gameData = { id: docSnap.id, ...docSnap.data() } as Game;
        
        if (authUser) {
            setIsAdmin(gameData.adminId === authUser.uid || ADMIN_UIDS.includes(authUser.uid));
            const player = gameData.teams?.flatMap(t => t.players).find(p => p.id === authUser.uid) || null;
            setCurrentPlayer(player);
        }
        
        setGame(gameData);
      } else {
        toast({ title: "Game not found", description: "This game session does not exist.", variant: "destructive" });
        setGame(null);
        setCurrentPlayer(null);
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
    
    try {
        const newPlayer: Player = {
          id: authUser.uid,
          playerId: playerId,
          name: playerName,
          teamName: teamName,
          answeredQuestions: [],
          coloringCredits: 0,
          score: 0,
        };

        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game does not exist!");
            
            const currentGame = gameDoc.data() as Game;

            const isAlreadyInTeam = currentGame.teams.some(t => t.players.some(p => p.id === authUser.uid));
            if(isAlreadyInTeam) {
                // This is a soft check. The UI should already prevent this.
                // We'll let the onSnapshot handle the UI update rather than throwing an error.
                return;
            }
            
            const teamIndex = currentGame.teams.findIndex((t) => t.name === teamName);
            if(teamIndex === -1) throw new Error("Team not found!");

            const team = currentGame.teams[teamIndex];

            if (team.players.length >= team.capacity) {
              throw new Error(`Sorry, ${teamName} is full.`);
            }
            
            const updatedTeams = [...currentGame.teams];
            updatedTeams[teamIndex].players.push(newPlayer);

            transaction.update(gameRef, { teams: updatedTeams });
        });

        const playerJoinsCollection = collection(db, "player_joins");
        await addDoc(playerJoinsCollection, {
            gameId: GAME_ID,
            playerName: playerName,
            playerId: playerId,
            teamName: teamName,
            joinedAt: serverTimestamp()
        });
        
        // Manually set the player state to force a re-render immediately
        setCurrentPlayer(newPlayer);

    } catch (error: any) {
        console.error("Error joining team: ", error);
        toast({
            title: "Could Not Join",
            description: error.message || "An unexpected error occurred. Please try again.",
            variant: "destructive"
        })
    }
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
        if (!gameDoc.exists()) throw new Error("Game does not exist!");
        const currentGame = gameDoc.data() as Game;

        const teamIndex = currentGame.teams.findIndex(t => t.name === currentPlayer.teamName);
        if (teamIndex === -1) return;

        const playerIndex = currentGame.teams[teamIndex].players.findIndex(p => p.id === currentPlayer.id);
        if (playerIndex === -1) return;
        
        const updatedTeams = [...currentGame.teams];
        const playerToUpdate = updatedTeams[teamIndex].players[playerIndex];
        const teamToUpdate = updatedTeams[teamIndex];

        playerToUpdate.answeredQuestions = [...(playerToUpdate.answeredQuestions || []), question.question];

        if (isCorrect) {
            playerToUpdate.coloringCredits += 1;
            playerToUpdate.score += 1;
            teamToUpdate.score += 1;
        }
        
        transaction.update(gameRef, { teams: updatedTeams });
    });

    // Let the QuestionCard's timeout and the useEffect hook handle fetching the next question
  };
  
  const handleNextQuestion = () => {
    setCurrentQuestion(getNextQuestion());
  };

  const handleColorSquare = async (squareId: number) => {
    if (!game || !currentPlayer) return;

    const gameRef = doc(db, "games", GAME_ID);

    try {
        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game does not exist!");

            const currentGame = gameDoc.data() as Game;
            const updatedTeams = JSON.parse(JSON.stringify(currentGame.teams)) as Team[];
            const updatedGrid = [...currentGame.grid];

            const playerTeamIndex = updatedTeams.findIndex(t => t.name === currentPlayer.teamName);
            if (playerTeamIndex === -1) throw new Error("Your team could not be found.");

            const playerIndex = updatedTeams[playerTeamIndex].players.findIndex(p => p.id === currentPlayer.id);
            if (playerIndex === -1) throw new Error("Could not find your player data.");

            const playerToUpdate = updatedTeams[playerTeamIndex].players[playerIndex];
            if (playerToUpdate.coloringCredits <= 0) throw new Error("You have no coloring credits.");

            const squareIndex = updatedGrid.findIndex(s => s.id === squareId);
            if (squareIndex === -1) throw new Error("Square not found.");
            
            const squareToUpdate = updatedGrid[squareIndex];
            const originalOwnerName = squareToUpdate.coloredBy;

            if (originalOwnerName === currentPlayer.teamName) {
                throw new Error("Your team already owns this square.");
            }

            // New Rule: Check if any free squares exist
            if (originalOwnerName) { // Trying to capture an owned square
                const hasFreeSquares = updatedGrid.some(s => s.coloredBy === null);
                if (hasFreeSquares) {
                    throw new Error("You can only capture free land while it's available.");
                }
            }
            
            // Update scores and ownership
            playerToUpdate.coloringCredits -= 1;
            playerToUpdate.score += 1;
            updatedTeams[playerTeamIndex].score += 1;
            squareToUpdate.coloredBy = currentPlayer.teamName;

            // If the square was previously owned, deduct score from the original owner team
            if (originalOwnerName) {
                const originalOwnerTeamIndex = updatedTeams.findIndex(t => t.name === originalOwnerName);
                if (originalOwnerTeamIndex !== -1) {
                    updatedTeams[originalOwnerTeamIndex].score -= 1;
                }
            }

            transaction.update(gameRef, { grid: updatedGrid, teams: updatedTeams });
        });

        setCurrentQuestion(getNextQuestion());

    } catch (error: any) {
        console.error("Failed to color square: ", error);
        toast({ title: "Error Coloring Square", description: error.message, variant: "destructive" });
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
    if (loading || !game || !authUser) {
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

    if (!currentPlayer && game.status !== 'lobby') {
       return (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
                <h1 className="text-4xl font-bold font-display">Game in Progress</h1>
                <p className="text-muted-foreground mt-2">A game is currently being played. You can join the next round once this one is finished.</p>
            </div>
        );
    }
    
    if (!currentPlayer) {
        return (
             <Lobby
                game={game}
                onJoinTeam={handleJoinTeam}
                onStartGame={handleStartGame}
                currentPlayer={null}
                isAdmin={isAdmin}
            />
        );
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
            onNextQuestion={handleNextQuestion}
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
