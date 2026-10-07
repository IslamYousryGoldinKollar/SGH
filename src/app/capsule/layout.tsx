import type { Metadata, Viewport } from "next";
import "./capsule.css";

export const metadata: Metadata = {
  title: "The Culture Capsule · The One Island",
  description: "Your crew's voice for the future managers of e&.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E00800",
};

export default function CapsuleLayout({ children }: { children: React.ReactNode }) {
  return <div className="cap-root">{children}</div>;
}
