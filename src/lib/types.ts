
import type { CurateTriviaQuestionsOutput } from "@/ai/flows/ai-question-curator";
import type { Timestamp } from "firebase/firestore";

// This represents the structure of the AI-generated output.
export type AIQuestion = CurateTriviaQuestionsOutput["questions"][0];

// This is the new, enriched Question type we'll use throughout the app.
export interface Question {
  question: string;
  options: string[];
  answer: string;
}

export interface Player {
  id: string; // Firebase Auth UID
  name: string;
  teamName: string;
  answeredQuestions: string[]; // Array of question strings they've already answered
}

export interface Team {
  name:string;
  score: number;
  players: Player[];
  capacity: number;
  color: string;
}

export type GameStatus = "lobby" | "starting" | "playing" | "finished";

export interface Game {
    id: string; // The game PIN
    status: GameStatus;
    teams: Team[];
    questions: Question[];
    createdAt: Timestamp;
    gameStartedAt?: Timestamp | null;
    timer: number;
    topic: string;
}
