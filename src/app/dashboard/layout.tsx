import { Header } from "@/components/header";

export default function DashboardLayout({
    children,
} : {
    children: React.ReactNode;
}) {
    return (
        <div>
            <Header/>
            {children}
        </div>
    )
}