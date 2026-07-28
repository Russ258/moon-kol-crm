import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STAGES, STAGE_LABELS, type Kol } from "@/lib/types";

export default async function KolPipelinePage({
  searchParams,
}: {
  searchParams: { market?: string };
}) {
  const supabase = createClient();
  let query = supabase.from("kols").select("*").order("created_at", { ascending: false });
  if (searchParams.market) query = query.eq("market", searchParams.market);
  const { data: kols } = await query;
  const list = (kols ?? []) as Kol[];

  const markets = ["Hong Kong", "Taiwan", "Vietnam", "Thailand", "India", "Other"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">KOL Pipeline</h1>
          <p className="text-sm text-gray-500">{list.length} total</p>
        </div>
        <Link
          href="/kols/new"
          className="bg-orange text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-hover transition"
        >
          + Add a KOL
        </Link>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Link
          href="/kols"
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
            !searchParams.market ? "bg-dark text-white border-dark" : "border-border text-gray-600"
          }`}
        >
          All markets
        </Link>
        {markets.map((m) => (
          <Link
            key={m}
            href={`/kols?market=${encodeURIComponent(m)}`}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              searchParams.market === m ? "bg-dark text-white border-dark" : "border-border text-gray-600"
            }`}
          >
            {m}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4 overflow-x-auto">
        {STAGES.map((stage) => (
          <div key={stage} className="min-w-[220px]">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 flex items-center justify-between">
              <span>{STAGE_LABELS[stage]}</span>
              <span className="text-gray-400">{list.filter((k) => k.stage === stage).length}</span>
            </div>
            <div className="space-y-2">
              {list
                .filter((k) => k.stage === stage)
                .map((k) => (
                  <Link
                    key={k.id}
                    href={`/kols/${k.id}`}
                    className="block border border-border rounded-lg p-3 bg-white hover:border-orange transition"
                  >
                    <div className="text-sm font-semibold truncate">{k.name}</div>
                    <div className="text-xs text-gray-500">{k.market}</div>
                    {k.follower_count && (
                      <div className="text-xs text-gray-400 mt-1">
                        {k.follower_count.toLocaleString()} followers
                      </div>
                    )}
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
