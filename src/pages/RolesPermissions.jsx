import RolesPermissionsPanel from "../components/RolesPermissionsPanel.jsx";
import { PageHead } from "../ui";

export default function RolesPermissions({ canEdit }) {
  return (
    <>
      <PageHead title="Roles & Permissions" sub="Staff actions and refund limit" />
      <RolesPermissionsPanel canEdit={canEdit} />
    </>
  );
}
