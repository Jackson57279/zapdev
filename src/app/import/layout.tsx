// Force dynamic rendering to avoid Clerk issues during static generation
export const dynamic = 'force-dynamic';

export default function ImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
