import StaffUsersPanel from "../components/StaffUsersPanel.jsx";
import { PageHead } from "../ui";

export default function UserManagement({ authRole, canManage }) {
  return (
    <>
      <PageHead
        title="User Management"
        sub={
          authRole === "admin"
            ? "Create and manage staff accounts. Owner and Manager accounts stay Owner-controlled."
            : "Create and manage Front Desk Staff accounts only."
        }
      />
      <StaffUsersPanel canManage={canManage} authRole={authRole} standalone />
    </>
  );
}
