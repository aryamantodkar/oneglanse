"use client"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { Organization } from "@/server/db/types"
import { authClient } from "@lib/auth-client";
import { useEffect, useState } from "react";


export function OrganizationSwitcher (){
    const [organizations, setOrganizations] = useState<Organization[]>([]);

    useEffect(() => {
        const fetchAllOrganizations = async () => {
            const { data, error } = await authClient.organization.list();
            if (error) {
                console.error("Failed to fetch organizations:", error);
                return;
            }
            setOrganizations((data ?? []) as Organization[]);
        };
        fetchAllOrganizations();
    }, []);
    

    const handleChangeOrganization = async (organizationId: string) => {
        await authClient.organization.setActive({
            organizationId,
        });
    }

    return(
        <Select onValueChange={handleChangeOrganization} defaultValue="">
            <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select Organization" />
            </SelectTrigger>
            <SelectContent>
                {
                    organizations.map((organization) => (
                        <SelectItem key={organization.id} value={organization.id}>
                            {organization.name}
                        </SelectItem>
                    ))
                }
            </SelectContent>
        </Select>
    )
}