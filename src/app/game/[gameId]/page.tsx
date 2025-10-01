
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  Player,
  Question,
  Game,
  Team,
  GridSquare,
  MatchmakingTicket,
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
  const nameFieldId = game.requiredPlayerFields.find((f) =>
    f.label.toLowerCase().includes("name")
  )?.id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError("Please fill out your name.");
      return;
    }
    const otherFields = game.requiredPlayerFields.filter(
      (f) => f.id !== nameFieldId
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
    if (fieldId === nameFieldId) {
      setPlayerName(value);
    } else {
      setFormData((prev) => ({ ...prev, [fieldId]: value }));
    }
  };

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
            <div className="space-y-2">
              <Label htmlFor="player-name-field">Full Name</Label>
              <Input
                id="player-name-field"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                required
                className="text-lg p-6 w-full"
              />
            </div>
            {game.requiredPlayerFields
              .filter((f) => f.label.toLowerCase() !== "full name")
              .map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <Input
                    id={field.id}
                    type={field.type}
                    value={formData[field.id] || ""}
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
  onCancel,
  ticket,
}: {
  onJoinQueue: (name: string, id: string) => void;
  isJoining: boolean;
  onCancel: () => void;
  ticket: MatchmakingTicket | null;
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

  if (ticket && ticket.status === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <h1 className="text-4xl font-bold mt-4 font-display">
          Waiting for an opponent...
        </h1>
        <p className="text-muted-foreground mt-2">
          You are in the queue, {ticket.playerName}. A match will begin
          automatically.
        </p>
        <Button variant="outline" className="mt-8" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <div className="text-center">
        <Swords className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-5xl font-bold font-display">1v1 Matchmaking</h1>
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
  const GAME_ID = (params.gameId as string).toUpperCase();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentQuestion, setCurrentQuestion] =
    useState<Question | null>(null);
  const [view, setView] = useState<"question" | "grid">("question");
  const [ticket, setTicket] = useState<MatchmakingTicket | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (game?.theme) {
      document.documentElement.setAttribute(
        "data-theme",
        game.theme
      );
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
    if (!GAME_ID || !authUser) return;
    const gameRef = doc(db, "games", GAME_ID);

    const unsubGame = onSnapshot(gameRef, (docSnap) => {
      setLoading(true);
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

  useEffect(() => {
    if (!game || game.sessionType !== "matchmaking" || !authUser)
      return;

    const ticketRef = doc(db, "matchmakingTickets", authUser.uid);
    const unsubTicket = onSnapshot(ticketRef, (docSnap) => {
      if (docSnap.exists()) {
        const ticketData = docSnap.data() as MatchmakingTicket;
        setTicket(ticketData);
        if (ticketData.status === "matched" && ticketData.gameId) {
          router.replace(`/game/${ticketData.gameId}`);
        }
      } else {
        setTicket(null);
      }
    });

    if (ticket?.status === "waiting" && !isAdmin) {
      const q = query(
        collection(db, "matchmakingTickets"),
        where("status", "==", "waiting"),
        where("matchmakingSessionId", "==", game.id),
        where("playerId", "!=", authUser.uid),
        limit(1)
      );
      const unsubQueue = onSnapshot(q, async (snapshot) => {
        if (snapshot.docs.length > 0) {
          const player1Ticket = ticket;
          const player2TicketDoc = snapshot.docs[0];
          const player2Ticket =
            player2TicketDoc.data() as MatchmakingTicket;

          if (
            player1Ticket.playerId < player2Ticket.playerId
          ) {
            const batch = writeBatch(db);

            const newGameId = generatePin();
            const newGameRef = doc(db, "games", newGameId);

            const newGame: Omit<Game, "id"> = {
              ...game,
              id: newGameId,
              title: `1v1: ${player1Ticket.playerName} vs ${player2Ticket.playerName}`,
              status: "playing",
              sessionType: "team",
              teams: [
                {
                  name: player1Ticket.playerName,
                  score: 0,
                  players: [
                    {
                      id: player1Ticket.playerId,
                      playerId: player1Ticket.playerId,
                      name: player1Ticket.playerName,
                      teamName: player1Ticket.playerName,
                      answeredQuestions: [],
                      coloringCredits: 0,
                      score: 0,
                    },
                  ],
                  capacity: 1,
                  color: "#FF6347",
                  icon: "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fred.png?alt=media&token=8dee418c-6d1d-4558-84d2-51909b71a258",
                },
                {
                  name: player2Ticket.playerName,
                  score: 0,
                  players: [
                    {
                      id: player2Ticket.playerId,
                      playerId: player2Ticket.playerId,
                      name: player2Ticket.playerName,
                      teamName: player2Ticket.playerName,
                      answeredQuestions: [],
                      coloringCredits: 0,
                      score: 0,
                    },
                  ],
                  capacity: 1,
                  color: "#4682B4",
                  icon: "https://firebasestorage.googleapis.com/v0/b/studio-7831135066-b7ebf.firebasestorage.app/o/assets%2Fblue.png?alt=media&token=0cd4ea1b-4005-4101-950f-a04500d708dd",
                },
              ],
              gameStartedAt: serverTimestamp(),
              adminId: game.adminId,
            };
            batch.set(newGameRef, newGame);

            batch.update(
              doc(
                db,
                "matchmakingTickets",
                player1Ticket.playerId
              ),
              {
                status: "matched",
                gameId: newGameId,
              }
            );
            batch.update(
              doc(
                db,
                "matchmakingTickets",
                player2Ticket.playerId
              ),
              {
                status: "matched",
                gameId: newGameId,
              }
            );

            await batch.commit();
          }
        }
      });
      return () => unsubQueue();
    }

    return () => unsubTicket();
  }, [game, authUser, isAdmin, router, ticket]);

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

  useEffect(() => {
    if (!game || !currentPlayer) return;

    const isSoloMode = game.sessionType === "individual";
    const canProceed = isSoloMode
      ? ["lobby", "starting", "playing"].includes(game.status)
      : game.status === "playing";

    if (!canProceed) return;

    const nextQ = getNextQuestion();
    if (isSoloMode) {
      const playerStartTime = currentPlayer.gameStartedAt?.toMillis();
      const isTimeUp =
        playerStartTime && game.timer
          ? Date.now() > playerStartTime + game.timer * 1000
          : false;
      const allQuestionsAnswered =
        !nextQ && game.questions.length > 0;

      if (
        isTimeUp ||
        (allQuestionsAnswered && currentPlayer.coloringCredits === 0)
      ) {
        setCurrentQuestion(null);
        setView("question");
        return;
      }
    } else if (game.status !== "playing") {
      return;
    }

    if (currentPlayer.coloringCredits > 0) {
      setView("grid");
      return;
    }

    if (nextQ) {
      setCurrentQuestion((prev) =>
        prev?.question === nextQ.question ? prev : nextQ
      );
      setView("question");
    } else {
      setCurrentQuestion(null);
      setView("question");
    }
  }, [game, currentPlayer, getNextQuestion]);

  const handleJoinQueue = async (
    playerName: string,
    playerId: string
  ) => {
    if (!game || !authUser) return;
    setIsJoining(true);
    try {
      const ticketRef = doc(db, "matchmakingTickets", authUser.uid);
      const newTicket: MatchmakingTicket = {
        id: authUser.uid,
        playerId: authUser.uid,
        playerName: playerName,
        status: "waiting",
        createdAt: serverTimestamp() as Timestamp,
        matchmakingSessionId: game.id,
      };
      await setDoc(ticketRef, newTicket);
    } catch (error) {
      console.error("Error joining queue:", error);
      toast({
        title: "Error",
        description:
          "Could not join the matchmaking queue.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleCancelQueue = async () => {
    if (!authUser) return;
    const ticketRef = doc(db, "matchmakingTickets", authUser.uid);
    await deleteDoc(ticketRef);
  };

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
        const gameRef = doc(db, "games", GAME_ID);
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
      // 1. Generate a unique ID for the new player-specific game
      const newGameId = `${GAME_ID}-${authUser.uid.slice(0, 5)}-${generatePin()}`;
      const newGameRef = doc(db, "games", newGameId);
      const templateGameRef = doc(db, "games", GAME_ID);

      let templateGameData = game;

      // Ensure questions are ready in the template
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

      // 2. Create the new player object
      const newPlayer: Player = {
        id: authUser.uid,
        playerId: customData["ID Number"] || uuidv4(),
        name: name,
        teamName: "Team", 
        answeredQuestions: [],
        coloringCredits: 0,
        score: 0,
        customData: customData,
        gameStartedAt: Timestamp.now(),
      };

      // 3. Create the new game object, copying from the template
      const newGame: Omit<Game, "id"> = {
        ...templateGameData,
        title: `${templateGameData.title} - ${name}`,
        status: "playing",
        parentSessionId: GAME_ID,
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
        gameStartedAt: serverTimestamp(),
      };

      // 4. Save the new game to Firestore
      await setDoc(newGameRef, newGame);
      
      // 5. Redirect the player to their new personal game
      router.replace(`/game/${newGameId}`);

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

    const gameRef = doc(db, "games", GAME_ID);
    await updateDoc(gameRef, { status: "starting" });

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
        const gameRef = doc(db, "games", GAME_ID);
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
        } else if (currentGame.sessionType === "individual") {
          const playerGridSquares = currentGame.grid
            .map((sq, i) => ({ ...sq, originalIndex: i }))
            .filter((sq) => sq.coloredBy === authUser.uid);
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

        // Score is now based on colored hexes, so we don't update it here.
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
        const gameRef = doc(db, "games", GAME_ID);
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

        const coloredByName =
          currentGame.sessionType === "individual"
            ? authUser.uid
            : currentPlayer.teamName;
        if (currentGrid[squareIndex].coloredBy === coloredByName)
          return;

        playerToUpdate.coloringCredits -= 1;

        if (currentGame.sessionType === "team") {
          // Team score is also based on colored hexes now.
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
          currentGame.teams[playerTeamIndex].score +=1;
        }

        currentGrid[squareIndex].coloredBy = coloredByName;

        // Player's score is their hex count.
        if (currentGame.sessionType === "individual") {
          const hexCount = currentGrid.filter(sq => sq.coloredBy === authUser.uid).length;
          playerToUpdate.score = hexCount;
        }

        const isGridFull = currentGrid.every(
          (s) => s.coloredBy !== null
        );

        transaction.update(gameRef, {
          grid: currentGrid,
          teams: currentGame.teams,
          status: isGridFull ? "finished" : currentGame.status,
        });
      });
      // Do not get next question here, wait for useEffect to handle it.
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

  const handleTimeout = async () => {
    if (game?.status === "playing" && (isAdmin || game.sessionType === 'individual')) {
      await updateDoc(doc(db, "games", GAME_ID), { status: "finished" });
      toast({
        title: "Time's Up!",
        description: `The game timer has expired.`,
      });
    }
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
          <h1 className="mt-4 text-4xl font-bold font-display">
            Loading Session...
          </h1>
        </div>
      );
    }

    if (
      game.sessionType === "matchmaking" &&
      game.status === "lobby"
    ) {
      return (
        <MatchmakingLobby
          onJoinQueue={handleJoinQueue}
          isJoining={isJoining}
          onCancel={handleCancelQueue}
          ticket={ticket}
        />
      );
    }

    if (game.sessionType === "individual") {
       // This is the template lobby
      if (!currentPlayer && !game.parentSessionId) {
        return (
          <IndividualLobby
            game={game}
            onJoin={handleJoinIndividual}
            isJoining={isJoining}
          />
        );
      }
      // This is a player's actual game
      if (!currentPlayer && game.parentSessionId) {
          return <div className="flex items-center justify-center h-full">Error: Could not find player data in this game.</div>
      }
    }

     if (
      game.status === "lobby" ||
      game.status === "starting" ||
      ((game.status === "playing" || game.status === "finished") &&
        !currentPlayer)
    ) {
      if (
        (game.status === "playing" || game.status === "finished") &&
        !currentPlayer
      ) {
         if (game.sessionType === 'individual' && game.parentSessionId) {
             // This is a finished individual game, go to leaderboard
             router.replace(`/leaderboard/${game.parentSessionId}?player_id=${authUser.uid}`);
             return <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />;
         }
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
        
        const playerStartTime = currentPlayer.gameStartedAt?.toMillis();
        const isTimeUp = playerStartTime && game.timer ? Date.now() > playerStartTime + game.timer * 1000 : false;
        const allQuestionsAnswered = !getNextQuestion() && game.questions.length > 0;

        if (game.sessionType === 'individual' && (isTimeUp || (allQuestionsAnswered && currentPlayer.coloringCredits === 0))) {
            if(game.status === 'playing') handleTimeout(); // Mark game as finished
            return <ResultsScreen teams={game.teams} onPlayAgain={() => {}} isAdmin={isAdmin} individualPlayerId={currentPlayer.id} parentSessionId={game.parentSessionId} />
        }

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
              playerId={currentPlayer.id}
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

    