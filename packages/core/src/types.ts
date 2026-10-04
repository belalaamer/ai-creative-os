export type UUID = string;

export type MembershipRole = "owner" | "admin" | "editor" | "viewer";
export type ProjectStatus = "draft" | "active" | "archived";
export type JobStatus = "queued" | "processing" | "succeeded" | "failed" | "cancelled";
export type GenerationKind = "text" | "image" | "video" | "audio" | "landing_page";
export type QualityTier = "fast" | "quality" | "ultra";

export interface Money {
  amount: number;
  currency: "USD" | "EGP";
}
