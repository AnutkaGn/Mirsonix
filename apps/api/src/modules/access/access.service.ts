import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AccessInfo, AccessSource } from '@mirsonix/shared';
import { targetKey } from '../../common/content-target';
import { AccessRepository, type AccessEntitlement, type DirectEntitlement } from './access.repository';

export const toAccessInfo = (entitlement: AccessEntitlement): AccessInfo => ({
  source: entitlement.source,
  validUntil: entitlement.validUntil?.toISOString() ?? null,
  cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
});

const PRIORITY: Record<AccessSource, number> = { TRACK_SUBSCRIPTION: 1, PROGRAM_SUBSCRIPTION: 1, GRANT: 2 };

/**
 * The only place that decides who may play what. Nothing else (controllers, the player, the library) re-derives
 * access, so a rule change happens here and nowhere else. `now` is a parameter so the rules can be tested over time.
 */
@Injectable()
export class AccessService {
  constructor(private readonly repository: AccessRepository) {}

  async trackAccess(userId: string, trackId: string, now: Date = new Date()): Promise<AccessInfo | null> {
    const entitlement = await this.repository.findTrackAccess(userId, trackId, now);
    return entitlement ? toAccessInfo(entitlement) : null;
  }

  async programAccess(userId: string, programId: string, now: Date = new Date()): Promise<AccessInfo | null> {
    const entitlement = await this.repository.findProgramAccess(userId, programId, now);
    return entitlement ? toAccessInfo(entitlement) : null;
  }

  /** 403, not 404: whether a track exists must not be learned by someone without access to it. */
  async assertTrackAccess(userId: string, trackId: string, now: Date = new Date()): Promise<AccessInfo> {
    const access = await this.trackAccess(userId, trackId, now);
    if (!access) throw new ForbiddenException('You do not have access to this track');
    return access;
  }

  async assertProgramAccess(userId: string, programId: string, now: Date = new Date()): Promise<AccessInfo> {
    const access = await this.programAccess(userId, programId, now);
    if (!access) throw new ForbiddenException('You do not have access to this program');
    return access;
  }

  /** One entry per item. When the user holds an item both by paying and by a grant, the paid one is the one shown. */
  async directEntitlements(userId: string, now: Date = new Date()): Promise<DirectEntitlement[]> {
    const best = new Map<string, DirectEntitlement>();
    for (const entitlement of await this.repository.findDirectEntitlements(userId, now)) {
      const key = targetKey({ kind: entitlement.kind, id: entitlement.targetId });
      const current = best.get(key);
      if (!current || PRIORITY[entitlement.source] < PRIORITY[current.source]) best.set(key, entitlement);
    }
    return [...best.values()];
  }
}
