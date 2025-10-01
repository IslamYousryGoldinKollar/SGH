
"use client";

import Link from "next/link";
import { BrainCircuit, ShieldAlert } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { SUPER_ADMIN_UIDS } from "@/lib/constants";

export default function Header() {
  const [user] = useAuthState(auth);
  const isSuperAdmin = user && SUPER_ADMIN_UIDS.includes(user.uid);

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
            <BrainCircuit className="h-7 w-7" />
            <h1 className="font-display">Trivia Titans</h1>
          </Link>
          <nav>
            {isSuperAdmin && (
              <Link href="/superadmin" className="flex items-center gap-2 text-sm font-medium text-destructive hover:underline">
                <ShieldAlert className="h-5 w-5" />
                Super Admin
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
