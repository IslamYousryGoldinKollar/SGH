import Link from "next/link";
import { BrainCircuit, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="bg-card/50 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
            <BrainCircuit className="h-7 w-7" />
            <h1 className="font-display">Trivia Titans</h1>
          </Link>
          <nav>
            <Button asChild variant="ghost">
              <Link href="/curate">
                <Wand2 className="mr-2 h-4 w-4" />
                AI Curator
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
