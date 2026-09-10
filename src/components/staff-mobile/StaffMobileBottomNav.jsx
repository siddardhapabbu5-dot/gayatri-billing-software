/** Phone-only staff bottom dock. Hidden on tablet/desktop via CSS. */
const ITEMS = [
  { id: "desk", label: "Home", icon: "🏠" },
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "reserve", label: "Booking", icon: "+", primary: true },
  { id: "billing", label: "Payments", icon: "₹" },
  { id: "more", label: "More", icon: "☰" },
];

export default function StaffMobileBottomNav({ page, onNavigate, onMore }) {
  return (
    <nav className="staff-m-dock no-print" aria-label="Staff phone navigation">
      {ITEMS.map((item) => {
        const active = item.id === "more" ? false : page === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`staff-m-dock-item${item.primary ? " is-primary" : ""}${active ? " is-on" : ""}`}
            onClick={() => (item.id === "more" ? onMore() : onNavigate(item.id))}
            aria-current={active ? "page" : undefined}
          >
            <span className="staff-m-dock-ico" aria-hidden="true">
              {item.icon}
            </span>
            <span className="staff-m-dock-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
