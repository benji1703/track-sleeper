import clsx from 'clsx'
import BottomNav from '@/components/BottomNav'

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-ink/8', className)} />
}

export function LoadErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-orange/30 bg-orange/5 px-6 py-8 text-center">
      <p className="text-[13px] text-orange">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="h-12 rounded-full border border-orange px-6 text-[11px] tracking-[0.2em] uppercase text-orange transition-colors active:bg-orange/10"
      >
        Retry
      </button>
    </div>
  )
}

type PageSkeletonVariant = 'tracker' | 'history' | 'settings'

export function PageSkeleton({ variant }: { variant: PageSkeletonVariant }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-6 pb-28 pt-10">
      {variant === 'tracker' && <TrackerSkeletonBody />}
      {variant === 'history' && <HistorySkeletonBody />}
      {variant === 'settings' && <SettingsSkeletonBody />}
      <BottomNav />
    </main>
  )
}

function TrackerSkeletonBody() {
  return (
    <>
      <header className="mb-10 flex flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-32" />
      </header>

      <div className="flex flex-col items-center gap-8 rounded-2xl border border-ink/15 px-6 py-8">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-11 w-full rounded-full bg-sand/60" />
        <Skeleton className="h-14 w-full rounded-full bg-sand/60" />
      </div>

      <section className="mt-10 flex flex-col gap-4">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-8 w-full rounded-full bg-sand/60" />
        <div className="flex items-baseline justify-between border-t border-ink/15 pt-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-7 w-8" />
          </div>
        </div>
      </section>
    </>
  )
}

function HistorySkeletonBody() {
  return (
    <>
      <header className="mb-8 flex items-baseline justify-between">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-24" />
      </header>

      <section className="mb-8 grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-ink/15 px-5 py-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-ink/15 px-5 py-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-10" />
        </div>
      </section>

      <ul className="flex flex-col gap-5">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
            <Skeleton className="h-6 w-full rounded-full bg-sand/60" />
          </li>
        ))}
      </ul>
    </>
  )
}

function SettingsSkeletonBody() {
  return (
    <>
      <header className="mb-10">
        <Skeleton className="h-7 w-28" />
      </header>

      <div className="flex flex-col gap-8 rounded-2xl border border-ink/15 px-6 py-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <Skeleton className="h-14 w-full rounded-full bg-sand/60" />
      </div>
    </>
  )
}
