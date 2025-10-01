
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, query, getDocs, where } from "firebase/firestore";
import { Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminUser, Game } from "@/lib/types";
import { SUPER_ADMIN_UIDS } from "@/lib/constants";
import { format } from "date-fns";

export default function SuperAdminDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isSuperAdmin = user && SUPER_ADMIN_UIDS.includes(user.uid);

  useEffect(() => {
    if (loading) return;
    if (!user || !isSuperAdmin) {
      router.replace("/admin/login");
    }
  }, [user, loading, isSuperAdmin, router]);
  
  useEffect(() => {
    if (!isSuperAdmin) return;

    const adminsQuery = query(collection(db, "admins"));
    const unsubscribe = onSnapshot(adminsQuery, async (querySnapshot) => {
      const adminsData: AdminUser[] = [];
      for (const doc of querySnapshot.docs) {
        const admin = { id: doc.id, ...doc.data() } as AdminUser;
        
        // Fetch session count for each admin
        const gamesQuery = query(collection(db, "games"), where("adminId", "==", admin.uid));
        const gamesSnapshot = await getDocs(gamesQuery);
        admin.sessionCount = gamesSnapshot.size;

        adminsData.push(admin);
      }
      setAdmins(adminsData);
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching admin users: ", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin]);


  if (loading || !isSuperAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold font-display flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-10 w-10" />
          Super Admin Dashboard
        </h1>
        <div className="flex gap-4">
            <button onClick={() => router.push('/admin')} className="text-sm text-muted-foreground hover:underline">My Dashboard</button>
            <button onClick={() => auth.signOut().then(() => router.push('/'))} className="text-sm text-muted-foreground hover:underline">Sign Out</button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Admins (Tenants)</CardTitle>
          <CardDescription>
            Overview of all admin accounts in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Sessions Created</TableHead>
                  <TableHead>Joined On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length > 0 ? (
                  admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.email}</TableCell>
                      <TableCell className="font-mono text-xs">{admin.uid}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">{admin.plan}</span>
                      </TableCell>
                      <TableCell className="text-center">{admin.sessionCount}</TableCell>
                      <TableCell>
                        {admin.createdAt ? format(admin.createdAt.toDate(), "PPP") : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No admin accounts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
