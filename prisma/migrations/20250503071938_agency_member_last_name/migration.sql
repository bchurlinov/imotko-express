/*
  Warnings:

  - The values [custom] on the enum `AgencyMemberRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AgencyMemberRole_new" AS ENUM ('viewer', 'collaborator', 'manager', 'admin');
ALTER TABLE "AgencyMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "AgencyMember" ALTER COLUMN "role" TYPE "AgencyMemberRole_new" USING ("role"::text::"AgencyMemberRole_new");
ALTER TYPE "AgencyMemberRole" RENAME TO "AgencyMemberRole_old";
ALTER TYPE "AgencyMemberRole_new" RENAME TO "AgencyMemberRole";
DROP TYPE "AgencyMemberRole_old";
ALTER TABLE "AgencyMember" ALTER COLUMN "role" SET DEFAULT 'viewer';
COMMIT;

-- AlterTable
ALTER TABLE "AgencyClient" ADD COLUMN     "lastName" TEXT;
