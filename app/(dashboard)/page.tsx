import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MARKETS, STAGE_LABELS, type Kol } from "@/lib/types";

export default async function OverviewPage() {
  const supabase = createClient();
  const { data: kols } = await supabase.from("kols").select("*");
  const list = (kols ?? []) as Kol[];

  const byStage = list.reduce<Record<string, number>>((acc, k) => {
    acc[k.stage] = (acc[k.stage] ?? 0) + 1;
    return acc;
  }, {});

  const byMarket = MARKETS.map((m) => ({
    market: m,
    count: list.filter((k) => k.market === m).length,
  })).filter((m) => m.count > 0);

  const { data: pendingPayouts } = await supabase
    .from("payouts")
    .select("amount")
    .eq("status", "pending");
  const pendingTotal = (pendingPayouts ?? []).reduce((sum, p: any) => sum + Number(p.amount), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Overview</h1>
      <p className="text-sm text-gray-500 mb-8">
        Moon Card KOL and affiliate program, across Hong Kong, Taiwan, Vietnam, Thailand, and India.
      </p>

      <div className="grid grid-cols-4 gap-4 mb-10">
        <StatCard label="Total KOLs" value={list.length} />
        <StatCard label="Active" value={byStage["active"] ?? 0} />
        <StatCard label="In pipeline" value={list.length - (byStage["active"] ?? 0) - (byStage["declined"] ?? 0)} />
        <StatCard label="Pending payouts" value={`$${pendingTotal.toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">By stage</h2>
          <div className="space-y-2">
            {Object.entries(STAGE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between border-b border-border py-2">
                <span className="text-sm">{label}</span>
                <span className="text-sm font-semibold">{byStage[key] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">By market</h2>
          <div className="space-y-2">
            {byMarket.length === 0 && <p className="text-sm text-gray-400">No KOLs yet.</p>}
            {byMarket.map((m) => (
              <div key={m.market} className="flex items-center justify-between border-b border-border py-2">
                <span className="text-sm">{m.market}</span>
                <span className="text-sm font-semibold">{m.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <Link
          href="/kols/new"
          className="inline-block bg-orange text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-hover transition"
        >
          + Add a KOL
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-panel">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
