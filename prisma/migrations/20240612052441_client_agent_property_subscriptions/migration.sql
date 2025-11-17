-- CreateTable
CREATE TABLE "ClientAgentPropertySubscription" (
    "id" TEXT NOT NULL,
    "minSize" INTEGER,
    "maxSize" INTEGER,
    "minPrice" INTEGER,
    "maxPrice" INTEGER,
    "location" TEXT,
    "listingType" "PropertyListingType",
    "propertyType" "PropertyType",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "clientId" TEXT,
    "clientSearchId" TEXT,

    CONSTRAINT "ClientAgentPropertySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientAgentPropertySubscription_clientSearchId_key" ON "ClientAgentPropertySubscription"("clientSearchId");

-- AddForeignKey
ALTER TABLE "ClientAgentPropertySubscription" ADD CONSTRAINT "ClientAgentPropertySubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAgentPropertySubscription" ADD CONSTRAINT "ClientAgentPropertySubscription_clientSearchId_fkey" FOREIGN KEY ("clientSearchId") REFERENCES "ClientSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
