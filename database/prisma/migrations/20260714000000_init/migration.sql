-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "role_name" AS ENUM ('SHG', 'ULB_OFFICIAL', 'DISTRICT_OFFICIAL', 'STATE_OFFICIAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "preferred_language" AS ENUM ('TELUGU', 'ENGLISH');

-- CreateEnum
CREATE TYPE "shg_type" AS ENUM ('FOOD', 'HANDICRAFTS', 'HANDLOOM', 'AGRICULTURE_ALLIED', 'HOME_BASED_ENTERPRISE');

-- CreateEnum
CREATE TYPE "buyer_type" AS ENUM ('INSTITUTIONAL', 'RETAIL', 'BULK', 'GOVERNMENT_PROCUREMENT');

-- CreateEnum
CREATE TYPE "enquiry_status" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "recommendation_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('SMS', 'WHATSAPP', 'VOICE', 'EMAIL');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "notification_event" AS ENUM ('BUYER_ENQUIRY', 'DEMAND_INCREASE', 'PRICE_CHANGE', 'TENDER_OPPORTUNITY', 'OTP');

-- CreateEnum
CREATE TYPE "consent_purpose" AS ENUM ('PRODUCT_REGISTRATION', 'VOICE_ASSISTANT_RECORDING', 'MARKETING_NOTIFICATIONS', 'DATA_SHARING_WITH_BUYERS', 'ANALYTICS');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "preferred_language" "preferred_language" NOT NULL DEFAULT 'TELUGU',
    "status" "user_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" "role_name" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "district_id" UUID,
    "ulb_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ulbs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(15) NOT NULL,
    "district_id" UUID NOT NULL,

    CONSTRAINT "ulbs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandals" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(15) NOT NULL,
    "district_id" UUID NOT NULL,

    CONSTRAINT "mandals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" UUID,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "festival_calendar" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "district_id" UUID,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "festival_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shg" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mepma_registration_number" TEXT,
    "type" "shg_type" NOT NULL,
    "production_capacity_note" TEXT,
    "bank_account_number" TEXT,
    "bank_ifsc" VARCHAR(11),
    "district_id" UUID NOT NULL,
    "ulb_id" UUID,
    "mandal_id" UUID,
    "contact_user_id" UUID NOT NULL,
    "location" geometry(Point, 4326),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "shg_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" VARCHAR(20) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "moq" INTEGER NOT NULL DEFAULT 1,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "location" geometry(Point, 4326),
    "embedding" vector(768),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "buyer_type" NOT NULL,
    "organization" TEXT,
    "district_id" UUID,
    "location" geometry(Point, 4326),
    "demand_profile" JSONB,
    "embedding" vector(768),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_category_interests" (
    "buyer_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "buyer_category_interests_pkey" PRIMARY KEY ("buyer_id","category_id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "shg_id" UUID NOT NULL,
    "buyer_id" UUID,
    "district_id" UUID NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "sale_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "product_id" UUID,
    "shg_id" UUID NOT NULL,
    "message" TEXT,
    "status" "enquiry_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL,
    "shg_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "product_id" UUID,
    "match_score" DECIMAL(5,4) NOT NULL,
    "expected_demand" DECIMAL(12,2),
    "reasons" JSONB,
    "status" "recommendation_status" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "event" "notification_event" NOT NULL,
    "template_key" TEXT NOT NULL,
    "payload" JSONB,
    "status" "notification_status" NOT NULL DEFAULT 'QUEUED',
    "provider_message_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "consent_purpose" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "version" VARCHAR(20) NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMP(3),

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_roles_district_id_idx" ON "user_roles"("district_id");

-- CreateIndex
CREATE INDEX "user_roles_ulb_id_idx" ON "user_roles"("ulb_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_district_id_ulb_id_key" ON "user_roles"("user_id", "role_id", "district_id", "ulb_id");

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_key" ON "districts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "districts_code_key" ON "districts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ulbs_code_key" ON "ulbs"("code");

-- CreateIndex
CREATE INDEX "ulbs_district_id_idx" ON "ulbs"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "ulbs_district_id_name_key" ON "ulbs"("district_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "mandals_code_key" ON "mandals"("code");

-- CreateIndex
CREATE INDEX "mandals_district_id_idx" ON "mandals"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "mandals_district_id_name_key" ON "mandals"("district_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "festival_calendar_district_id_idx" ON "festival_calendar"("district_id");

-- CreateIndex
CREATE INDEX "festival_calendar_start_date_end_date_idx" ON "festival_calendar"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "shg_mepma_registration_number_key" ON "shg"("mepma_registration_number");

-- CreateIndex
CREATE INDEX "shg_district_id_idx" ON "shg"("district_id");

-- CreateIndex
CREATE INDEX "shg_ulb_id_idx" ON "shg"("ulb_id");

-- CreateIndex
CREATE INDEX "shg_mandal_id_idx" ON "shg"("mandal_id");

-- CreateIndex
CREATE INDEX "shg_contact_user_id_idx" ON "shg"("contact_user_id");

-- CreateIndex
CREATE INDEX "products_shg_id_idx" ON "products"("shg_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "buyers_district_id_idx" ON "buyers"("district_id");

-- CreateIndex
CREATE INDEX "sales_product_id_idx" ON "sales"("product_id");

-- CreateIndex
CREATE INDEX "sales_shg_id_idx" ON "sales"("shg_id");

-- CreateIndex
CREATE INDEX "sales_buyer_id_idx" ON "sales"("buyer_id");

-- CreateIndex
CREATE INDEX "sales_district_id_idx" ON "sales"("district_id");

-- CreateIndex
CREATE INDEX "sales_sale_date_idx" ON "sales"("sale_date");

-- CreateIndex
CREATE INDEX "enquiries_buyer_id_idx" ON "enquiries"("buyer_id");

-- CreateIndex
CREATE INDEX "enquiries_product_id_idx" ON "enquiries"("product_id");

-- CreateIndex
CREATE INDEX "enquiries_shg_id_idx" ON "enquiries"("shg_id");

-- CreateIndex
CREATE INDEX "enquiries_status_idx" ON "enquiries"("status");

-- CreateIndex
CREATE INDEX "recommendations_shg_id_idx" ON "recommendations"("shg_id");

-- CreateIndex
CREATE INDEX "recommendations_buyer_id_idx" ON "recommendations"("buyer_id");

-- CreateIndex
CREATE INDEX "recommendations_product_id_idx" ON "recommendations"("product_id");

-- CreateIndex
CREATE INDEX "recommendations_status_idx" ON "recommendations"("status");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_channel_idx" ON "notifications"("channel");

-- CreateIndex
CREATE INDEX "consents_user_id_idx" ON "consents"("user_id");

-- CreateIndex
CREATE INDEX "consents_purpose_idx" ON "consents"("purpose");

-- CreateIndex
CREATE INDEX "audit_log_actor_user_id_idx" ON "audit_log"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_ulb_id_fkey" FOREIGN KEY ("ulb_id") REFERENCES "ulbs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ulbs" ADD CONSTRAINT "ulbs_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandals" ADD CONSTRAINT "mandals_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "festival_calendar" ADD CONSTRAINT "festival_calendar_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shg" ADD CONSTRAINT "shg_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shg" ADD CONSTRAINT "shg_ulb_id_fkey" FOREIGN KEY ("ulb_id") REFERENCES "ulbs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shg" ADD CONSTRAINT "shg_mandal_id_fkey" FOREIGN KEY ("mandal_id") REFERENCES "mandals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shg" ADD CONSTRAINT "shg_contact_user_id_fkey" FOREIGN KEY ("contact_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shg_id_fkey" FOREIGN KEY ("shg_id") REFERENCES "shg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_category_interests" ADD CONSTRAINT "buyer_category_interests_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_category_interests" ADD CONSTRAINT "buyer_category_interests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_shg_id_fkey" FOREIGN KEY ("shg_id") REFERENCES "shg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_shg_id_fkey" FOREIGN KEY ("shg_id") REFERENCES "shg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_shg_id_fkey" FOREIGN KEY ("shg_id") REFERENCES "shg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (PostGIS geo columns — GIST spatial indexes; not expressible via Prisma's schema DSL, see ADR-0016)
CREATE INDEX "shg_location_gist_idx" ON "shg" USING GIST ("location");
CREATE INDEX "products_location_gist_idx" ON "products" USING GIST ("location");
CREATE INDEX "buyers_location_gist_idx" ON "buyers" USING GIST ("location");

-- CreateIndex (pgvector embedding columns — approximate nearest-neighbour indexes; not expressible via Prisma's schema DSL, see ADR-0016)
-- ivfflat requires the table to have data before it's useful; created here with a conservative `lists` value suitable for pilot-scale data and can be re-tuned (or swapped for `hnsw`) once real embedding volumes are known.
CREATE INDEX "products_embedding_ivfflat_idx" ON "products" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX "buyers_embedding_ivfflat_idx" ON "buyers" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- CreateIndex (application-level integrity constraints not modeled by Prisma's type system)
ALTER TABLE "products" ADD CONSTRAINT "products_price_positive_chk" CHECK ("price" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_stock_nonnegative_chk" CHECK ("stock" >= 0);
ALTER TABLE "sales" ADD CONSTRAINT "sales_quantity_positive_chk" CHECK ("quantity" > 0);
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_match_score_range_chk" CHECK ("match_score" >= 0 AND "match_score" <= 1);
ALTER TABLE "festival_calendar" ADD CONSTRAINT "festival_calendar_date_range_chk" CHECK ("end_date" >= "start_date");

