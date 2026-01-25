"use client";

import { authClient } from "@/lib/auth/auth-client";
import type { Organization } from "@/server/db/types";
import { useEffect, useState } from "react";

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAllOrganizations = async () => {
        try {
          setIsLoading(true);
          const { data, error } = await authClient.organization.list();
    
          if (error) {
            console.error("Failed to fetch organizations:", error);
            return;
          }
    
          const orgs = (data ?? []) as Organization[];
          setOrganizations(orgs);
        } catch (err) {
          console.error("Error fetching organizations:", err);
        }
        finally{
          setIsLoading(false);
        }
      };
  
    fetchAllOrganizations();
  }, []);
  
  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Organizations</h1>

      {isLoading && (
        <p className="text-sm text-gray-500">Loading organizations…</p>
      )}

      {!isLoading && organizations.length === 0 && (
        <p className="text-sm text-gray-500">
          You don’t belong to any organizations yet.
        </p>
      )}

      <ul className="space-y-2">
        {organizations.map((org) => (
          <li
            key={org.id}
            className="border rounded px-3 py-2 flex justify-between items-center"
          >
            <span>{org.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}