import ScreenView from "@/components/capsule/ScreenView";

export default async function CapsuleScreenPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ScreenView sessionId={sessionId} />;
}
