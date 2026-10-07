import type { Metadata, Viewport } from "next";
import "./capsule.css";

export const metadata: Metadata = {
  title: "The One Island Constitution · Culture Capsule",
  description: "Your crew helps draft the constitution of The One Island.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E00800",
};

export default function CapsuleLayout({ children }: { children: React.ReactNode }) {
  return <div className="cap-root">{children}</div>;
}
