import PayLinkClient from "./PayLinkClient";

type PayLinkPageProps = {
  params: Promise<{ token: string }>;
};

export default async function PayLinkPage({ params }: PayLinkPageProps) {
  const { token } = await params;

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <PayLinkClient token={token} />
    </main>
  );
}
