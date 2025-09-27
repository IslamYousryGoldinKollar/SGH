import type { CurateTriviaQuestionsOutput } from "@/ai/flows/ai-question-curator";
import type { Timestamp } from "firebase/firestore";

export type Question = CurateTriviaQuestionsOutput["questions"][0];

export interface Player {
  id: string;
  name: string;
  teamName: string;
  currentQuestionIndex: number;
}

export interface Team {
  name:string;
  score: number;
  players: Player[];
}

export type GameStatus = "lobby" | "starting" | "playing" | "finished";

export interface Game {
    id: string;
    status: GameStatus;
    teams: Team[];
    questions: Question[];
    createdAt: Timestamp;
    gameStartedAt?: Timestamp | null;
}
