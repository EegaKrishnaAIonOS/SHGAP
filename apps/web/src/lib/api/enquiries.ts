import { authFetch } from "./httpClient";
import { mutateJson } from "./offlineMutate";
import type { Enquiry, MutationResult } from "./types";

// Unlike marketplace.ts (Phase 1, public), every call here requires login —
// authFetch/mutateJson, not publicFetch.

export interface CreateEnquiryInput {
  productId: string;
  message?: string;
  /** Only used to seed the caller's buyer profile the first time they
   * submit an RFQ — ignored on every later call. */
  buyerName?: string;
}

export function createEnquiry(input: CreateEnquiryInput): Promise<MutationResult<Enquiry>> {
  return mutateJson<Enquiry>("POST", "/enquiries", input, "Submit enquiry");
}

export function listSentEnquiries(): Promise<Enquiry[]> {
  return authFetch<Enquiry[]>("/enquiries/sent");
}

export function listReceivedEnquiries(): Promise<Enquiry[]> {
  return authFetch<Enquiry[]>("/enquiries/received");
}

export interface RespondEnquiryInput {
  status: "RESPONDED" | "CLOSED";
  responseMessage?: string;
}

export function respondToEnquiry(
  id: string,
  input: RespondEnquiryInput,
): Promise<MutationResult<Enquiry>> {
  return mutateJson<Enquiry>("PATCH", `/enquiries/${id}/respond`, input, "Respond to enquiry");
}