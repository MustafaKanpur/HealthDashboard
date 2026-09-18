/** The one surface every content block sits on: frosted card, optional
 * icon + title + one-line hint header, optional right-aligned actions. */
function Card({ icon: Icon, title, hint, actions, index = 0, className = '', children }) {
  return (
    <section className={`card reveal ${className}`} style={{ '--i': index }}>
      {(title || actions) && (
        <header className="card-header">
          {Icon && (
            <span className="card-title-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
          )}
          <div className="card-heading">
            {title && <h3 className="card-title">{title}</h3>}
            {hint && <p className="card-hint">{hint}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export default Card
