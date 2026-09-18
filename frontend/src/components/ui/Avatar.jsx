// Tints drawn only from the brand blues — an avatar should identify a person,
// never hint at a risk level.
const TINTS = [
  ['#1a56db', '#2f7de8'],
  ['#0f2a5c', '#1a56db'],
  ['#1849c4', '#19b3d4'],
  ['#123380', '#2f66e0'],
  ['#2f7de8', '#19b3d4'],
]

function hash(text) {
  let value = 0
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) >>> 0
  return value
}

function initials(name) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

function Avatar({ name, size = 36, className = '' }) {
  const [from, to] = TINTS[hash(name || '?') % TINTS.length]
  return (
    <span
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
      aria-hidden="true"
    >
      {initials(name || '?')}
    </span>
  )
}

export default Avatar
