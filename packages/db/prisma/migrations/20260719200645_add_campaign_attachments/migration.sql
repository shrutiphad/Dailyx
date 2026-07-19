-- CreateTable
CREATE TABLE "CampaignAttachment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignAttachment_campaignId_idx" ON "CampaignAttachment"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignAttachment_accountId_idx" ON "CampaignAttachment"("accountId");

-- AddForeignKey
ALTER TABLE "CampaignAttachment" ADD CONSTRAINT "CampaignAttachment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
