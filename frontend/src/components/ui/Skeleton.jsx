/** Shimmering placeholder shaped like the content that's loading, so layout
 * doesn't jump and the wait reads as "arriving" rather than "broken". */
function Skeleton({ width = '100%', height = 14, radius = 6, className = '', style }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '62%' : '100%'} />
      ))}
    </div>
  )
}

export default Skeleton
