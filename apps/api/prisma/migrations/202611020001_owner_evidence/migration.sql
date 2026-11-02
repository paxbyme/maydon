-- Private evidence uses a purpose-separated AES-GCM envelope, never a public URL.
ALTER TABLE "OwnerProfile" ADD COLUMN "evidenceCiphertext" TEXT;
