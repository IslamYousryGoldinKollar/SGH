import type { Question } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QuestionListProps = {
  questions: Question[];
  isLoading: boolean;
};

const DifficultyBadge = ({ difficulty }: { difficulty: string }) => {
  const variant = {
    easy: "secondary",
    medium: "default",
    hard: "destructive",
  }[difficulty] as "secondary" | "default" | "destructive" | undefined;
  
  return <Badge variant={variant} className="capitalize">{difficulty}</Badge>
}

export default function QuestionList({ questions, isLoading }: QuestionListProps) {
  if (isLoading) {
    return (
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="font-display">Generated Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card/50">
      <CardHeader>
        <CardTitle className="font-display">Generated Questions</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {questions.map((q, index) => (
            <AccordionItem value={`item-${index}`} key={index}>
              <AccordionTrigger>
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="text-left font-sans">{q.question}</span>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <DifficultyBadge difficulty={q.difficulty} />
                    <Badge variant="outline" className="bg-accent text-accent-foreground">{q.topic}</Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-lg text-primary">
                <strong>Answer:</strong> {q.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
