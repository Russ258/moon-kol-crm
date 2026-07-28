import { createKol } from "@/app/actions";
import { MARKETS, STAGES, STAGE_LABELS } from "@/lib/types";

export default function NewKolPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Add a KOL</h1>
      <form action={createKol} className="space-y-4">
        <Field label="Name" name="name" required />
        <Field label="Platform(s)" name="platform" placeholder="YouTube, Instagram" />
        <Field label="Handle or link" name="handle_or_link" placeholder="@handle or channel URL" />

        <div>
          <label className="block text-xs font-semibold mb-1">Market</label>
          <select name="market" className="w-full border border-border rounded-md px-3 py-2 text-sm">
            {MARKETS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <Field label="Follower count" name="follower_count" type="number" />
        <Field label="Contact email" name="contact_email" type="email" />
        <Field label="Contact Telegram" name="contact_telegram" placeholder="@username" />

        <div>
          <label className="block text-xs font-semibold mb-1">Stage</label>
          <select name="stage" defaultValue="prospect" className="w-full border border-border rounded-md px-3 py-2 text-sm">
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <Field label="Wallet address" name="wallet_address" placeholder="Payout wallet, USDT/USDC" />

        <div>
          <label className="block text-xs font-semibold mb-1">Notes</label>
          <textarea name="notes" rows={3} className="w-full border border-border rounded-md px-3 py-2 text-sm" />
        </div>

        <button
          type="submit"
          className="bg-orange text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-hover transition"
        >
          Save KOL
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
      />
    </div>
  );
}
