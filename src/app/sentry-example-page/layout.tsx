// Force dynamic rendering to avoid Clerk issues during static generation
export const dynamic = 'force-dynamic';

export default function SentryExampleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
