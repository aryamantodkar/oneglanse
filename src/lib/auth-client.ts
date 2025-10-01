import { createAuthClient } from "better-auth/client"
import { organizationClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    baseURL: "http://localhost:3000",
    plugins: [ 
        organizationClient() 
    ] 
})