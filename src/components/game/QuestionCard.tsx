
"use client";

import { useState, useEffect } from "react";
import type { Question } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

type QuestionPhase = 'answering' | 'feedback' | 'coloring' | 'transitioning';

type QuestionCardProps = {
  question: Question;
  questionPhase: QuestionPhase;
  lastAnswerCorrect: boolean | null;
  onAnswer: (question: Question, answer: string) => void;
  className?: string;
  isIndividualMode: boolean;
};

export default function QuestionCard({
  question,
  questionPhase,
  lastAnswerCorrect,
  onAnswer,
  className,
  isIndividualMode
}: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAnswer(null);
  }, [question.question]);

  const handleAnswerClick = (option: string) => {
    if (questionPhase !== 'answering') return;
    setSelectedAnswer(option);
    onAnswer(question, option);
  };

  const getButtonClass = (option: string) => {
    if (questionPhase === 'answering') {
      return "border-primary/20 hover:border-primary hover:bg-primary/5";
    }
    const isCorrectAnswer = option.trim().toLowerCase() === question.answer.trim().toLowerCase();
    const isSelectedAnswer = option.trim().toLowerCase() === selectedAnswer?.trim().toLowerCase();

    if (isCorrectAnswer) return "bg-green-500 border-green-600 text-white";
    if (isSelectedAnswer && !isCorrectAnswer) return "bg-red-500 border-red-600 text-white";
    
    return "border-gray-300 bg-gray-100 text-gray-400 opacity-60";
  };

  const showFeedbackOverlay = questionPhase === 'feedback' || questionPhase === 'transitioning';

  return (
    <Card className={cn("h-full relative overflow-hidden flex flex-col", className)}>
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-xl md:text-2xl font-display leading-tight">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center min-h-0">
        <div className="grid grid-cols-1 gap-3">
          {question.options.map((option, index) => (
            <Button
              key={`${question.question}-${index}`}
              variant="outline"
              size="lg"
              className={cn(
                "h-auto min-h-14 py-3 text-base md:text-lg justify-start text-left whitespace-normal", 
                getButtonClass(option)
              )}
              onClick={() => handleAnswerClick(option)}
              disabled={questionPhase !== 'answering'}
            >
              <span className="mr-3 font-bold">{String.fromCharCode(65 + index)}.</span>
              <span className="flex-1">{option}</span>
            </Button>
          ))}
        </div>
      </CardContent>

      {showFeedbackOverlay && lastAnswerCorrect !== null && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
          {lastAnswerCorrect ? (
             <>
               <CheckCircle2 className="h-16 w-16 md:h-20 md:w-20 text-green-500 mb-4" />
               <p className="text-2xl md:text-4xl font-bold text-green-600">Correct!</p>
             </>
          ) : (
             <>
               <XCircle className="h-16 w-16 md:h-20 md:w-20 text-red-500 mb-4" />
               <p className="text-2xl md:text-4xl font-bold text-red-600">Incorrect!</p>
               {isIndividualMode && (
                <p className="mt-2 text-muted-foreground text-sm md:text-base">Answer: {question.answer}</p>
               )}
             </>
          )}
        </div>
      )}
    </Card>
  );
}
