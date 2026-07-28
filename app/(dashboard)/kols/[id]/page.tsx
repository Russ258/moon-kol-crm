import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/getProfile";
import { STAGES, STAGE_LABELS, type Kol, type Contract, type Payout } from "@/lib/types";
import { createContract, createPayout, markPayoutPaid, updateContractStatus, updateKolStage } from "@/app/actions";
import { notFound } from "next/navigation";

export default async function KolDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { profile } = await getProfile();

  const { data: kol } = await supabase.from("kols").select("*").eq("id", params.id).single();
  if (!kol) notFound();
  const k = kol as Kol;

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*")
    .eq("kol_id", params.id)
    .order("created_at", { ascending: false });
  const contractList = (contracts ?? []) as Contract[];

  const canSeeContracts = profile && ["admin", "marketing", "finance"].includes(profile.role);
  const canEditKol = profile && ["admin", "marketing"].includes(profile.role);
  const canSeePayouts = profile && ["admin", "marketing", "finance"].includes(profile.role);
  const canEditPayouts = profile && ["admin", "finance"].includes(profile.role);

  let payoutList: Payout[] = [];
  if (canSeePayouts) {
    const { data: payouts } = await supabase
      .from("payouts")
      .select("*")
      .eq("kol_id", params.id)
      .order("created_at", { ascending: false });
    payoutList = (payouts ?? []) as Payout[];
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold">{k.name}</h1>
        <form
          action={async (formData: FormData) => {
            "use server";
            await updateKolStage(k.id, String(formData.get("stage")));
          }}
        >
          <select
            name="stage"
            defaultValue={k.stage}
            disabled={!canEditKol}
            className="text-xs font-semibold border border-border rounded-md px-2 py-1"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          {canEditKol && (
            <button type="submit" className="ml-2 text-xs underline text-orange">
              Update stage
            </button>
          )}
        </form>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {k.market} {k.platform ? `· ${k.platform}` : ""} {k.follower_count ? `· ${k.follower_count.toLocaleString()} followers` : ""}
      </p>

      <div className="grid grid-cols-2 gap-4 text-sm mb-8 border border-border rounded-lg p-4 bg-panel">
        <div>
          <div className="text-xs font-semibold text-gray-500">Contact</div>
          <div>{k.contact_email ?? "—"}</div>
          <div>{k.contact_telegram ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-500">Handle / link</div>
          <div>{k.handle_or_link ?? "—"}</div>
          <div className="text-xs font-semibold text-gray-500 mt-2">Referral code</div>
          <div>{k.referral_code ?? "Not yet assigned"}</div>
        </div>
      </div>

      {k.notes && (
        <div className="mb-8">
          <div className="text-xs font-semibold text-gray-500 mb-1">Notes</div>
          <p className="text-sm whitespace-pre-wrap">{k.notes}</p>
        </div>
      )}

      {/* CONTRACTS */}
      {canSeeContracts && (
        <section className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
            Contracts, proof of signing
          </h2>

          {contractList.length === 0 && <p className="text-sm text-gray-400 mb-4">No contract on file yet.</p>}

          <div className="space-y-3 mb-4">
            {contractList.map((c) => (
              <div key={c.id} className="border border-border rounded-lg p-4 flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{c.template_version}</div>
                  <div className="text-xs text-gray-500">
                    {c.signature_provider ?? "manual"} · status: <StatusPill status={c.status} />
                  </div>
                  {c.signed_at && (
                    <div className="text-xs text-gray-500 mt-1">
                      Signed {new Date(c.signed_at).toLocaleDateString()} by {c.signed_by_name ?? "—"}
                    </div>
                  )}
                  {c.file_url && (
                    <a href={c.file_url} target="_blank" className="text-xs text-orange underline mt-1 block">
                      View signed document
                    </a>
                  )}
                </div>
                {canEditKol && c.status !== "signed" && (
                  <form
                    action={async () => {
                      "use server";
                      await updateContractStatus(c.id, k.id, "signed");
                    }}
                  >
                    <button type="submit" className="text-xs font-semibold text-white bg-dark px-3 py-1.5 rounded-md">
                      Mark signed
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>

          {canEditKol && (
            <details className="text-sm">
              <summary className="cursor-pointer text-orange font-semibold text-xs">+ Link a new contract</summary>
              <form action={createContract} className="mt-3 space-y-3 border border-border rounded-lg p-4">
                <input type="hidden" name="kol_id" value={k.id} />
                <div>
                  <label className="block text-xs font-semibold mb-1">Template version / terms label</label>
                  <input
                    name="template_version"
                    required
                    placeholder="e.g. 2026-07 v1, $2.00 + 0.125%"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Signed document link</label>
                  <input
                    name="file_url"
                    placeholder="DocuSign completed envelope URL, or storage link"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Signature provider</label>
                  <input
                    name="signature_provider"
                    placeholder="DocuSign, HelloSign, manual upload"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Status</label>
                    <select name="status" defaultValue="draft" className="w-full border border-border rounded-md px-3 py-2 text-sm">
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="signed">Signed</option>
                      <option value="void">Void</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Signed by</label>
                    <input name="signed_by_name" className="w-full border border-border rounded-md px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Signed date</label>
                  <input type="date" name="signed_at" className="w-full border border-border rounded-md px-3 py-2 text-sm" />
                </div>
                <button type="submit" className="bg-orange text-white text-xs font-semibold px-3 py-2 rounded-md">
                  Save contract
                </button>
              </form>
            </details>
          )}
        </section>
      )}

      {/* PAYOUTS */}
      {canSeePayouts && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Payouts</h2>

          {payoutList.length === 0 && <p className="text-sm text-gray-400 mb-4">No payouts logged yet.</p>}

          <div className="space-y-2 mb-4">
            {payoutList.map((p) => (
              <div key={p.id} className="border border-border rounded-lg p-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-semibold">${Number(p.amount).toFixed(2)}</span>{" "}
                  <span className="text-gray-500">{p.type.replace("_", " ")}</span>
                  <div className="text-xs text-gray-400">{p.currency} · <StatusPill status={p.status} /></div>
                </div>
                {canEditPayouts && p.status === "pending" && (
                  <form
                    action={async () => {
                      "use server";
                      await markPayoutPaid(p.id, k.id);
                    }}
                  >
                    <button type="submit" className="text-xs font-semibold text-white bg-dark px-3 py-1.5 rounded-md">
                      Mark paid
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>

          {canEditPayouts && (
            <details className="text-sm">
              <summary className="cursor-pointer text-orange font-semibold text-xs">+ Log a payout</summary>
              <form action={createPayout} className="mt-3 space-y-3 border border-border rounded-lg p-4">
                <input type="hidden" name="kol_id" value={k.id} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Type</label>
                    <select name="type" defaultValue="activation_bonus" className="w-full border border-border rounded-md px-3 py-2 text-sm">
                      <option value="activation_bonus">Activation bonus</option>
                      <option value="residual">Residual</option>
                      <option value="ga_pass_reimbursement">GA pass reimbursement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Amount</label>
                    <input name="amount" type="number" step="0.01" required className="w-full border border-border rounded-md px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Wallet address</label>
                  <input name="wallet_address" defaultValue={k.wallet_address ?? ""} className="w-full border border-border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Reference / note</label>
                  <input name="reference" className="w-full border border-border rounded-md px-3 py-2 text-sm" />
                </div>
                <button type="submit" className="bg-orange text-white text-xs font-semibold px-3 py-2 rounded-md">
                  Save payout
                </button>
              </form>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    signed: "text-green-700",
    paid: "text-green-700",
    draft: "text-gray-500",
    pending: "text-orange",
    sent: "text-orange",
    void: "text-red-600",
    failed: "text-red-600",
  };
  return <span className={`font-semibold ${colors[status] ?? "text-gray-500"}`}>{status}</span>;
}
