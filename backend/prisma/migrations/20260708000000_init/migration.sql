-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "preferred_lang" TEXT NOT NULL DEFAULT 'es',
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "password_reset_token" TEXT,
    "password_reset_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "icao_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "timezone" TEXT NOT NULL,
    "latitude" DECIMAL(10,6),
    "longitude" DECIMAL(10,6),
    "precip_reported" BOOLEAN NOT NULL DEFAULT true,
    "is_current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "station_id" TEXT NOT NULL,
    "forecast_date" DATE NOT NULL,
    "max_temp" INTEGER NOT NULL,
    "min_temp" INTEGER NOT NULL,
    "wind_gust" INTEGER NOT NULL,
    "precip_range" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_readings" (
    "id" SERIAL NOT NULL,
    "station_id" TEXT NOT NULL,
    "reading_date" DATE NOT NULL,
    "max_temp_raw" DECIMAL(5,2) NOT NULL,
    "max_temp_rounded" INTEGER NOT NULL,
    "min_temp_raw" DECIMAL(5,2) NOT NULL,
    "min_temp_rounded" INTEGER NOT NULL,
    "wind_gust_max" DECIMAL(5,2) NOT NULL,
    "precip_reported" BOOLEAN NOT NULL DEFAULT true,
    "precip_total" DECIMAL(5,2),
    "precip_range" INTEGER,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "station_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "forecast_id" INTEGER NOT NULL,
    "reading_id" INTEGER NOT NULL,
    "score_date" DATE NOT NULL,
    "max_temp_score" INTEGER NOT NULL,
    "min_temp_score" INTEGER NOT NULL,
    "wind_gust_score" INTEGER NOT NULL,
    "precip_score" INTEGER NOT NULL,
    "perfect_bonus" INTEGER NOT NULL DEFAULT 0,
    "total_score" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_total_points_idx" ON "users"("total_points" DESC);

-- CreateIndex
CREATE INDEX "stations_is_current_idx" ON "stations"("is_current");

-- CreateIndex
CREATE INDEX "forecasts_forecast_date_idx" ON "forecasts"("forecast_date");
CREATE UNIQUE INDEX "forecasts_user_id_forecast_date_key" ON "forecasts"("user_id", "forecast_date");

-- CreateIndex
CREATE INDEX "station_readings_reading_date_idx" ON "station_readings"("reading_date");
CREATE UNIQUE INDEX "station_readings_station_id_reading_date_key" ON "station_readings"("station_id", "reading_date");

-- CreateIndex
CREATE UNIQUE INDEX "scores_forecast_id_key" ON "scores"("forecast_id");
CREATE INDEX "scores_score_date_idx" ON "scores"("score_date");
CREATE UNIQUE INDEX "scores_user_id_score_date_key" ON "scores"("user_id", "score_date");

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_readings" ADD CONSTRAINT "station_readings_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scores" ADD CONSTRAINT "scores_forecast_id_fkey" FOREIGN KEY ("forecast_id") REFERENCES "forecasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scores" ADD CONSTRAINT "scores_reading_id_fkey" FOREIGN KEY ("reading_id") REFERENCES "station_readings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
