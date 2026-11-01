import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface AuditInput {
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  metadata?: Prisma.InputJsonObject;
}

// Store identifiers and decision codes, never copies of private request bodies.
const sensitiveKey =
  /password|secret|token|authorization|cookie|email|phone|contact|otp/i;
function checkMetadata(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveKey.test(key)) throw new Error('AUDIT_METADATA_SENSITIVE');
    checkMetadata(nested);
  }
}

@Injectable()
export class AuditService {
  record(tx: Prisma.TransactionClient, input: AuditInput) {
    checkMetadata(input.metadata);
    return tx.auditEvent.create({
      data: { ...input, metadata: input.metadata ?? {} },
    });
  }
}
