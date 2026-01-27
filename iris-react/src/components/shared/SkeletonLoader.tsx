import { cn } from '@/lib/utils'

interface SkeletonLoaderProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export function SkeletonLoader({
  className,
  variant = 'rectangular',
  width,
  height,
}: SkeletonLoaderProps) {
  return (
    <div
      className={cn(
        'skeleton',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded h-4',
        variant === 'rectangular' && 'rounded-lg',
        className
      )}
      style={{
        width: width ?? '100%',
        height: height ?? (variant === 'text' ? '1rem' : '100%'),
      }}
    />
  )
}

export function KPICardSkeleton() {
  return (
    <div className="glass-card p-6 space-y-3">
      <SkeletonLoader variant="text" width="40%" />
      <SkeletonLoader variant="text" height="2.5rem" width="60%" />
      <SkeletonLoader variant="text" width="80%" />
    </div>
  )
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="glass-card p-6">
      <SkeletonLoader variant="text" width="30%" className="mb-4" />
      <SkeletonLoader variant="rectangular" height={height} />
    </div>
  )
}
