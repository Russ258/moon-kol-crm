import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/getProfile";
import { updateProfileRole } from "@/app/actions";
import type { UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["admin", "marketing", "finance", "viewer"];

export default async function TeamPage() {
  const { profile } = await getProfile();
  const supabase = createClient();
  const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });

  const isAdmin = profile?.role === "admin";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Team</h1>
      <p className="text-sm text-gray-500 mb-6">
        Anyone who signs in gets a viewer account by default. Only admins can change roles.
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase border-b border-border">
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Role</th>
            {isAdmin && <th className="py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {(profiles ?? []).map((p: any) => (
            <tr key={p.id} className="border-b border-border">
              <td className="py-3">{p.full_name ?? "—"}</td>
              <td className="py-3">{p.email}</td>
              <td className="py-3 capitalize">{p.role}</td>
              {isAdmin && (
                <td className="py-3">
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      await updateProfileRole(p.id, String(formData.get("role")));
                    }}
                    className="flex items-center gap-2"
                  >
                    <select name="role" defaultValue={p.role} className="text-xs border border-border rounded-md px-2 py-1">
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="text-xs underline text-orange">
                      Update
                    </button>
                  </form>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 text-xs text-gray-500 max-w-md">
        <p className="font-semibold mb-1">Role guide</p>
        <p><strong>Admin:</strong> full access, including changing roles.</p>
        <p><strong>Marketing:</strong> manage KOLs, contracts, view payouts.</p>
        <p><strong>Finance:</strong> manage payouts, view contracts and KOLs.</p>
        <p><strong>Viewer:</strong> KOL pipeline only, no contract or payout access.</p>
      </div>
    </div>
  );
}
