import { PageSkeleton } from "@/components/layout/page-skeleton";

// Shown at once when moving between admin screens, until the new one is ready.
export default function AdminLoading() {
  return <PageSkeleton />;
}
