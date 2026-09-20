function initials(name) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Initials in a circle — one flat tone for everyone. Color here would
 * imply a reading that does not exist, so identity is carried by the
 * letters alone. */
function Avatar({ name, size = 30, className = '' }) {
  return (
    <span
      className={`avatar ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initials(name || '?')}
    </span>
  )
}

export default Avatar
