import { Suspense } from "react";
import QuizContent from "./quiz-content";

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><p>Loading...</p></div>}>
      <QuizContent />
    </Suspense>
  );
}
