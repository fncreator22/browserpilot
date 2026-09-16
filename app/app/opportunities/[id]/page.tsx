import OpportunityDetailPage from "@/app/opportunities/[id]/page";

export const dynamic = "force-dynamic";

export default async function AppOpportunityDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return <OpportunityDetailPage {...props} isInsideApp={true} />;
}

