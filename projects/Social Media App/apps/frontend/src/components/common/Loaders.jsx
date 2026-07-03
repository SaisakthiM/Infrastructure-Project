export function Spinner({ size = 'md', className = '' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size];
  return (
    <div className={`${s} border-2 border-white/10 border-t-violet-500 rounded-full animate-spin ${className}`} />
  );
}

export function PostSkeleton() {
  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/10" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-32 bg-white/10 rounded" />
          <div className="h-2.5 w-20 bg-white/5 rounded" />
        </div>
      </div>
      <div className="h-40 bg-white/5 rounded-xl" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-white/5 rounded" />
        <div className="h-3 w-3/4 bg-white/5 rounded" />
      </div>
    </div>
  );
}

export function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-white/10" />
      <div className="space-y-1.5 flex-1">
        <div className="h-3 w-24 bg-white/10 rounded" />
        <div className="h-2.5 w-16 bg-white/5 rounded" />
      </div>
    </div>
  );
}

