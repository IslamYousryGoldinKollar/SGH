"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  increment,
} from "firebase/firestore";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface TeamData {
  name: string;
  color: string;
  players: string[];
  score: number;
}

interface SessionData {
  team1: TeamData;
  team2: TeamData;
  status: string;
  currentQuestion: number;
  questions: Question[];
  timeLeft: number;
}

export default function TeamPlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const playerName = searchParams.get("player");
  const teamKey = searchParams.get("team") as "team1" | "team2";

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; correctAnswer: number } | null>(null);
  const [personalScore, setPersonalScore] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      router.push("/team/lobby");
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "team_sessions", sessionId), (doc) => {
      if (doc.exists()) {
        setSessionData(doc.data() as SessionData);
      }
    });

    return () => unsubscribe();
  }, [sessionId, router]);

  const handleAnswer = async (answerIndex: number) => {
    if (!sessionData || answered) return;

    const currentQuestion = sessionData.questions[sessionData.currentQuestion];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;

    setSelectedAnswer(answerIndex);
    setAnswered(true);
    setFeedback({
      isCorrect,
      correctAnswer: currentQuestion.correctAnswer,
    });

    if (isCorrect) {
      setPersonalScore((prev) => prev + 1);

      // Update team score
      if (sessionId) {
        try {
          await updateDoc(doc(db, "team_sessions", sessionId), {
            [`${teamKey}.score`]: increment(1),
          });
        } catch (error) {
          console.error("Error updating score:", error);
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!sessionData) {
    return (
      <div className="min-h-screen game-background flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/20 to-blue-600/40" />
        <Loader2 className="w-8 h-8 animate-spin text-white relative z-10" />
      </div>
    );
  }

  const currentQuestion = sessionData.questions?.[sessionData.currentQuestion];
  const team = sessionData[teamKey];

  if (!currentQuestion) {
    return (
      <div className="min-h-screen game-background flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/20 to-blue-600/40" />
        <div className="relative z-10 text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen game-background relative overflow-hidden">
      {/* Background with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/30 via-blue-500/40 to-blue-700/60" />
      
      {/* Animated water effect */}
      <div className="water-effect" />
      
      {/* Bubbles */}
      <div className="bubbles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="bubble" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${4 + Math.random() * 4}s`,
            width: `${10 + Math.random() * 20}px`,
            height: `${10 + Math.random() * 20}px`,
          }} />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col px-4 py-6">
        {/* Timer */}
        <div className="text-center mb-4">
          <span className={cn(
            "text-5xl font-bold tracking-tight text-white drop-shadow-lg",
            sessionData.timeLeft <= 60 && "text-red-400"
          )}>
            {formatTime(sessionData.timeLeft)}
          </span>
        </div>

        {/* Score Bar */}
        <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-lg mb-4">
          <CardContent className="p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: team?.color }}
              />
              <span className="text-gray-600 text-sm">{team?.name}</span>
            </div>
            <span className="text-cyan-600 font-bold text-lg">
              {personalScore} PTS
            </span>
          </CardContent>
        </Card>

        {/* Question Card */}
        <Card className="flex-1 bg-white/95 backdrop-blur-sm border-0 shadow-xl flex flex-col">
          <CardContent className="p-5 flex flex-col flex-1">
            {/* Question Number */}
            <div className="text-center mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                Question {sessionData.currentQuestion + 1} of {sessionData.questions.length}
              </span>
            </div>

            {/* Question Text */}
            <h2 className="text-lg font-bold text-gray-800 text-center mb-6 leading-relaxed">
              {currentQuestion.question}
            </h2>

            {/* Options */}
            <div className="flex-1 flex flex-col justify-center space-y-3">
              {currentQuestion.options.map((option, index) => {
                const letter = String.fromCharCode(65 + index);
                let buttonClass = "bg-white border-2 border-gray-200 hover:border-cyan-400 hover:bg-cyan-50";

                if (feedback) {
                  if (index === feedback.correctAnswer) {
                    buttonClass = "bg-green-50 border-2 border-green-500";
                  } else if (index === selectedAnswer && !feedback.isCorrect) {
                    buttonClass = "bg-red-50 border-2 border-red-500";
                  } else {
                    buttonClass = "bg-gray-50 border-2 border-gray-200 opacity-50";
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    disabled={answered}
                    className={cn(
                      "w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center gap-3",
                      buttonClass
                    )}
                  >
                    <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0">
                      {letter}.
                    </span>
                    <span className="text-gray-800 font-medium text-sm flex-1 leading-snug">
                      {option}
                    </span>
                    {feedback && index === feedback.correctAnswer && (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                    {feedback && index === selectedAnswer && !feedback.isCorrect && (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feedback Message */}
            {feedback && (
              <div className={cn(
                "mt-4 p-3 rounded-lg text-center font-medium",
                feedback.isCorrect 
                  ? "bg-green-100 text-green-700" 
                  : "bg-red-100 text-red-700"
              )}>
                {feedback.isCorrect ? "🎉 Correct!" : "❌ Wrong answer"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Player Info */}
        <div className="mt-4 text-center">
          <span className="text-white/80 text-sm">
            Playing as <span className="font-semibold">{playerName}</span>
          </span>
        </div>
      </div>

      <style jsx>{`
        .game-background {
          background: linear-gradient(180deg, #0891b2 0%, #0e7490 50%, #155e75 100%);
          min-height: 100vh;
          min-height: 100dvh;
        }

        .water-effect {
          position: fixed;
          inset: 0;
          background: 
            radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 60%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 20% 80%, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
          pointer-events: none;
          animation: shimmer 10s ease-in-out infinite;
        }

        .bubbles {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .bubble {
          position: absolute;
          bottom: -30px;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.1));
          border-radius: 50%;
          animation: rise linear infinite;
        }

        @keyframes rise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.4;
          }
          100% {
            transform: translateY(-100vh) scale(0.3);
            opacity: 0;
          }
        }

        @keyframes shimmer {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
