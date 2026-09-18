/** Consistent page header: small eyebrow label, display title, one-line
 * subtitle, and an optional right-aligned slot for actions. */
function PageHero({ eyebrow, title, subtitle, actions, children }) {
  return (
    <header className="page-hero reveal">
      <div className="page-hero-text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-hero-actions">{actions}</div>}
      {children}
    </header>
  )
}

export default PageHero
