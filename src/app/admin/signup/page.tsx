
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { AdminUser } from "@/lib/types";

export default function AdminSignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please check your passwords and try again.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    try {
      // 1. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Create the admin document in Firestore
      const adminRef = doc(db, "admins", user.uid);
      const newAdmin: Omit<AdminUser, 'id'> = {
        uid: user.uid,
        email: user.email!,
        createdAt: serverTimestamp() as any,
        plan: 'basic',
        sessionCount: 0,
        status: 'pending',
        expiresAt: null,
      };
      await setDoc(adminRef, newAdmin);
      
      // 3. Log the user out immediately after signup
      await auth.signOut();

      toast({
        title: "Registration Successful!",
        description: "Your account is pending approval. You will be redirected to the login page.",
      });

      // 4. Redirect to login page with a success message
      router.push("/admin/login?signup=success");

    } catch (error: any) {
      console.error("Admin signup error:", error);
      toast({
        title: "Signup Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex-1 flex flex-col items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-display">Admin Registration</CardTitle>
          <CardDescription>Create an account to host your own trivia games.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm text-center flex-col gap-2">
          <p className="text-muted-foreground">Already have an account?</p>
           <Link href="/admin/login" className="font-medium text-primary hover:underline">
              Log in here
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
