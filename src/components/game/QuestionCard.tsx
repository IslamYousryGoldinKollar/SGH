"use client";

import { useState, useEffect } from "react";
import type { Question } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Lightbulb } from "lucide-react";

type QuestionCardProps = {
  question: Question;
  onAnswer: (question: Question, answer: string) => void;
  onNextQuestion: () => void;
};

export default function QuestionCard({ question, onAnswer, onNextQuestion }: QuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle");

  useEffect(() => {
    setAnswer("");
    setFeedback("idle");
  }, [question]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || feedback !== 'idle') return;

    const isCorrect = question.answer.trim().toLowerCase() === answer.trim().toLowerCase();
    setFeedback(isCorrect ? "correct" : "incorrect");
    onAnswer(question, answer);

    setTimeout(() => {
      onNextQuestion();
    }, 2000);
  };
  
  const feedbackStyles = {
    correct: "border-green-500 bg-green-500/10",
    incorrect: "border-red-500 bg-red-500/10",
    idle: ""
  };

  return (
    <Card className={cn("h-full flex flex-col transition-all duration-300 bg-card/50", feedbackStyles[feedback])}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-2xl lg:text-3xl font-display">{question.question}</CardTitle>
          <div className="flex gap-2 flex-shrink-0 ml-4">
            <Badge variant="outline">{question.difficulty}</Badge>
            <Badge variant="secondary">{question.topic}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        {feedback === 'idle' ? (
          <form onSubmit={handleSubmit} className="flex items-center gap-4">
            <Input
              type="text"
              placeholder="Type your answer..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="text-lg p-6 flex-1"
              disabled={feedback !== 'idle'}
            />
            <Button type="submit" size="lg" disabled={feedback !== 'idle' || !answer.trim()}>
              Submit
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-4 animate-in fade-in duration-500">
            {feedback === 'correct' && (
              <div className="flex flex-col items-center gap-2 text-green-400">
                <CheckCircle2 className="h-16 w-16" />
                <p className="text-2xl font-bold">Correct!</p>
              </div>
            )}
            {feedback === 'incorrect' && (
              <div className="flex flex-col items-center gap-2 text-red-400">
                <XCircle className="h-16 w-16" />
                <p className="text-2xl font-bold">Incorrect!</p>
                <p className="text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5"/> The correct answer was: <strong className="text-foreground">{question.answer}</strong></p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
