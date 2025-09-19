import { Logout } from "@/components/forms/logout";
import { OrganizationSwitcher } from "@/components/organization-switcher";

export async function Header() {
  return (
    <header className="flex items-center justify-between p-4 border-b">
      <OrganizationSwitcher/>
      <div className="flex items-center gap-4">
        <Logout />
      </div>
    </header>
  );
}