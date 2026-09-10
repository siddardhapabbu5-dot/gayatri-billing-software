/**
 * Phone-only right off-canvas drawer with accordion groups.
 * Only main categories shown until expanded (one open at a time).
 */
export default function StaffMobileDrawer({
  open,
  brand = "Gayatri",
  groups,
  openGroup,
  onToggleGroup,
  page,
  userName,
  userRole,
  onNavigate,
  onClose,
  onLogout,
  onPublicSite,
}) {
  return (
    <>
      <div
        className={`staff-m-backdrop${open ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`staff-m-drawer${open ? " is-open" : ""}`}
        aria-hidden={!open}
        aria-label="Staff menu"
      >
        <div className="staff-m-drawer-head">
          <div>
            <strong className="staff-m-drawer-title">{brand}</strong>
            <div className="staff-m-drawer-sub">Convention</div>
          </div>
          <button type="button" className="staff-m-icon-btn staff-m-drawer-close" aria-label="Close menu" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="staff-m-drawer-scroll">
          <button
            type="button"
            className={`staff-m-drawer-link${page === "desk" ? " is-on" : ""}`}
            onClick={() => onNavigate("desk")}
          >
            <span aria-hidden="true">🏠</span> Home
          </button>

          {groups.map((g) => {
            const isOpen = openGroup === g.label;
            return (
              <div key={g.label} className={`staff-m-acc${isOpen ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="staff-m-acc-toggle"
                  aria-expanded={isOpen}
                  onClick={() => onToggleGroup(g.label)}
                >
                  <span className="staff-m-acc-label">
                    <span className="staff-m-acc-ico" aria-hidden="true">
                      {g.icon}
                    </span>
                    {g.label}
                  </span>
                  <span className={`staff-m-acc-chevron${isOpen ? " is-open" : ""}`} aria-hidden="true">
                    ›
                  </span>
                </button>
                <div className="staff-m-acc-panel" aria-hidden={!isOpen}>
                  {g.items.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      className={`staff-m-drawer-link nested${page === i.id ? " is-on" : ""}`}
                      onClick={() => onNavigate(i.id)}
                      tabIndex={isOpen ? 0 : -1}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <button type="button" className="staff-m-drawer-link" onClick={onPublicSite}>
            <span aria-hidden="true">🌐</span> Public site
          </button>
        </div>

        <div className="staff-m-drawer-foot">
          <div className="staff-m-drawer-user">
            <span aria-hidden="true">👤</span>
            <div>
              <strong>{userName}</strong>
              <div className="muted">{userRole}</div>
            </div>
          </div>
          <button type="button" className="btn ghost small staff-m-logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
