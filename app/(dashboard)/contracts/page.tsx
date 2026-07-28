import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/getProfile";

export default async function ContractsPage() {
  const { profile } = await getProfile();
  const supabase = createClient();

  if (!profile || !["admin", "marketing", "finance"].includes(profile.role)) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Contracts</h1>
        <p className="text-sm text-gray-500">You do not have access to view contracts.</p>
      </div>
    );
  }

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*, kols(name, market)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contracts</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase border-b border-border">
            <th className="py-2">KOL</th>
            <th className="py-2">Market</th>
            <th className="py-2">Terms</th>
            <th className="py-2">Status</th>
            <th className="py-2">Signed</th>
            <th className="py-2">Document</th>
          </tr>
        </thead>
        <tbody>
          {(contracts ?? []).map((c: any) => (
            <tr key={c.id} className="border-b border-border">
              <td className="py-3">
                <Link href={`/kols/${c.kol_id}`} className="font-semibold hover:text-orange">
                  {c.kols?.name ?? "—"}
                </Link>
              </td>
              <td className="py-3">{c.kols?.market ?? "—"}</td>
              <td className="py-3">{c.template_version}</td>
              <td className="py-3 capitalize">{c.status}</td>
              <td className="py-3">{c.signed_at ? new Date(c.signed_at).toLocaleDateString() : "—"}</td>
              <td className="py-3">
                {c.file_url ? (
                  <a href={c.file_url} target="_blank" className="text-orange underline">
                    View
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
          {(contracts ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-gray-400 text-center">
                No contracts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
