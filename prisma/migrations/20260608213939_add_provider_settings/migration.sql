-- CreateTable
CREATE TABLE "provider_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "active_provider" TEXT NOT NULL DEFAULT '',
    "openai_key" TEXT,
    "anthropic_key" TEXT,
    "gemini_key" TEXT,
    "openai_model" TEXT NOT NULL DEFAULT 'gpt-5.4-mini',
    "anthropic_model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "gemini_model" TEXT NOT NULL DEFAULT 'gemini-3-flash',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_settings_user_id_key" ON "provider_settings"("user_id");

-- AddForeignKey
ALTER TABLE "provider_settings" ADD CONSTRAINT "provider_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
