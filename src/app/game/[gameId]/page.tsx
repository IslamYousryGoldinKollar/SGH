
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  Player,
  Question,
  Game,
  Team,
  GridSquare,
  EmojiEvent,
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
import ColorGridScreen from "@/components/game/ColorGridScreen";
import ResultsScreen from "@/components/game/ResultsScreen";
import PreGameCountdown from "@/components/game/PreGameCountdown";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { v4 as uuidv4 } from "uuid";

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
      <div className="text-center">
        <h1 className="text-5xl font-bold font-display">{game.title}</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Enter your details to start the challenge. You will have{" "}
          {Math.floor(game.timer / 60)} minutes to answer questions
          and capture territory.
        </p>
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

const MatchmakingLobby = ({
  onJoinQueue,
  isJoining,
}: {
  onJoinQueue: (name: string, id: string) => void;
  isJoining: boolean;
}) => {
  const [playerName, setPlayerName] = useState("");
  const [idNumber, setIdNumber] = useState("");

  const handleJoin = () => {
    if (!playerName.trim() || !idNumber.trim()) {
      alert("Please enter your name and ID.");
      return;
    }
    onJoinQueue(playerName.trim(), idNumber.trim());
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <div className="text-center">
        <Swords className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-5xl font-bold font-display">1v1 Challenge</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Enter your name and ID to find a worthy opponent. The battle
          begins soon!
        </p>
      </div>
      <div className="my-8 w-full max-w-md space-y-4">
        <div className="space-y-2">
          <Label htmlFor="playerName" className="sr-only">
            Full Name
          </Label>
          <Input
            id="playerName"
            type="text"
            placeholder="Enter your full name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="text-lg p-6 w-full text-center"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="idNumber" className="sr-only">
            ID Number
          </Label>
          <Input
            id="idNumber"
            type="text"
            placeholder="Enter your ID number"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="text-lg p-6 w-full text-center"
          />
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={handleJoin}
          disabled={
            isJoining || !playerName.trim() || !idNumber.trim()
          }
        >
          {isJoining ? (
            <Loader2 className="animate-spin" />
          ) : (
            "Find Match"
          )}
        </Button>
      </div>
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
  const [view, setView] = useState<"question" | "grid">("question");
  const [isJoining, setIsJoining] = useState(false);

  // When a 1v1 countdown finishes, update status to 'playing'
  const handleCountdownFinish = useCallback(async () => {
    if (game?.status === 'starting') {
      // The game status is now derived from the server, so we just
      // need to ensure the local state reflects the correct view.
      // The main useEffect handles setting the view.
    }
  }, [game?.status]);


  useEffect(() => {
    if (game?.theme) {
       if (typeof game.theme === 'object') {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", game.theme);
      }
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
            
        // Only update player state if it has meaningfully changed
        if (JSON.stringify(player) !== JSON.stringify(currentPlayer)) {
           setCurrentPlayer(player);
        }
        
        if (gameData.status === 'playing' && !player && gameData.parentSessionId) {
             toast({ title: "Game in progress", description: "This match has already started.", variant: "destructive"});
             router.replace(`/game/${gameData.parentSessionId}`);
             return;
        }

        setLoading(false);
      } else {
        setGame(null);
        setCurrentPlayer(null);
        setLoading(false);
      }
    }, (error) => {
        console.error("Error fetching game:", error);
        setLoading(false);
    });

    return () => unsubGame();
  }, [gameId, authUser, toast, router, currentPlayer]);

  const handleTimeout = useCallback(async () => {
    if (game?.status === "playing" && (isAdmin || game.sessionType === 'individual' || !!game.parentSessionId)) {
      const gameRef = doc(db, "games", gameId);
      await updateDoc(gameRef, { status: "finished" });
    }
  }, [game, isAdmin, gameId]);

  const getNextQuestion = useCallback(() => {
    if (!game || !currentPlayer) return null;
    const answered = currentPlayer.answeredQuestions || [];
    const availableQuestions = game.questions.filter(
      (q) => !answered.includes(q.question)
    );
    if (availableQuestions.length === 0) return null;
    const randomIndex = Math.floor(
      Math.random() * availableQuestions.length
    );
    return availableQuestions[randomIndex];
  }, [game, currentPlayer]);

  // Effect to determine the view (question or grid)
  useEffect(() => {
    if (!game || !currentPlayer || game.status !== 'playing') return;

    if (currentPlayer.coloringCredits > 0) {
      setView("grid");
      return;
    }

    const nextQ = getNextQuestion();
    if (nextQ) {
      if (currentQuestion?.question !== nextQ.question) {
        setCurrentQuestion(nextQ);
      }
      setView("question");
    } else {
      setCurrentQuestion(null);
      setView("question");
      // If no credits and no questions, the game might be over for this player
    }
  // This effect should ONLY run when the player's direct state changes.
  }, [currentPlayer?.answeredQuestions, currentPlayer?.coloringCredits, game, getNextQuestion, currentQuestion]);


  // Effect for game timeout
  useEffect(() => {
    if (game?.status === 'playing') {
      const gameStartTime = game.gameStartedAt?.toMillis();
      if (gameStartTime && game.timer) {
        const endTime = gameStartTime + game.timer * 1000;
        const now = Date.now();
        if (now >= endTime) {
          handleTimeout();
        } else {
          const timeoutId = setTimeout(handleTimeout, endTime - now);
          return () => clearTimeout(timeoutId);
        }
      }
    }
  }, [game?.status, game?.gameStartedAt, game?.timer, handleTimeout]);


  const handleFindMatch = async (playerName: string, playerId: string) => {
    if (!game || !authUser) return;
    setIsJoining(true);

    try {
        // 1. Find an open lobby
        const q = query(
            collection(db, "games"),
            where("parentSessionId", "==", game.id),
            where("status", "==", "lobby"),
            orderBy("createdAt", "asc"),
            limit(1)
        );
        const openLobbies = await getDocs(q);

        if (openLobbies.docs.length > 0) {
            // 2a. Found a lobby, join it
            const lobbyDoc = openLobbies.docs[0];
            const lobbyGameRef = lobbyDoc.ref;

            await runTransaction(db, async (transaction) => {
                const lobbyGameSnap = await transaction.get(lobbyGameRef);
                if (!lobbyGameSnap.exists()) throw new Error("Lobby closed.");
                const lobbyGame = lobbyGameSnap.data() as Game;
                if (lobbyGame.teams[0].players.length !== 1) throw new Error("Lobby is no longer available.");

                const opponent = lobbyGame.teams[0].players[0];

                const newPlayer: Player = {
                    id: authUser.uid,
                    playerId,
                    name: playerName,
                    teamName: `Team ${playerName}`,
                    answeredQuestions: [],
                    coloringCredits: 0,
                    score: 0,
                };
                
                const updatedTeams: Team[] = [
                    { ...lobbyGame.teams[0], name: `Team ${opponent.name}` },
                    { 
                        name: `Team ${newPlayer.name}`,
                        score: 0, 
                        players: [newPlayer], 
                        capacity: 1,
                        color: "#4682B4", // Team Bravo color
                        icon: "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fblue.png?alt=media&token=0cd4ea1b-4005-4101-950f-a04500d708dd",
                    }
                ];
                
                const startTime = new Date(Date.now() + 5000);

                transaction.update(lobbyGameRef, {
                    teams: updatedTeams,
                    title: `1v1: ${opponent.name} vs ${newPlayer.name}`,
                    status: "starting",
                    gameStartedAt: Timestamp.fromDate(startTime)
                });
            });

            router.push(`/game/${lobbyDoc.id}`);

        } else {
            // 2b. No lobby found, create one
            const newGameId = `${game.id}-${generatePin()}`;
            const newGameRef = doc(db, "games", newGameId);
            const templateGame = game;

            const newPlayer: Player = {
                id: authUser.uid,
                playerId,
                name: playerName,
                teamName: `Team ${playerName}`,
                answeredQuestions: [],
                coloringCredits: 0,
                score: 0,
            };

            const newGame: Omit<Game, "id"> = {
                ...templateGame,
                title: `1v1 Lobby - Waiting...`,
                status: "lobby",
                parentSessionId: game.id,
                sessionType: 'team',
                teams: [
                    { 
                        name: `Team ${newPlayer.name}`, 
                        score: 0, 
                        players: [newPlayer], 
                        capacity: 1, 
                        color: "#FF6347", // Team Alpha color
                        icon: "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fred.png?alt=media&token=8dee418c-6d1d-4558-84d2-51909b71a258"
                    }
                ],
                createdAt: serverTimestamp() as Timestamp,
                gameStartedAt: null,
            };
            
            await setDoc(newGameRef, newGame);
            router.push(`/game/${newGameId}`);
        }
    } catch(error: any) {
        console.error("Error finding match:", error);
        toast({ title: "Matchmaking Error", description: error.message, variant: "destructive" });
        setIsJoining(false);
    }
  }


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

    try {
      const newGameId = `${gameId}-${authUser.uid.slice(0, 5)}-${generatePin()}`;
      const newGameRef = doc(db, "games", newGameId);
      const templateGameRef = doc(db, "games", gameId);

      let templateGameData = game;

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
      await updateDoc(gameRef, {
        questions: questionsToUse,
        status: "playing",
        gameStartedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error Starting Game",
        description: "Could not prepare questions.",
        variant: "destructive",
      });
      await updateDoc(gameRef, { status: "lobby" });
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
          playerToUpdate.coloringCredits += 1;
        } else if (currentGame.sessionType === "individual" || currentGame.parentSessionId) { // Penalty applies in 1v1 too
          const playerGridSquares = currentGame.grid
            .map((sq, i) => ({ ...sq, originalIndex: i }))
            .filter((sq) => sq.coloredBy === playerToUpdate.teamName);

          if (playerGridSquares.length > 0) {
            const randomIndex = Math.floor(
              Math.random() * playerGridSquares.length
            );
            const hexToClear = playerGridSquares[randomIndex];
            currentGame.grid[hexToClear.originalIndex].coloredBy =
              null;
            transaction.update(gameRef, { grid: currentGame.grid });
          }
        }
        transaction.update(gameRef, { teams: updatedTeams });
      });
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  };

  const handleNextQuestion = () =>
    setCurrentQuestion(getNextQuestion());

  const handleColorSquare = async (squareId: number) => {
    if (!game || !currentPlayer || !authUser) return;
    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, "games", gameId);
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game does not exist!");
        const currentGame = gameDoc.data() as Game;

        const playerTeamIndex = currentGame.teams.findIndex(
          (t) => t.name === currentPlayer.teamName
        );
        if (playerTeamIndex === -1)
          throw new Error("Could not find player's team.");
        const playerIndex =
          currentGame.teams[playerTeamIndex].players.findIndex(
            (p) => p.id === currentPlayer.id
          );
        if (playerIndex === -1)
          throw new Error("Could not find player data.");

        let currentGrid = currentGame.grid;

        const playerToUpdate =
          currentGame.teams[playerTeamIndex].players[playerIndex];
        if (playerToUpdate.coloringCredits <= 0)
          throw new Error("You have no coloring credits.");

        const squareIndex = currentGrid.findIndex(
          (s) => s.id === squareId
        );
        if (squareIndex === -1)
          throw new Error("Square not found.");

        const coloredByName = playerToUpdate.teamName;

        if (currentGrid[squareIndex].coloredBy === coloredByName)
          return;

        playerToUpdate.coloringCredits -= 1;
        
        if (currentGrid[squareIndex].coloredBy) {
          const originalOwnerTeamIndex = currentGame.teams.findIndex(
            (t) => t.name === currentGrid[squareIndex].coloredBy
          );
          if (originalOwnerTeamIndex !== -1) {
            currentGame.teams[originalOwnerTeamIndex].score = Math.max(
              0,
              currentGame.teams[originalOwnerTeamIndex].score - 1
            );
          }
        }
        
        currentGame.teams[playerTeamIndex].score += 1;
        currentGrid[squareIndex].coloredBy = coloredByName;

        const isGridFull = currentGrid.every(
          (s) => s.coloredBy !== null
        );

        transaction.update(gameRef, {
          grid: currentGrid,
          teams: currentGame.teams,
          status: isGridFull ? "finished" : currentGame.status,
        });
      });
      setView("question");
    } catch (error: any) {
      console.error("Failed to color square: ", error);
      toast({
        title: "Error Coloring Square",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSendEmoji = async (emoji: string) => {
    if (!game || !authUser) return;
    const gameRef = doc(db, "games", game.id);
    const newEmojiEvent: EmojiEvent = {
      id: uuidv4(),
      senderId: authUser.uid,
      emoji,
      timestamp: Timestamp.now(),
    };
    await updateDoc(gameRef, {
      emojiEvents: arrayUnion(newEmojiEvent),
    });
  };

  const handleSkipColoring = () => {
    setView("question");
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <h1 className="mt-4 text-4xl font-bold font-display">
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

    if (
      game.sessionType === "matchmaking" &&
      !currentPlayer && !game.parentSessionId
    ) {
      return (
        <MatchmakingLobby
          onJoinQueue={handleFindMatch}
          isJoining={isJoining}
        />
      );
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

     if (game.status === "lobby" || (['playing', 'finished'].includes(game.status) && !currentPlayer && !game.parentSessionId)) {
        if (['playing', 'finished'].includes(game.status) && !currentPlayer && !game.parentSessionId) {
         return (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <h1 className="text-4xl font-bold font-display">
              Game in Progress
            </h1>
            <p className="mt-2 text-muted-foreground">
              A game is currently being played. You can join the next round.
            </p>
          </div>
        );
      }
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
        const gameStartTime = game.gameStartedAt?.toMillis();
        const countdownActive = gameStartTime && gameStartTime > Date.now();
        if (game.parentSessionId && currentPlayer && countdownActive) {
            return <PreGameCountdown gameStartedAt={game.gameStartedAt} onFinish={handleCountdownFinish} />;
        }
        return (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h1 className="text-4xl font-bold mt-4 font-display">Generating Questions...</h1>
            <p className="text-muted-foreground mt-2">Get ready for battle!</p>
            </div>
        )
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
        
        if (view === "grid") {
          return (
            <ColorGridScreen
              grid={game.grid}
              teams={game.teams}
              onColorSquare={handleColorSquare}
              teamColoring={playerTeam.color}
              credits={currentPlayer.coloringCredits}
              onSkip={handleSkipColoring}
              sessionType={game.sessionType}
              playerId={currentPlayer.teamName}
            />
          );
        }
        if (!currentQuestion) {
           if (currentPlayer.coloringCredits > 0) {
                setView('grid');
                return null;
            }
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
            onSendEmoji={handleSendEmoji}
            emojiEvents={game.emojiEvents}
          />
        );
      case "finished":
        return (
          <ResultsScreen
            teams={game.teams}
            onPlayAgain={() => {}}
            isAdmin={isAdmin}
            individualPlayerId={game.sessionType === 'individual' ? currentPlayer?.id : undefined}
            parentSessionId={game.parentSessionId}
            gameId={game.id}
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
