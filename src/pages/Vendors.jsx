import { formatDate, money } from "../lib";
import { PageHead, Pill } from "../ui";

export default function Vendors({ state, onVendor, onPO }) {
  return (
    <>
      <PageHead title="Vendors" sub="Decorator, photographer, DJ, florist, security, transport — PO → service → invoice → payment.">
        <button
          className="btn ghost"
          onClick={() => {
            const name = window.prompt("Vendor name");
            const trade = window.prompt("Trade");
            if (name) onVendor({ name, trade: trade || "Other", phone: "", city: "Konaseema" });
          }}
        >
          Add vendor
        </button>
        <button
          className="btn"
          onClick={() => {
            const vendorId = state.vendors[0]?.id;
            const service = window.prompt("Service");
            const amount = window.prompt("Amount");
            if (vendorId && service) onPO({ vendorId, service, amount, bookingId: state.bookings[0]?.id });
          }}
        >
          New PO
        </button>
      </PageHead>
      <div className="g2">
        <div className="panel">
          <h3>Directory</h3>
          <table>
            <thead><tr><th>Vendor</th><th>Trade</th><th>City</th><th></th></tr></thead>
            <tbody>
              {state.vendors.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}<div className="muted">{v.phone}</div></td>
                  <td>{v.trade}</td>
                  <td>{v.city}</td>
                  <td><Pill status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Purchase orders</h3>
          <table>
            <thead><tr><th>PO</th><th>Vendor</th><th>Service</th><th>Amount</th></tr></thead>
            <tbody>
              {state.purchaseOrders.map((p) => {
                const v = state.vendors.find((x) => x.id === p.vendorId);
                return (
                  <tr key={p.id}>
                    <td>{p.number}<div className="muted">{formatDate(p.at)}</div></td>
                    <td>{v?.name}</td>
                    <td>{p.service}</td>
                    <td>{money(p.amount, state.property.currency, state.property.locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
