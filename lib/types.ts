export type UserRole = "admin" | "marketing" | "finance" | "viewer";

export type KolMarket = "Hong Kong" | "Taiwan" | "Vietnam" | "Thailand" | "India" | "Other";

export type KolStage =
  | "prospect"
  | "contacted"
  | "negotiating"
  | "contract_sent"
  | "signed"
  | "active"
  | "paused"
  | "declined";

export const STAGES: KolStage[] = [
  "prospect",
  "contacted",
  "negotiating",
  "contract_sent",
  "signed",
  "active",
  "paused",
  "declined",
];

export const STAGE_LABELS: Record<KolStage, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  negotiating: "Negotiating",
  contract_sent: "Contract Sent",
  signed: "Signed",
  active: "Active",
  paused: "Paused",
  declined: "Declined",
};

export const MARKETS: KolMarket[] = ["Hong Kong", "Taiwan", "Vietnam", "Thailand", "India", "Other"];

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Kol {
  id: string;
  name: string;
  platform: string | null;
  handle_or_link: string | null;
  market: KolMarket;
  follower_count: number | null;
  contact_email: string | null;
  contact_telegram: string | null;
  stage: KolStage;
  referral_code: string | null;
  wallet_address: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractStatus = "draft" | "sent" | "signed" | "void";

export interface Contract {
  id: string;
  kol_id: string;
  template_version: string;
  terms_snapshot: Record<string, unknown> | null;
  file_path: string | null;
  file_url: string | null;
  signature_provider: string | null;
  status: ContractStatus;
  signed_at: string | null;
  signed_by_name: string | null;
  created_by: string | null;
  created_at: string;
}

export type PayoutType = "activation_bonus" | "residual" | "ga_pass_reimbursement" | "other";
export type PayoutStatus = "pending" | "paid" | "failed";

export interface Payout {
  id: string;
  kol_id: string;
  contract_id: string | null;
  type: PayoutType;
  amount: number;
  currency: string;
  wallet_address: string | null;
  status: PayoutStatus;
  paid_at: string | null;
  reference: string | null;
  created_by: string | null;
  created_at: string;
}
