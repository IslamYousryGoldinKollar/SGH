
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trivia Titans - Big Screen",
  description: "Live game display for Trivia Titans",
};

export default function DisplayLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-background text-foreground h-screen">
        {children}
    </div>
  );
}
