-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'AGENCY', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserLanguage" AS ENUM ('EN', 'MK', 'AL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('READ', 'UNREAD');

-- CreateEnum
CREATE TYPE "AgencyPlan" AS ENUM ('BASIC', 'PREMIUM');

-- CreateEnum
CREATE TYPE "AgencyApprovalStatus" AS ENUM ('DECLINED', 'PENDING', 'APPROVED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('PropertyTyp', 'FLAT', 'HOUSE', 'LAND', 'HOLIDAY_HOME', 'GARAGE', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'PENDING', 'DECLINED', 'PUBLISHED', 'UNPUBLISHED', 'DELETED');

-- CreateEnum
CREATE TYPE "PropertyListingType" AS ENUM ('FOR_RENT', 'FOR_SALE');

-- CreateEnum
CREATE TYPE "PropertyOrientation" AS ENUM ('NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTHEAST', 'SOUTHEAST', 'NORTHWEST', 'SOUTHWEST');

-- CreateEnum
CREATE TYPE "PropertyReviewStatus" AS ENUM ('PENDING', 'DECLINED', 'APPROVED');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('SHARE', 'SUBSCRIBE', 'FAVORITE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "location" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "hashedPassword" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3),
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "language" "UserLanguage" DEFAULT 'MK',
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "clientId" TEXT,
    "agencyId" TEXT,
    "adminId" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "recipientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "receiveCompanyEmail" BOOLEAN DEFAULT false,
    "receiveCompanySMS" BOOLEAN DEFAULT false,
    "receiveAgentEmail" BOOLEAN DEFAULT false,
    "receiveAgentSMS" BOOLEAN DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSearch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "link" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "receiveOffers" BOOLEAN NOT NULL DEFAULT false,
    "agencyIds" TEXT[],

    CONSTRAINT "ClientSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPropertySubscription" (
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

    CONSTRAINT "ClientPropertySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "status" "AgencyApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "imotkoApproved" BOOLEAN NOT NULL DEFAULT false,
    "plan" "AgencyPlan" NOT NULL DEFAULT 'BASIC',
    "planUntil" TIMESTAMP(3),
    "email" TEXT,
    "taxNumber" TEXT,
    "name" TEXT NOT NULL,
    "description" JSONB,
    "slug" TEXT,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "social" JSONB,
    "logo" JSONB,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "owner" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencySubmissionReview" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencySubmissionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyView" (
    "id" TEXT NOT NULL,
    "viewDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyReview" (
    "id" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attributes" JSONB,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "AgencyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "agencyId" TEXT NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'PENDING',
    "price" INTEGER NOT NULL,
    "hasApproximatePrice" BOOLEAN DEFAULT false,
    "approximatePrice" INTEGER,
    "estimationPrice" INTEGER,
    "size" INTEGER NOT NULL,
    "description" JSONB NOT NULL,
    "slug" TEXT,
    "photos" JSONB,
    "video" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "attributes" JSONB,
    "yearBuilt" TIMESTAMP(3),
    "remarks" TEXT,
    "builder" TEXT,
    "propertyDeed" TEXT,
    "inDevelopment" BOOLEAN DEFAULT false,
    "inDevelopmentUntil" TIMESTAMPTZ(3),
    "propertyPlan" JSONB,
    "poi" JSONB,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredUntil" TIMESTAMP(3),
    "orientation" "PropertyOrientation",
    "type" "PropertyType" NOT NULL,
    "listingType" "PropertyListingType" NOT NULL,
    "propertyLocationId" TEXT,
    "categoryId" TEXT,
    "subcategoryId" TEXT,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyCategory" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertySubcategory" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertySubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "PropertyLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertySubmissionReview" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PropertySubmissionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertySale" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "propertyDeed" TEXT NOT NULL,
    "soldAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldFor" INTEGER NOT NULL,
    "visibility" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PropertySale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyView" (
    "id" TEXT NOT NULL,
    "viewDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "propertyId" TEXT NOT NULL,
    "clientId" TEXT,
    "additionalInfo" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PropertyView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyFavorite" (
    "id" TEXT NOT NULL,
    "favoriteDate" TIMESTAMPTZ(3) NOT NULL,
    "propertyId" TEXT,
    "clientId" TEXT,

    CONSTRAINT "PropertyFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyEngagement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "EngagementType" NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "additionalInfo" JSONB,

    CONSTRAINT "PropertyEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_agencyId_idx" ON "User"("agencyId");

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "User"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "Admin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_email_key" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_email_token_key" ON "PasswordResetToken"("email", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_key" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_email_token_key" ON "VerificationToken"("email", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");

-- CreateIndex
CREATE INDEX "Client_userId_idx" ON "Client"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPropertySubscription_clientSearchId_key" ON "ClientPropertySubscription"("clientSearchId");

-- CreateIndex
CREATE INDEX "Agency_location_idx" ON "Agency"("location");

-- CreateIndex
CREATE INDEX "Agency_name_idx" ON "Agency"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AgencySubmissionReview_agencyId_key" ON "AgencySubmissionReview"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyView_agencyId_idx" ON "AgencyView"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyView_clientId_idx" ON "AgencyView"("clientId");

-- CreateIndex
CREATE INDEX "Property_propertyLocationId_listingType_idx" ON "Property"("propertyLocationId", "listingType");

-- CreateIndex
CREATE INDEX "Property_propertyLocationId_idx" ON "Property"("propertyLocationId");

-- CreateIndex
CREATE INDEX "Property_agencyId_idx" ON "Property"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertySubcategory_value_categoryId_key" ON "PropertySubcategory"("value", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyLocation_name_key" ON "PropertyLocation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PropertySale_propertyId_key" ON "PropertySale"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyView_propertyId_idx" ON "PropertyView"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyView_clientId_idx" ON "PropertyView"("clientId");

-- CreateIndex
CREATE INDEX "PropertyFavorite_propertyId_idx" ON "PropertyFavorite"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyFavorite_clientId_idx" ON "PropertyFavorite"("clientId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSearch" ADD CONSTRAINT "ClientSearch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPropertySubscription" ADD CONSTRAINT "ClientPropertySubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPropertySubscription" ADD CONSTRAINT "ClientPropertySubscription_clientSearchId_fkey" FOREIGN KEY ("clientSearchId") REFERENCES "ClientSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencySubmissionReview" ADD CONSTRAINT "AgencySubmissionReview_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyView" ADD CONSTRAINT "AgencyView_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyView" ADD CONSTRAINT "AgencyView_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyReview" ADD CONSTRAINT "AgencyReview_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyReview" ADD CONSTRAINT "AgencyReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_propertyLocationId_fkey" FOREIGN KEY ("propertyLocationId") REFERENCES "PropertyLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PropertyCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "PropertySubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySubcategory" ADD CONSTRAINT "PropertySubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PropertyCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyLocation" ADD CONSTRAINT "PropertyLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PropertyLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySubmissionReview" ADD CONSTRAINT "PropertySubmissionReview_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySale" ADD CONSTRAINT "PropertySale_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySale" ADD CONSTRAINT "PropertySale_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyView" ADD CONSTRAINT "PropertyView_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyView" ADD CONSTRAINT "PropertyView_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFavorite" ADD CONSTRAINT "PropertyFavorite_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFavorite" ADD CONSTRAINT "PropertyFavorite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyEngagement" ADD CONSTRAINT "PropertyEngagement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyEngagement" ADD CONSTRAINT "PropertyEngagement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
