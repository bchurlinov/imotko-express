UPDATE "Client" SET "receiveCompanyEmail" = true;
ALTER TABLE "Client"
    ALTER COLUMN "receiveCompanyEmail" SET DEFAULT true,
    ALTER COLUMN "receiveCompanyEmail" SET NOT NULL;
