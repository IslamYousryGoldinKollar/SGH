"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { Target, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  category?: string;
}

interface AnswerFeedback {
  isCorrect: boolean;
  correctAnswer: number;
  selectedAnswer: number;
}

export default function IndividualQuizPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const participantName = searchParams.get("name") || "";
  const participantId = searchParams.get("id") || "";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Fetch questions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const q = query(
          collection(db, "questions"),
          where("isActive", "==", true),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const fetchedQuestions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Question[];

        // Shuffle questions
        const shuffled = fetchedQuestions.sort(() => Math.random() - 0.5);
        setQuestions(shuffled);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching questions:", error);
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  // Submit score and redirect to leaderboard
  const submitScoreAndRedirect = useCallback(async (finalScore: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "individual_scores"), {
        odooId: participantId,
        participantName: participantName,
        score: finalScore,
        totalQuestions: questions.length,
        completedAt: serverTimestamp(),
        timeSpent: 300 - timeLeft,
      });

      // Redirect to leaderboard immediately
      router.push(`/individual/leaderboard?odooId=${participantId}&name=${encodeURIComponent(participantName)}&score=${finalScore}`);
    } catch (error) {
      console.error("Error submitting score:", error);
      setIsSubmitting(false);
    }
  }, [isSubmitting, participantId, participantName, questions.length, timeLeft, router]);

  // Handle quiz completion
  useEffect(() => {
    if (quizCompleted && !isSubmitting) {
      submitScoreAndRedirect(score);
    }
  }, [quizCompleted, score, isSubmitting, submitScoreAndRedirect]);

  // Timer
  useEffect(() => {
    if (loading || quizCompleted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setQuizCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, quizCompleted]);

  const handleAnswerSelect = (answerIndex: number) => {
    if (answerFeedback) return; // Already answered

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;

    setSelectedAnswer(answerIndex);
    setAnswerFeedback({
      isCorrect,
      correctAnswer: currentQuestion.correctAnswer,
      selectedAnswer: answerIndex,
    });

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    // Move to next question after delay
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedAnswer(null);
        setAnswerFeedback(null);
      } else {
        // All questions answered - trigger completion
        setQuizCompleted(true);
      }
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen water-background flex items-center justify-center">
        {/* Water Background Elements */}
        <div className="water-overlay" />
        <div className="water-drops" />
        <div className="bubbles">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="bubble" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${4 + Math.random() * 4}s`
            }} />
          ))}
        </div>
        
        <div className="relative z-10 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (quizCompleted || isSubmitting) {
    return (
      <div className="min-h-screen water-background flex items-center justify-center">
        {/* Water Background Elements */}
        <div className="water-overlay" />
        <div className="water-drops" />
        <div className="bubbles">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="bubble" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${4 + Math.random() * 4}s`
            }} />
          ))}
        </div>
        
        <div className="relative z-10 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Submitting your score...</h2>
          <p className="text-gray-600">Redirecting to leaderboard</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercentage = ((currentQuestionIndex) / questions.length) * 100;

  return (
    <div className="min-h-screen water-background relative overflow-hidden">
      {/* Water Background Elements */}
      <div className="water-overlay" />
      <div className="water-drops" />
      <div className="bubbles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="bubble" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${4 + Math.random() * 4}s`
          }} />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Question Card */}
          <Card className="flex-1 bg-white/95 backdrop-blur-sm shadow-2xl border-0">
            <CardContent className="p-8">
              {/* Question Header */}
              <div className="mb-6">
                <span className="text-sm text-cyan-600 font-medium">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
              </div>

              {/* Question */}
              <h2 className="text-2xl font-bold text-gray-800 mb-8">
                {currentQuestion?.question}
              </h2>

              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion?.options.map((option, index) => {
                  const letter = String.fromCharCode(65 + index);
                  let buttonClass = "bg-white hover:bg-cyan-50 border-2 border-gray-200 hover:border-cyan-400";
                  
                  if (answerFeedback) {
                    if (index === answerFeedback.correctAnswer) {
                      buttonClass = "bg-green-100 border-2 border-green-500";
                    } else if (index === answerFeedback.selectedAnswer && !answerFeedback.isCorrect) {
                      buttonClass = "bg-red-100 border-2 border-red-500";
                    } else {
                      buttonClass = "bg-gray-100 border-2 border-gray-200 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={answerFeedback !== null}
                      className={cn(
                        "p-4 rounded-xl text-left transition-all duration-200 flex items-center gap-4",
                        buttonClass
                      )}
                    >
                      <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700">
                        {letter}.
                      </span>
                      <span className="text-gray-800 font-medium flex-1">{option}</span>
                      {answerFeedback && index === answerFeedback.correctAnswer && (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      )}
                      {answerFeedback && index === answerFeedback.selectedAnswer && !answerFeedback.isCorrect && (
                        <XCircle className="w-6 h-6 text-red-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="lg:w-72 space-y-4">
            {/* Timer */}
            <div className="text-right">
              <span className={cn(
                "text-6xl font-bold tracking-tight",
                timeLeft <= 60 ? "text-red-500" : "text-cyan-600"
              )}>
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Progress Card */}
            <Card className="bg-white/95 backdrop-blur-sm shadow-xl border-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-cyan-600" />
                  <span className="font-semibold text-gray-800">Your Progress</span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Score</span>
                    <span className="text-3xl font-bold text-cyan-600">{score}</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Questions</span>
                      <span>{currentQuestionIndex} / {questions.length}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Player Info */}
            <Card className="bg-white/95 backdrop-blur-sm shadow-xl border-0">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Playing as</p>
                  <p className="font-semibold text-gray-800 truncate">{participantName}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <style jsx>{`
        .water-background {
          background: linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%);
        }

        .water-overlay {
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(255, 255, 255, 0.2) 0%, transparent 50%);
          pointer-events: none;
        }

        .water-drops {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(circle at 10% 10%, rgba(255, 255, 255, 0.8) 2px, transparent 2px),
            radial-gradient(circle at 90% 20%, rgba(255, 255, 255, 0.6) 3px, transparent 3px),
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.4) 2px, transparent 2px),
            radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.7) 2px, transparent 2px),
            radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.5) 3px, transparent 3px);
          animation: shimmer 8s ease-in-out infinite;
          pointer-events: none;
        }

        .bubbles {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .bubble {
          position: absolute;
          bottom: -20px;
          width: 20px;
          height: 20px;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.2));
          border-radius: 50%;
          animation: rise linear infinite;
        }

        @keyframes rise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.6;
          }
          100% {
            transform: translateY(-100vh) scale(0.5);
            opacity: 0;
          }
        }

        @keyframes shimmer {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
