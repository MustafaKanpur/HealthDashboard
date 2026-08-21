// Small hand-authored stroke-icon set (no icon-library dependency).
// Consistent 24x24 viewBox, currentColor stroke, rounded caps/joins.

function Icon({ size = 18, strokeWidth = 1.8, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconSearch(props) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.2" y2="16.2" />
    </Icon>
  )
}

export function IconFilter(props) {
  return (
    <Icon {...props}>
      <polygon points="4,4 20,4 14,12.5 14,19 10,21 10,12.5" />
    </Icon>
  )
}

export function IconChevronRight(props) {
  return (
    <Icon {...props}>
      <polyline points="9,5 16,12 9,19" />
    </Icon>
  )
}

export function IconArrowLeft(props) {
  return (
    <Icon {...props}>
      <line x1="20" y1="12" x2="4" y2="12" />
      <polyline points="10,6 4,12 10,18" />
    </Icon>
  )
}

export function IconFlask(props) {
  return (
    <Icon {...props}>
      <path d="M9 3h6" />
      <path d="M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3" />
      <path d="M7.5 15h9" />
    </Icon>
  )
}

export function IconClipboard(props) {
  return (
    <Icon {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <line x1="8.5" y1="10" x2="15.5" y2="10" />
      <line x1="8.5" y1="14" x2="15.5" y2="14" />
      <line x1="8.5" y1="18" x2="13" y2="18" />
    </Icon>
  )
}

export function IconPill(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="9.5" width="17" height="7" rx="3.5" transform="rotate(-45 12 13)" />
      <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" transform="rotate(-45 12 13)" />
    </Icon>
  )
}

export function IconSparkle(props) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5L5 10.6 10.4 9z" />
      <path d="M19 3.5v3" />
      <path d="M17.5 5h3" />
    </Icon>
  )
}

export function IconCheckCircle(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <polyline points="8.3,12.2 10.8,14.7 15.7,9.6" />
    </Icon>
  )
}

export function IconAlertTriangle(props) {
  return (
    <Icon {...props}>
      <path d="M12 4 21.5 20H2.5Z" />
      <line x1="12" y1="10" x2="12" y2="14.5" />
      <circle cx="12" cy="17.3" r="0.5" fill="currentColor" />
    </Icon>
  )
}

export function IconAlertOctagon(props) {
  return (
    <Icon {...props}>
      <polygon points="7.9,3 16.1,3 21,7.9 21,16.1 16.1,21 7.9,21 3,16.1 3,7.9" />
      <line x1="12" y1="8" x2="12" y2="12.5" />
      <circle cx="12" cy="15.3" r="0.5" fill="currentColor" />
    </Icon>
  )
}

export function IconUsers(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 6.1" />
      <path d="M16.5 14.6c2.8.4 4.5 2.4 4.5 5.4" />
    </Icon>
  )
}

export function IconX(props) {
  return (
    <Icon {...props}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </Icon>
  )
}

export function IconTarget(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </Icon>
  )
}

export function IconTrendingUp(props) {
  return (
    <Icon {...props}>
      <polyline points="3,17 10,10 14,14 21,6" />
      <polyline points="15,6 21,6 21,12" />
    </Icon>
  )
}

export function IconLink(props) {
  return (
    <Icon {...props}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 12.6 4.9a3.5 3.5 0 0 1 5 5L16 11.5" />
      <path d="M13 17.5 11.4 19.1a3.5 3.5 0 0 1-5-5L8 12.5" />
    </Icon>
  )
}

export function IconPulse(props) {
  return (
    <Icon {...props}>
      <polyline points="2,12 7,12 9.5,5.5 14,18.5 16.5,12 22,12" />
    </Icon>
  )
}
