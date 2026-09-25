import StaffUsersPanel from "../components/StaffUsersPanel.jsx";
import { PageHead } from "../ui";

export default function UserManagement({ authRole, canManage }) {
  return (
    <>
      <PageHead title="User Management" sub="Staff accounts" />
      <StaffUsersPanel canManage={canManage} authRole={authRole} standalone />
    </>
  );
}
