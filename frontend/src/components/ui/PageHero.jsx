/** Consistent page header: a quiet meta line, the title carrying the
 * hierarchy through size and weight, and a one-line subtitle. */
function PageHero({ meta, title, subtitle, actions, children }) {
  return (
    <header className="page-hero reveal">
      <div className="page-hero-text">
        {meta && <div className="page-meta">{meta}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-hero-actions">{actions}</div>}
      {children}
    </header>
  )
}

export default PageHero
