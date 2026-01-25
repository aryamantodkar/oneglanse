import "@/styles/globals.css";
import { Toaster } from "@/components/ui/sonner"
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies, headers } from "next/headers"
 
import { SidebarProvider } from "@/components/ui/sidebar"

import { TRPCReactProvider } from "@/trpc/react";
import LayoutContent from "./layoutContent";
import { getWorkspace } from "@/lib/workspace/getWorkspace";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

export const metadata: Metadata = {
	title: "onescopeAI",
	description: "The open-source alternative to PeecAI",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
  }) {
	const session = await auth.api.getSession({
		headers: await headers()
	})

	if (!session) {
        return redirect("/login")
    }

	const cookieStore = await cookies()
  	const defaultOpen = cookieStore.get("sidebar_state")?.value === "true" || true;

	let workspace = null;
	try {
		workspace = await getWorkspace();
	} catch {
		// workspace remains null
	}

	return (
		<>
			<TRPCReactProvider>
				<SidebarProvider defaultOpen={defaultOpen}>
					<LayoutContent workspace={workspace}>{children}</LayoutContent>
				</SidebarProvider>
			</TRPCReactProvider>
		</>
	);
}

