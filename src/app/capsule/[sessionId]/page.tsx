import LeaderFlow from "@/components/capsule/LeaderFlow";

export default async function CapsuleLeaderPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <LeaderFlow sessionId={sessionId} />;
}
