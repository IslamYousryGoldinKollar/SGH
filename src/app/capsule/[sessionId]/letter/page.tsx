import LetterPage from "@/components/capsule/LetterPage";

export default async function CapsuleLetterPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <LetterPage sessionId={sessionId} />;
}
