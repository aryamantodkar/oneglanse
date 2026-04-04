import "../styles/globals.css";
import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "@oneglanse/ui";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Geist } from "next/font/google";

export const metadata: Metadata = {
	title: "OneGlanse",
	description: "The open-source alternative to PeecAI",
	icons: {
		icon: "/icon.svg",
	},
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
	return (
		<html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
			<body>
				<ThemeProvider attribute="class" defaultTheme="light" enableSystem>
					<TRPCReactProvider>
						{children}
						<Toaster />
					</TRPCReactProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
