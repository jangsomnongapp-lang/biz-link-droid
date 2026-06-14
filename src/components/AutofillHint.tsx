import { Skeleton } from "@/components/ui/skeleton";

export function AutofillHint({ loading, filled }: { loading: boolean; filled: boolean }) {
  if (loading) return <Skeleton className="mt-1.5 h-3 w-28" />;
  if (!filled) return null;
  return <p className="mt-1 text-[10px] text-muted-foreground">Auto-filled · tap to edit</p>;
}