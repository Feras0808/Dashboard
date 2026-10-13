
import { Suspense } from "react";
import TicketDetailsClient from "./TicketDetailsClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function TicketDetailsPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
          <p className="text-sm text-gray-500">
            Loading ticket details...
          </p>
        </main>
      }
    >
      <TicketDetailsRoute params={params} />
    </Suspense>
  );
}

async function TicketDetailsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TicketDetailsClient ticketId={id} />;
}
