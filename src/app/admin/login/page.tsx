
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { AdminUser } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Info } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SUPER_ADMIN_UIDS } from "@/lib/constants";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const showSuccessMessage = searchParams.get('signup') === 'success';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const isSuperAdmin = SUPER_ADMIN_UIDS.includes(user.uid);

      if (isSuperAdmin) {
        toast({
          title: "Super Admin Login Successful",
          description: "Redirecting to the super admin dashboard...",
        });
        router.push("/superadmin");
        return;
      }

      // Check admin status in Firestore
      const adminRef = doc(db, "admins", user.uid);
      const adminDoc = await getDoc(adminRef);

      if (!adminDoc.exists()) {
        throw new Error("You are not registered as an admin.");
      }

      const adminData = adminDoc.data() as AdminUser;
      
      if (adminData.status === 'pending') {
        throw new Error("Your account is pending approval by a super admin.");
      }
      
      if (adminData.status === 'disabled') {
        throw new Error("Your account has been disabled.");
      }

      if (adminData.status === 'expired' || (adminData.expiresAt && adminData.expiresAt.toMillis() < Date.now())) {
        throw new Error("Your admin access has expired. Please contact support.");
      }

      toast({
        title: "Login Successful",
        description: "Redirecting to the admin dashboard...",
      });
      router.push("/admin");

    } catch (error: any) {
      console.error("Admin login error:", error);
      let description = "Invalid credentials or unauthorized access.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        description = "The email or password you entered is incorrect. Please try again.";
      } else if (error.message) {
        description = error.message;
      }
      toast({
        title: "Login Failed",
        description: description,
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
          <CardTitle className="text-2xl font-display">Admin Login</CardTitle>
          <CardDescription>Enter your credentials to create and manage games.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           {showSuccessMessage && (
            <Alert variant="default" className="bg-green-50 border-green-200">
                <AlertTitle className="text-green-800">Registration Successful!</AlertTitle>
                <AlertDescription className="text-green-700">
                    Your account has been created. Please wait for a super admin to approve your access.
                </AlertDescription>
            </Alert>
          )}
          {!showSuccessMessage && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>New Admins</AlertTitle>
              <AlertDescription>
                If you are a new admin, you must <Link href="/admin/signup" className="font-bold underline">sign up</Link> and be approved before you can log in.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleLogin} className="space-y-4 pt-4">
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
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm text-center flex-col gap-2">
          <p className="text-muted-foreground">Don't have an admin account?</p>
           <Link href="/admin/signup" className="font-medium text-primary hover:underline">
              Sign up here
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
