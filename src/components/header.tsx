import { Logout } from "@/components/forms/logout";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { getOrganizations } from "@/server/api/routers/organization/organizations";

export async function Header() {
  const organizations = await getOrganizations()

  return (
    <header className="flex items-center justify-between p-4 border-b">
      <OrganizationSwitcher organizations={organizations} />
      <div className="flex items-center gap-4">
        <Logout />
      </div>
    </header>
  );
}