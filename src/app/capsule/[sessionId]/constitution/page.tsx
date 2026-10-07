import ConstitutionPage from "@/components/capsule/ConstitutionPage";

export default async function CapsuleConstitutionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ConstitutionPage sessionId={sessionId} />;
}
