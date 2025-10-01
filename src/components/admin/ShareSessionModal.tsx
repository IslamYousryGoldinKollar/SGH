
"use client";

import { useState, useRef, useEffect } from "react";
import type { Game } from "@/lib/types";
import { db, storage, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, updateDoc } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, Upload, Trash2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { refFromURL } from "firebase/storage";

interface ShareSessionModalProps {
  session: Game | null;
  onClose: () => void;
}

export default function ShareSessionModal({ session, onClose }: ShareSessionModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [user] = useAuthState(auth);

  useEffect(() => {
    if (session) {
      setTitle(session.title || "Trivia Titans");
      setDescription(session.description || "");
      setThumbnailUrl(session.thumbnailUrl || null);
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
        thumbnailUrl: thumbnailUrl ?? undefined,
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

  const deleteThumbnailFromStorage = async (url: string) => {
    try {
      const oldRef = refFromURL(storage, url);
      await deleteObject(oldRef);
    } catch (error: any) {
      if (error.code !== "storage/object-not-found") {
        console.warn("Could not delete old thumbnail:", error);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      if (thumbnailUrl) {
        await deleteThumbnailFromStorage(thumbnailUrl);
      }

      const fileName = `${Date.now()}-${file.name}`;
      const imageRef = ref(storage, `game-thumbnails/${user.uid}/${session.id}/${fileName}`);
      const snapshot = await uploadBytes(imageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setThumbnailUrl(downloadURL);
      await persistShareData({ thumbnailUrl: downloadURL });

      toast({
        title: "Thumbnail uploaded!",
        description: "The image is saved and ready to use.",
      });
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      toast({
        title: "Upload Failed",
        description:
          "Could not upload the image. Please ensure your Firebase Storage rules allow it.",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsUploading(false);
    }
  };

  const handleRemoveThumbnail = async () => {
    if (!thumbnailUrl) return;
    try {
      await deleteThumbnailFromStorage(thumbnailUrl);
      setThumbnailUrl(null);
      await persistShareData({ thumbnailUrl: undefined });
      toast({ title: "Thumbnail removed", description: "The share image has been cleared." });
    } catch (error: any) {
      console.error("Error removing thumbnail:", error);
      toast({
        title: "Error",
        description: "Could not remove thumbnail.",
        variant: "destructive",
      });
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
              <CardTitle>Thumbnail Image</CardTitle>
              <CardDescription>
                This image will appear when you share the link on social media.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {thumbnailUrl ? (
                <div className="space-y-4">
                  <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                    <Image
                      src={thumbnailUrl}
                      alt="Session thumbnail"
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 600px"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? <Loader2 className="mr-2 animate-spin" /> : <Upload className="mr-2" />}
                      Replace Image
                    </Button>
                    <Button variant="destructive" onClick={handleRemoveThumbnail}>
                      <Trash2 className="mr-2" /> Remove Thumbnail
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center">
                  <p className="text-muted-foreground mb-4">No thumbnail set.</p>
                  <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-2 animate-spin" /> : <Upload className="mr-2" />}
                    Upload Image
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
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
          <Button onClick={handleSave} disabled={isSaving || isUploading}>
            {isSaving && <Loader2 className="mr-2 animate-spin" />}
            Save Title & Description
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
