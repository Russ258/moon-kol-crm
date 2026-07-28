"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function logActivity(entity_type: string, entity_id: string, action: string, detail?: object) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("activity_log").insert({
    actor_id: user?.id,
    entity_type,
    entity_id,
    action,
    detail: detail ?? null,
  });
}

export async function createKol(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    name: String(formData.get("name") ?? ""),
    platform: String(formData.get("platform") ?? "") || null,
    handle_or_link: String(formData.get("handle_or_link") ?? "") || null,
    market: String(formData.get("market") ?? "Other"),
    follower_count: formData.get("follower_count") ? Number(formData.get("follower_count")) : null,
    contact_email: String(formData.get("contact_email") ?? "") || null,
    contact_telegram: String(formData.get("contact_telegram") ?? "") || null,
    stage: String(formData.get("stage") ?? "prospect"),
    wallet_address: String(formData.get("wallet_address") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    created_by: user?.id,
  };

  const { data, error } = await supabase.from("kols").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  await logActivity("kol", data.id, "created", { name: payload.name });
  revalidatePath("/kols");
  redirect(`/kols/${data.id}`);
}

export async function updateKolStage(kolId: string, stage: string) {
  const supabase = createClient();
  const { error } = await supabase.from("kols").update({ stage, updated_at: new Date().toISOString() }).eq("id", kolId);
  if (error) throw new Error(error.message);
  await logActivity("kol", kolId, "stage_changed", { stage });
  revalidatePath("/kols");
  revalidatePath(`/kols/${kolId}`);
}

export async function updateKolNotes(kolId: string, notes: string) {
  const supabase = createClient();
  const { error } = await supabase.from("kols").update({ notes, updated_at: new Date().toISOString() }).eq("id", kolId);
  if (error) throw new Error(error.message);
  revalidatePath(`/kols/${kolId}`);
}

export async function createContract(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const kol_id = String(formData.get("kol_id"));
  const payload = {
    kol_id,
    template_version: String(formData.get("template_version") ?? ""),
    file_url: String(formData.get("file_url") ?? "") || null,
    signature_provider: String(formData.get("signature_provider") ?? "") || null,
    status: String(formData.get("status") ?? "draft"),
    signed_at: formData.get("signed_at") ? new Date(String(formData.get("signed_at"))).toISOString() : null,
    signed_by_name: String(formData.get("signed_by_name") ?? "") || null,
    created_by: user?.id,
  };

  const { data, error } = await supabase.from("contracts").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  await logActivity("contract", data.id, "created", { kol_id });

  if (payload.status === "signed") {
    await supabase.from("kols").update({ stage: "signed" }).eq("id", kol_id);
  }

  revalidatePath(`/kols/${kol_id}`);
  revalidatePath("/contracts");
}

export async function updateContractStatus(contractId: string, kolId: string, status: string) {
  const supabase = createClient();
  const update: Record<string, unknown> = { status };
  if (status === "signed") update.signed_at = new Date().toISOString();

  const { error } = await supabase.from("contracts").update(update).eq("id", contractId);
  if (error) throw new Error(error.message);

  await logActivity("contract", contractId, "status_changed", { status });

  if (status === "signed") {
    await supabase.from("kols").update({ stage: "signed" }).eq("id", kolId);
  }

  revalidatePath(`/kols/${kolId}`);
  revalidatePath("/contracts");
}

export async function createPayout(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const kol_id = String(formData.get("kol_id"));
  const payload = {
    kol_id,
    contract_id: String(formData.get("contract_id") ?? "") || null,
    type: String(formData.get("type") ?? "other"),
    amount: Number(formData.get("amount") ?? 0),
    currency: String(formData.get("currency") ?? "USDT"),
    wallet_address: String(formData.get("wallet_address") ?? "") || null,
    status: String(formData.get("status") ?? "pending"),
    reference: String(formData.get("reference") ?? "") || null,
    created_by: user?.id,
  };

  const { data, error } = await supabase.from("payouts").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  await logActivity("payout", data.id, "created", { kol_id, amount: payload.amount });
  revalidatePath(`/kols/${kol_id}`);
  revalidatePath("/payouts");
}

export async function markPayoutPaid(payoutId: string, kolId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("payouts")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", payoutId);
  if (error) throw new Error(error.message);
  await logActivity("payout", payoutId, "marked_paid");
  revalidatePath(`/kols/${kolId}`);
  revalidatePath("/payouts");
}

export async function updateProfileRole(profileId: string, role: string) {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}
