import { Skeleton } from "@/components/ui/skeleton";

/* ── Post card skeleton (home feed) ── */
export function PostSkeleton() {
  return (
    <div className="space-y-3 bg-surface p-3 shadow-card">
      {/* Header: avatar + name + time */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      {/* Content lines */}
      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
      {/* Image placeholder */}
      <Skeleton className="aspect-[16/10] w-full rounded-lg" />
      {/* Action bar */}
      <div className="flex items-center gap-4 pt-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-2 space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

/* ── Shop grid skeleton (2-column cards) ── */
export function ShopCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
      <Skeleton className="h-44 w-full flex-shrink-0" />
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
        <Skeleton className="h-2.5 w-2/3" />
      </div>
    </div>
  );
}

export function ShopGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ShopCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ── Rental / listing row skeleton ── */
export function ListRowSkeleton() {
  return (
    <div className="rounded-xl bg-surface p-3 shadow-card">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-12 rounded-full" />
          </div>
          <Skeleton className="h-2.5 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="space-y-1 text-right">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      </div>
      <Skeleton className="mt-3 h-8 w-full rounded-lg" />
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </div>
  );
}

/* ── Listing card skeleton (listings page) ── */
export function ListingCardSkeleton() {
  return (
    <div className="block rounded-xl bg-surface p-3 shadow-card">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-1 h-3 w-full" />
      <Skeleton className="mt-1 h-3 w-2/3" />
      <div className="mt-2 flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function ListingListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ── Message thread skeleton ── */
export function MessageRowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-full" />
      </div>
      <div className="flex flex-col items-end gap-1">
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    </li>
  );
}

export function MessageListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <MessageRowSkeleton key={i} />
      ))}
    </ul>
  );
}

/* ── My content card skeleton ── */
export function ContentCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-xl bg-surface shadow-card">
      <Skeleton className="aspect-[16/9] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-2 pt-2 border-t border-border mt-2">
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="h-8 flex-1 rounded-md" />
        </div>
      </div>
    </article>
  );
}

export function ContentListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ContentCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ── Rewards page skeleton ── */
export function RewardsSkeleton() {
  return (
    <div className="mx-auto max-w-md px-4 pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      {/* Ticket card */}
      <Skeleton className="h-48 w-full rounded-2xl" />
      {/* Streak card */}
      <Skeleton className="h-28 w-full rounded-2xl" />
      {/* Active tickets card */}
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
