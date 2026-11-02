CREATE TYPE "ChallengePurpose" AS ENUM ('VERIFY_EMAIL', 'VERIFY_PHONE', 'RESET_PASSWORD');
ALTER TABLE "User" ADD COLUMN "disabledAt" timestamptz(3),
  ADD COLUMN "mfaSecretCiphertext" text, ADD COLUMN "mfaPendingCiphertext" text,
  ADD COLUMN "mfaEnabledAt" timestamptz(3), ADD COLUMN "mfaLastUsedStep" integer;

CREATE TABLE "Session" (
  "id" uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "csrfHash" char(64) NOT NULL, "web" boolean NOT NULL, "mfaVerifiedAt" timestamptz(3),
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" timestamptz(3) NOT NULL, "revokedAt" timestamptz(3),
  CONSTRAINT "Session_absolute_lifetime" CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + interval '30 days'),
  CONSTRAINT "Session_csrf_hash" CHECK ("csrfHash" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE TABLE "RefreshCredential" (
  "id" uuid PRIMARY KEY, "sessionId" uuid NOT NULL REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tokenHash" char(64) NOT NULL, "consumedAt" timestamptz(3),
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshCredential_hash" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "RefreshCredential_tokenHash_key" ON "RefreshCredential"("tokenHash");
CREATE INDEX "RefreshCredential_sessionId_idx" ON "RefreshCredential"("sessionId");
CREATE TABLE "VerificationChallenge" (
  "id" uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "purpose" "ChallengePurpose" NOT NULL, "target" varchar(254) NOT NULL, "codeHash" char(64) NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0, "consumedAt" timestamptz(3), "revokedAt" timestamptz(3),
  "expiresAt" timestamptz(3) NOT NULL, "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationChallenge_valid" CHECK ("attempts" BETWEEN 0 AND 5 AND "expiresAt" > "createdAt" AND "codeHash" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "VerificationChallenge_userId_purpose_createdAt_idx" ON "VerificationChallenge"("userId", "purpose", "createdAt");
CREATE INDEX "VerificationChallenge_expiresAt_idx" ON "VerificationChallenge"("expiresAt");
