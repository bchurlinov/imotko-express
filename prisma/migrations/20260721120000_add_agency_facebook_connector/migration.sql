-- CreateEnum
CREATE TYPE "AgencyFacebookConnectionStatus" AS ENUM ('CONNECTED', 'EXPIRING', 'EXPIRED', 'REVOKED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "AgencyFacebookConnectionAttemptStatus" AS ENUM ('AUTHORIZATION_PENDING', 'PAGE_SELECTION_PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "AgencyFacebookConnection" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" "AgencyFacebookConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "facebookUserId" TEXT,
    "facebookUserName" TEXT,
    "pageId" TEXT,
    "pageName" TEXT,
    "pageCategory" TEXT,
    "pagePictureUrl" TEXT,
    "pageTasks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "declinedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "granularScopes" JSONB,
    "encryptedUserToken" TEXT,
    "encryptedPageToken" TEXT,
    "userTokenExpiresAt" TIMESTAMPTZ(3),
    "pageTokenExpiresAt" TIMESTAMPTZ(3),
    "dataAccessExpiresAt" TIMESTAMPTZ(3),
    "graphApiVersion" TEXT,
    "connectedByUserId" TEXT,
    "connectedAt" TIMESTAMPTZ(3),
    "replacedByUserId" TEXT,
    "replacedAt" TIMESTAMPTZ(3),
    "disconnectedByUserId" TEXT,
    "disconnectedAt" TIMESTAMPTZ(3),
    "lastValidatedAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "lastErrorAt" TIMESTAMPTZ(3),
    "expiryNotifiedAt" TIMESTAMPTZ(3),
    "invalidNotifiedAt" TIMESTAMPTZ(3),
    "metaRevocationConfirmedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyFacebookConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyFacebookConnectionAttempt" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "initiatingUserId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "status" "AgencyFacebookConnectionAttemptStatus" NOT NULL DEFAULT 'AUTHORIZATION_PENDING',
    "locale" TEXT NOT NULL,
    "returnPath" TEXT NOT NULL,
    "expectedActiveRevision" INTEGER NOT NULL DEFAULT 0,
    "encryptedTemporaryUserToken" TEXT,
    "facebookUserId" TEXT,
    "facebookUserName" TEXT,
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "declinedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "granularScopes" JSONB,
    "debugMetadata" JSONB,
    "authorizationExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "pageSelectionExpiresAt" TIMESTAMPTZ(3),
    "usedAt" TIMESTAMPTZ(3),
    "errorCode" TEXT,
    "errorAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyFacebookConnectionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyFacebookDataDeletionConfirmation" (
    "id" TEXT NOT NULL,
    "confirmationCodeHash" TEXT NOT NULL,
    "completedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyFacebookDataDeletionConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyFacebookConnection_agencyId_key" ON "AgencyFacebookConnection"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyFacebookConnection_facebookUserId_idx" ON "AgencyFacebookConnection"("facebookUserId");

-- CreateIndex
CREATE INDEX "AgencyFacebookConnection_status_idx" ON "AgencyFacebookConnection"("status");

-- CreateIndex
CREATE INDEX "AgencyFacebookConnection_userTokenExpiresAt_idx" ON "AgencyFacebookConnection"("userTokenExpiresAt");

-- CreateIndex
CREATE INDEX "AgencyFacebookConnection_pageTokenExpiresAt_idx" ON "AgencyFacebookConnection"("pageTokenExpiresAt");

-- CreateIndex
CREATE INDEX "AgencyFacebookConnection_dataAccessExpiresAt_idx" ON "AgencyFacebookConnection"("dataAccessExpiresAt");

-- CreateIndex
CREATE INDEX "AgencyFacebookConnection_purgeAt_idx" ON "AgencyFacebookConnection"("purgeAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyFacebookConnectionAttempt_stateHash_key" ON "AgencyFacebookConnectionAttempt"("stateHash");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyFacebookDataDeletionConfirmation_confirmationCodeHash_key" ON "AgencyFacebookDataDeletionConfirmation"("confirmationCodeHash");

-- CreateIndex
CREATE INDEX "AgencyFacebookConnectionAttempt_agencyId_initiatingUserId_idx" ON "AgencyFacebookConnectionAttempt"("agencyId", "initiatingUserId");

-- CreateIndex
CREATE INDEX "AgencyFacebookConnectionAttempt_status_authorizationExpiresAt_idx" ON "AgencyFacebookConnectionAttempt"("status", "authorizationExpiresAt");

-- CreateIndex
CREATE INDEX "AgencyFacebookConnectionAttempt_status_pageSelectionExpiresAt_idx" ON "AgencyFacebookConnectionAttempt"("status", "pageSelectionExpiresAt");

-- AddForeignKey
ALTER TABLE "AgencyFacebookConnection" ADD CONSTRAINT "AgencyFacebookConnection_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyFacebookConnectionAttempt" ADD CONSTRAINT "AgencyFacebookConnectionAttempt_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
