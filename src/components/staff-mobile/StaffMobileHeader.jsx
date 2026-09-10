/** Phone-only staff sticky header. Hidden on tablet/desktop via CSS. */
export default function StaffMobileHeader({ brand = "Gayatri", notifyTitle, onOpenMenu, onProfile }) {
  return (
    <header className="staff-m-header no-print" role="banner">
      <button type="button" className="staff-m-icon-btn" aria-label="Open menu" onClick={onOpenMenu}>
        <span className="staff-m-icon" aria-hidden="true">
          ☰
        </span>
      </button>
      <div className="staff-m-brand">
        <img src="/site/images/logo-gold.png" alt="" className="staff-m-logo" />
        <strong>{brand}</strong>
      </div>
      <div className="staff-m-header-actions">
        <button
          type="button"
          className="staff-m-icon-btn"
          aria-label={notifyTitle ? `Notifications: ${notifyTitle}` : "Notifications"}
          title={notifyTitle || "Notifications"}
        >
          <span className="staff-m-icon" aria-hidden="true">
            🔔
          </span>
        </button>
        <button type="button" className="staff-m-icon-btn" aria-label="Profile" onClick={onProfile}>
          <span className="staff-m-icon" aria-hidden="true">
            👤
          </span>
        </button>
      </div>
    </header>
  );
}
