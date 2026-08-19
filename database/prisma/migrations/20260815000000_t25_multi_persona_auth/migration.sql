-- T25: Landing page + email/password self-registration for Distributor and
-- Consumer personas, alongside the existing SHG persona, with an admin
-- approval gate. Phone+OTP login is untouched — password_hash is only ever
-- set/checked by the new /auth/register and /auth/login endpoints.

-- New self-registerable personas (existing SHG/officials/ADMIN roles are
-- provisioned via phone+OTP + admin assignment; these two are the only
-- roles a user can select for themselves at /signup).
ALTER TYPE "role_name" ADD VALUE 'DISTRIBUTOR';
ALTER TYPE "role_name" ADD VALUE 'CONSUMER';

-- SHG/DISTRIBUTOR self-registrations start PENDING_APPROVAL and cannot
-- obtain a JWT via /auth/login until an admin moves them to ACTIVE or
-- REJECTED (see AdminService.approveUser/rejectUser). CONSUMER
-- self-registrations skip this and start at ACTIVE directly.
ALTER TYPE "user_status" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "user_status" ADD VALUE 'REJECTED';

ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
