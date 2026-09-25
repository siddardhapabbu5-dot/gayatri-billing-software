import RolesPermissionsPanel from "../components/RolesPermissionsPanel.jsx";
import { PageHead } from "../ui";

export default function RolesPermissions({ canEdit }) {
  return (
    <>
      <PageHead
        title="Roles & Permissions"
        sub="Owner controls for day-to-day staff actions, manager refund limit, and audit history."
      />
      <RolesPermissionsPanel canEdit={canEdit} />
    </>
  );
}
