import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/getProfile";
import { markPayoutPaid } from "@/app/actions";

export default async function PayoutsPage() {
  const { profile } = await getProfile();
  const supabase = createClient();

  if (!profile || !["admin", "marketing", "finance"].includes(profile.role)) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Payouts</h1>
        <p className="text-sm text-gray-500">You do not have access to view payouts.</p>
      </div>
    );
  }

  const canEdit = ["admin", "finance"].includes(profile.role);

  const { data: payouts } = await supabase
    .from("payouts")
    .select("*, kols(name, market)")
    .order("created_at", { ascending: false });

  const list = payouts ?? [];
  const pendingTotal = list.filter((p: any) => p.status === "pending").reduce((s: number, p: any) => s + Number(p.amount), 0);
  const paidTotal = list.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Payouts</h1>
      <p className="text-sm text-gray-500 mb-6">
        ${pendingTotal.toLocaleString()} pending · ${paidTotal.toLocaleString()} paid
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase border-b border-border">
            <th className="py-2">KOL</th>
            <th className="py-2">Type</th>
            <th className="py-2">Amount</th>
            <th className="py-2">Status</th>
            <th className="py-2">Wallet</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {list.map((p: any) => (
            <tr key={p.id} className="border-b border-border">
              <td className="py-3">
                <Link href={`/kols/${p.kol_id}`} className="font-semibold hover:text-orange">
                  {p.kols?.name ?? "—"}
                </Link>
              </td>
              <td className="py-3">{String(p.type).replace("_", " ")}</td>
              <td className="py-3">
                ${Number(p.amount).toFixed(2)} {p.currency}
              </td>
              <td className="py-3 capitalize">{p.status}</td>
              <td className="py-3 text-xs text-gray-500">{p.wallet_address ?? "—"}</td>
              <td className="py-3">
                {canEdit && p.status === "pending" && (
                  <form
                    action={async () => {
                      "use server";
                      await markPayoutPaid(p.id, p.kol_id);
                    }}
                  >
                    <button type="submit" className="text-xs font-semibold text-white bg-dark px-3 py-1.5 rounded-md">
                      Mark paid
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-gray-400 text-center">
                No payouts logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
