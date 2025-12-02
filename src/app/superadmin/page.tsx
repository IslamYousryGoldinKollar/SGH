
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, query, getDocs, where, doc, updateDoc, Timestamp, addDoc } from "firebase/firestore";
import { Loader2, ShieldAlert, CheckCircle, XCircle, Clock, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { AdminUser, Game } from "@/lib/types";
import { SUPER_ADMIN_UIDS } from "@/lib/constants";
import { format, addMonths, addYears } from "date-fns";
import { cn } from "@/lib/utils";

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
        
        const gamesQuery = query(collection(db, "games"), where("adminId", "==", admin.uid));
        const gamesSnapshot = await getDocs(gamesQuery);
        admin.sessionCount = gamesSnapshot.size;

        adminsData.push(admin);
      }
      setAdmins(adminsData.sort((a,b) => a.createdAt.toMillis() - b.createdAt.toMillis()));
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching admin users: ", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin]);

  const handleUpdateAdminStatus = async (adminId: string, status: AdminUser['status'], expiresAt: Timestamp | null = null) => {
    const adminRef = doc(db, "admins", adminId);
    await updateDoc(adminRef, { status, expiresAt });
  }

  const approveAdmin = (adminId: string, duration: 'month' | 'year' | 'forever') => {
    let expiryDate: Timestamp | null = null;
    if (duration === 'month') {
        expiryDate = Timestamp.fromDate(addMonths(new Date(), 1));
    } else if (duration === 'year') {
        expiryDate = Timestamp.fromDate(addYears(new Date(), 1));
    }
    handleUpdateAdminStatus(adminId, 'active', expiryDate);
  }

  const getStatusBadge = (admin: AdminUser) => {
    const isExpired = admin.expiresAt && admin.expiresAt.toMillis() < Date.now();
    const status = isExpired ? 'expired' : admin.status;

    switch(status) {
        case 'active': return <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Active</span>
        case 'pending': return <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs flex items-center gap-1"><Clock className="w-3 h-3"/> Pending</span>
        case 'disabled': return <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs flex items-center gap-1"><Ban className="w-3 h-3"/> Disabled</span>
        case 'expired': return <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs flex items-center gap-1"><XCircle className="w-3 h-3"/> Expired</span>
        default: return <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">{status}</span>
    }
  }


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
            Overview of all admin accounts in the system. Approve new users and manage their access.
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
                  <TableHead>Joined On</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length > 0 ? (
                  admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.email}</TableCell>
                      <TableCell>{admin.createdAt ? format(admin.createdAt.toDate(), "PPP") : 'N/A'}</TableCell>
                      <TableCell className="text-center">{admin.sessionCount}</TableCell>
                      <TableCell>{getStatusBadge(admin)}</TableCell>
                       <TableCell>
                        {admin.expiresAt ? format(admin.expiresAt.toDate(), "PPP") : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        {admin.status === 'pending' ? (
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">Approve</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>Set Duration</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => approveAdmin(admin.id, 'month')}>1 Month</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => approveAdmin(admin.id, 'year')}>1 Year</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => approveAdmin(admin.id, 'forever')}>Forever</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => handleUpdateAdminStatus(admin.id, 'disabled')}
                                disabled={admin.status === 'disabled'}
                            >
                                Disable
                            </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
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
