
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

export type CustomPlayerField = {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel';
};

export interface Player {
  id: string; // Firebase Auth UID
  playerId: string; // User-provided ID number
  name: string;
  teamName: string;
  answeredQuestions: string[]; // Array of question strings they've already answered
  coloringCredits: number;
  score: number; // For teams, points. For individuals, number of hexes.
  customData?: Record<string, string>; // For individual mode custom fields
}

export interface GridSquare {
  id: number;
  coloredBy: string | null; // Team name or Player ID in individual mode
}

export interface EmojiEvent {
  id: string;
  senderId: string;
  emoji: string;
  timestamp: Timestamp;
}

export interface Team {
  name:string;
  score: number;
  players: Player[];
  capacity: number;
  color: string;
  icon: string;
}

export type GameStatus = "lobby" | "starting" | "playing" | "finished";
export type SessionType = "team" | "individual";

export interface Game {
    id: string; // The game PIN
    title: string;
    description?: string; // For social sharing metadata
    status: GameStatus;
    teams: Team[];
    questions: Question[];
    grid: GridSquare[];
    createdAt: Timestamp;
    gameStartedAt?: Timestamp | null;
    timer: number;
    topic: string;
    adminId: string; // UID of the user who created the game
    sessionType: SessionType;
    requiredPlayerFields: CustomPlayerField[];
    parentSessionId: string | null;
}

// Represents a tenant/admin user in the system
export interface AdminUser {
    id: string; // Document ID, same as Firebase UID
    uid: string;
    email: string;
    createdAt: Timestamp;
    plan: 'basic' | 'premium' | 'enterprise';
    sessionCount: number;
    status: 'pending' | 'active' | 'expired' | 'disabled';
    expiresAt: Timestamp | null;
}
