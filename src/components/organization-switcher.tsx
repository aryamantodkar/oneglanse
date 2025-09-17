"use client"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { Organization } from "@/server/db/auth-schema"
import { authClient } from "@lib/auth-client";


interface OrganizerSwitcherProps {
    organizations: Organization[];
}

export function OrganizationSwitcher ({
    organizations
}: OrganizerSwitcherProps){
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