"use client";

import { useState, useRef, useEffect } from "react";
import type { Game } from "@/lib/types";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareSessionModalProps {
  session: Game | null;
  onClose: () => void;
}

export default function ShareSessionModal({ session, onClose }: ShareSessionModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const { toast } = useToast();
  const [user] = useAuthState(auth);

  useEffect(() => {
    if (session) {
      setTitle(session.title || "Trivia Titans");
      setDescription(session.description || "");
      if (typeof window !== "undefined") {
        setJoinUrl(`${window.location.origin}/game/${session.id}`);
      }
    } else {
      setJoinUrl("");
    }
  }, [session]);

  if (!session) return null;

  const persistShareData = async (payload: Partial<Game>) => {
    const gameRef = doc(db, "games", session.id);
    await updateDoc(gameRef, payload);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await persistShareData({
        title,
        description,
      });
      toast({ title: "Success", description: "Share settings updated." });
      onClose();
    } catch (error) {
      console.error("Error saving share settings:", error);
      toast({
        title: "Error",
        description: "Could not save settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard
      .writeText(joinUrl)
      .then(() => {
        toast({ title: "URL Copied!", description: "The join link is on your clipboard." });
      })
      .catch((err) => {
        console.error("Clipboard error:", err);
        toast({
          title: "Copy Failed",
          description: "Could not copy URL. Please copy it manually.",
          variant: "destructive",
        });
      });
  };

  return (
    <Dialog open={!!session} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] grid-rows-[auto_1fr_auto]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon /> Share Session
          </DialogTitle>
          <DialogDescription>
            Edit the metadata for your session link. Changes are reflected immediately in share previews.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto max-h-[60vh] pr-2">
          <Card>
            <CardHeader>
              <CardTitle>Link Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (for social sharing)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A fun trivia game for the whole team!"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session URL</CardTitle>
              <CardDescription>Share this link with your players.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Input value={joinUrl} readOnly className="font-mono bg-muted" />
              <Button variant="outline" size="icon" onClick={handleCopyUrl}>
                <Copy />
                <span className="sr-only">Copy URL</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 animate-spin" />}
            Save Title & Description
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
