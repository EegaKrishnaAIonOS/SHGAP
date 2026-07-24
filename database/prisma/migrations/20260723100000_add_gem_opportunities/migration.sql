-- CreateEnum
CREATE TYPE "gem_opportunity_status" AS ENUM ('OPEN', 'CLOSED', 'AWARDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "gem_opportunities" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "category_id" UUID,
    "reference_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity_required" DECIMAL(12,2),
    "unit" VARCHAR(20),
    "estimated_value" DECIMAL(14,2),
    "submission_deadline" DATE NOT NULL,
    "status" "gem_opportunity_status" NOT NULL DEFAULT 'OPEN',
    "is_simulated" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gem_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gem_opportunities_reference_number_key" ON "gem_opportunities"("reference_number");

-- CreateIndex
CREATE INDEX "gem_opportunities_buyer_id_idx" ON "gem_opportunities"("buyer_id");

-- CreateIndex
CREATE INDEX "gem_opportunities_category_id_idx" ON "gem_opportunities"("category_id");

-- CreateIndex
CREATE INDEX "gem_opportunities_status_idx" ON "gem_opportunities"("status");

-- AddForeignKey
ALTER TABLE "gem_opportunities" ADD CONSTRAINT "gem_opportunities_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gem_opportunities" ADD CONSTRAINT "gem_opportunities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
