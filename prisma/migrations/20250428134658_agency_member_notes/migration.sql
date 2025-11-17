-- AlterEnum
ALTER TYPE "AgencyMemberStatus" ADD VALUE 'deleted';

-- CreateTable
CREATE TABLE "AgencyClientNotes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AgencyClientNotes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgencyClientNotes" ADD CONSTRAINT "AgencyClientNotes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AgencyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
