-- CreateTable
CREATE TABLE "linkedin_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "linkedin_sub" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkedin_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "linkedin_connections_user_id_key" ON "linkedin_connections"("user_id");

-- AddForeignKey
ALTER TABLE "linkedin_connections" ADD CONSTRAINT "linkedin_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
