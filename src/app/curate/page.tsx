"use client";

import { useState } from "react";
import CuratorForm from "@/components/curate/CuratorForm";
import QuestionList from "@/components/curate/QuestionList";
import type { Question } from "@/lib/types";
import { generateQuestionsAction } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";

export default function CuratePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async (data: {
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    numberOfQuestions: number;
  }) => {
    setIsLoading(true);
    setQuestions([]);
    try {
      const result = await generateQuestionsAction(data);
      if (result.questions && result.questions.length > 0) {
        setQuestions(result.questions);
        toast({
          title: "Success!",
          description: `Generated ${result.questions.length} questions.`,
        });
      } else {
        toast({
          title: "No questions generated",
          description: "The AI returned no questions. Please try a different topic.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "An error occurred",
        description: "Failed to generate questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display text-primary">AI Content Curator</h1>
          <p className="text-muted-foreground mt-2">
            Generate engaging trivia questions using generative AI.
          </p>
        </div>
        <CuratorForm onSubmit={handleGenerate} isLoading={isLoading} />
        <QuestionList questions={questions} isLoading={isLoading} />
      </div>
    </div>
  );
}
