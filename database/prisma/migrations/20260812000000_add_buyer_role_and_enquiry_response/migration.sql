-- Phase 2 of the public marketplace (RFQ submit/respond): a logged-in user
-- becomes a "buyer" the first time they submit an RFQ, mirroring how
-- ShgsService.ensureShgRole already auto-assigns the SHG role on
-- registration — see EnquiriesService.getOrCreateBuyerForUser. Buyer
-- .contactUserId is nullable (unlike Shg.contactUserId): existing
-- admin-curated/seeded Buyer rows have no real user to attach, the same
-- reasoning ADR-0030 already established for MEPMA-synced SHGs.
ALTER TYPE "role_name" ADD VALUE 'BUYER';

ALTER TABLE "buyers" ADD COLUMN "contact_user_id" UUID;
CREATE UNIQUE INDEX "buyers_contact_user_id_key" ON "buyers"("contact_user_id");
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_contact_user_id_fkey" FOREIGN KEY ("contact_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An Enquiry's status alone can't record what an SHG actually replied with
-- (a quote, an availability note) — only that something happened. These two
-- columns give "respond" real content, not just a status flip.
ALTER TABLE "enquiries" ADD COLUMN "response_message" TEXT;
ALTER TABLE "enquiries" ADD COLUMN "responded_at" TIMESTAMP(3);