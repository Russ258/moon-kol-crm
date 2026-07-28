import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/getProfile";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, userId } = await getProfile();

  if (!userId) redirect("/login");

  const nav = [
    { href: "/", label: "Overview" },
    { href: "/kols", label: "KOL Pipeline" },
    { href: "/contracts", label: "Contracts" },
    { href: "/payouts", label: "Payouts" },
    { href: "/team", label: "Team" },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-border bg-panel flex flex-col">
        <div className="px-5 py-6">
          <div className="text-orange font-bold tracking-widest text-xs">MOON INC.</div>
          <div className="text-sm font-semibold mt-1">KOL &amp; Affiliate CRM</div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm font-medium text-dark hover:bg-white hover:shadow-sm transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-border">
          <div className="text-xs text-gray-500">{profile?.email}</div>
          <div className="text-xs font-semibold text-orange uppercase tracking-wide">
            {profile?.role ?? "viewer"}
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 bg-white">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
