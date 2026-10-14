-- AlterTable
ALTER TABLE "User" ADD COLUMN     "messagesPopupShownAt" TIMESTAMPTZ(3),
ADD COLUMN     "privateListingsPopupShownAt" TIMESTAMPTZ(3);
