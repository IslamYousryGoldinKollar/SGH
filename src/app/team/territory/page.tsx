"use client";

import { Suspense } from "react";
import TerritoryContent from "./territory-content";
import { Loader2 } from "lucide-react";

export default function TerritoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-16 w-16 animate-spin" />
        </div>
      }
    >
      <TerritoryContent />
    </Suspense>
  );
}
