// app/dashboard/page.tsx (server component)
import { getOrganizations } from "@/server/api/routers/organization/organizations"
import DashboardClient from "./dashboard-client"

export default async function DashboardPage() {
  const organizations = await getOrganizations()

  return <DashboardClient organizations={organizations} />
}