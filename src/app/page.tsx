
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Shield, LogIn } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

export default function LandingPage() {
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleJoinSession = async () => {
    if (!pin.trim()) {
      toast({
        title: "PIN Required",
        description: "Please enter a session PIN.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      const gameRef = doc(db, "games", pin.trim().toUpperCase());
      const gameDoc = await getDoc(gameRef);

      if (gameDoc.exists()) {
        router.push(`/game/${pin.trim().toUpperCase()}`);
      } else {
        toast({
          title: "Session Not Found",
          description: "The PIN you entered does not match an active session.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error joining session:", error);
      toast({
        title: "Error",
        description: "Could not verify session PIN. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-1 flex-col items-center justify-center">
      <div className="text-center mb-12 text-white drop-shadow-lg">
        <h1 className="text-5xl font-bold font-display text-primary">Care Clans</h1>
        <p className="text-xl mt-2">The ultimate team trivia challenge</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="text-accent" />
              Join a Session
            </CardTitle>
            <CardDescription>Enter the PIN from the big screen to join the game.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Session PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="text-2xl h-14 text-center tracking-widest font-mono"
              maxLength={6}
            />
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleJoinSession} disabled={isLoading}>
              <LogIn className="mr-2" />
              {isLoading ? "Joining..." : "Join Game"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="text-accent" />
              Admin Access
            </CardTitle>
            <CardDescription>Create and manage game sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Admins can create new sessions, manage questions, and control the game from the admin dashboard.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant="secondary" onClick={() => router.push('/admin/login')}>
              Admin Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
