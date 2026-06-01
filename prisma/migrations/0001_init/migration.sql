CREATE TABLE "trips" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT NOT NULL,
  "travelers" INTEGER NOT NULL,
  "style" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "itinerary" JSONB NOT NULL,
  "messages" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trips_owner_id_updated_at_idx" ON "trips"("owner_id", "updated_at");
