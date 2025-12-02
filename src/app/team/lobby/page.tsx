import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { TeamLobbyContent } from "./page-content";

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cyan-100 to-cyan-300">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
    </div>
  );
}

export default function TeamLobbyPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TeamLobbyContent />
    </Suspense>
  );
}
