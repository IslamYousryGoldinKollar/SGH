"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthState } from "react-firebase-hooks/auth";
import { Copy, ExternalLink, FileText, Loader2, MonitorPlay, Plus, Smartphone, Trash2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import QRBox from "@/components/capsule/QRBox";
import {
  createCapsuleSession,
  deleteCapsuleSession,
  subscribeAdminSessions,
} from "@/lib/capsule/firestore-store";
import { DEMO_SESSION_ID, type CapsuleSession } from "@/lib/capsule/types";

export default function AdminCapsulePage() {
  const [user, authLoading] = useAuthState(auth);
  const router = useRouter();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<CapsuleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("The One Island Constitution");
  const [expected, setExpected] = useState(25);
  const [creating, setCreating] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/admin/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    return subscribeAdminSessions(
      user.uid,
      (list) => {
        setSessions(list);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setLoading(false);
      }
    );
  }, [user]);

  async function create() {
    if (!user || creating) return;
    setCreating(true);
    try {
      await createCapsuleSession(user.uid, { title, expectedCrews: Math.max(1, Math.min(80, expected || 25)) });
      toast({ title: "Capsule created", description: "Open the big screen to show the QR code." });
    } catch (e) {
      console.error(e);
      toast({
        title: "Could not create the capsule",
        description: "Check that the Firestore rules for capsule_sessions are published (see docs/capsule.md).",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(`Delete capsule ${id} with all its crews and the constitution? This cannot be undone.`)) return;
    try {
      await deleteCapsuleSession(id);
    } catch (e) {
      console.error(e);
      toast({ title: "Delete failed", description: "Only the owner can delete a capsule.", variant: "destructive" });
    }
  }

  const copy = (text: string) =>
    navigator.clipboard
      .writeText(text)
      .then(() => toast({ title: "Copied", description: text }))
      .catch(() => toast({ title: "Copy failed", description: "Copy it manually.", variant: "destructive" }));

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold font-display text-white drop-shadow-lg">Culture Capsule</h1>
        <Button variant="secondary" asChild>
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New capsule</CardTitle>
          <CardDescription>
            The ice-breaker QR game: crews of 8 answer four questions about The One Island, take a group selfie, and the AI merges
            everything into the island&apos;s constitution.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_160px_auto] items-end">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected">Crews expected</Label>
            <Input
              id="expected"
              type="number"
              min={1}
              max={80}
              value={expected}
              onChange={(e) => setExpected(Number(e.target.value))}
            />
          </div>
          <Button onClick={create} disabled={creating}>
            {creating ? <Loader2 className="mr-2 animate-spin" /> : <Plus className="mr-2" />}
            Create
          </Button>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          200 people in crews of 8 is 25 crews. Rehearse first with the{" "}
          <Link className="underline ml-1" href={`/capsule/${DEMO_SESSION_ID}/screen`} target="_blank">
            demo screen
          </Link>
          {" "}and{" "}
          <Link className="underline ml-1" href={`/capsule/${DEMO_SESSION_ID}`} target="_blank">
            demo phone flow
          </Link>
          .
        </CardFooter>
      </Card>

      <div>
        <h2 className="text-3xl font-bold font-display mb-4 text-white drop-shadow-lg">Your capsules</h2>
        {loading ? (
          <Loader2 className="animate-spin text-white" />
        ) : sessions.length === 0 ? (
          <p className="text-white drop-shadow-md">No capsules yet. Create one above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sessions.map((s) => {
              const leaderUrl = `${origin}/capsule/${s.id}`;
              return (
                <Card key={s.id}>
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-2">
                      <span>{s.title}</span>
                      <Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Code <span className="font-mono font-bold tracking-widest">{s.id}</span> · {s.expectedCrews} crews expected
                      {s.constitution ? " · constitution drafted" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-4 items-center">
                    <div className="w-28 shrink-0 rounded-md bg-white p-2 border">
                      <QRBox value={leaderUrl} size={200} />
                    </div>
                    <div className="space-y-2 min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground break-all">{leaderUrl}</p>
                      <Button variant="outline" size="sm" onClick={() => copy(leaderUrl)}>
                        <Copy className="mr-2" /> Copy phone link
                      </Button>
                    </div>
                  </CardContent>
                  <CardFooter className="grid grid-cols-2 gap-2">
                    <Button onClick={() => window.open(`/capsule/${s.id}/screen`, "_blank")}>
                      <MonitorPlay className="mr-2" /> Big screen
                    </Button>
                    <Button variant="outline" onClick={() => window.open(`/capsule/${s.id}`, "_blank")}>
                      <Smartphone className="mr-2" /> Phone view
                    </Button>
                    <Button variant="outline" onClick={() => window.open(`/capsule/${s.id}/constitution`, "_blank")}>
                      <FileText className="mr-2" /> Constitution <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                    <Button variant="destructive" onClick={() => remove(s.id)}>
                      <Trash2 className="mr-2" /> Delete
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
