import "../styles/globals.css";
import { Toaster } from "@onescope/ui"
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TRPCReactProvider } from "@/trpc/react";

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
}: Readonly<{ children: React.ReactNode }>) {
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
