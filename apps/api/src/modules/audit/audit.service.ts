import { Injectable } from '@nestjs/common';
import { AuditRepository } from './audit.repository';

export interface AuditEntry {
  adminId: string;
  /** Dotted verb, e.g. `track.publish`. */
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/** Append-only trail of what administrators changed. Never put secrets or personal data in `metadata`. */
@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  record({ metadata, ...entry }: AuditEntry): Promise<void> {
    return this.repository.insert({ ...entry, metadata: metadata ?? null });
  }
}
