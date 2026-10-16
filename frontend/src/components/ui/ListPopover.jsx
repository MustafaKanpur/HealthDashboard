import { useId, useRef } from 'react'

/** A count that opens a popover listing the names behind it. Takes the same
 * entries the chart panels get (anything with a `description`); duplicates
 * collapse to one name, and the count shown is the number of names listed,
 * so the two can never disagree. Entries that carry a `category` are grouped
 * under a heading per category. The native `popover` attribute handles
 * opening and closing (click outside, Escape, click the count again). */
function ListPopover({ entries, label }) {
  const id = useId()
  const popoverRef = useRef(null)
  const categoryByName = new Map(entries.map((entry) => [entry.description, entry.category]))
  const names = [...categoryByName.keys()].sort((a, b) => a.localeCompare(b))
  const groups = [...categoryByName.values()].some(Boolean)
    ? Object.entries(Object.groupBy(names, (name) => categoryByName.get(name))).sort(([a], [b]) => a.localeCompare(b))
    : null

  if (names.length === 0) return 0

  // A popover renders in the top layer, detached from its trigger, so pin it
  // under the trigger's right edge just before the browser opens it.
  // ponytail: placed once per open; doesn't follow the trigger if the window
  // resizes while open. CSS anchor positioning replaces this once widely supported.
  const placeUnderTrigger = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    popoverRef.current.style.top = `${rect.bottom + window.scrollY + 6}px`
    popoverRef.current.style.right = `${document.documentElement.clientWidth - rect.right - window.scrollX}px`
  }

  return (
    <>
      <button
        type="button"
        className="list-popover-trigger"
        popovertarget={id}
        onClick={placeUnderTrigger}
        aria-label={`Show ${names.length} ${label}`}
      >
        {names.length}
      </button>
      <div id={id} ref={popoverRef} popover="auto" className="list-popover" aria-label={label}>
        {groups ? (
          groups.map(([category, groupNames], index) => (
            <div key={category} className="list-popover-group">
              <div id={`${id}-${index}`} className="list-popover-heading">
                {category}
              </div>
              <NameList names={groupNames} labelledBy={`${id}-${index}`} />
            </div>
          ))
        ) : (
          <NameList names={names} />
        )}
      </div>
    </>
  )
}

function NameList({ names, labelledBy }) {
  return (
    <ul aria-labelledby={labelledBy}>
      {names.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  )
}

export default ListPopover
