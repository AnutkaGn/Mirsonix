import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ACCESS_GRANTING_STATUSES, ACCESS_PERIOD_GRACE_SECONDS, type AccessSource } from '@mirsonix/shared';
import { Repository } from 'typeorm';
import type { ContentKind } from '../../common/content-target';
import { AccessGrant } from './entities/access-grant.entity';

export interface AccessEntitlement {
  source: AccessSource;
  validUntil: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface DirectEntitlement extends AccessEntitlement {
  kind: ContentKind;
  targetId: string;
}

interface Row {
  source: AccessSource;
  valid_until: Date | null;
  cancel_at_period_end: boolean;
  kind?: ContentKind;
  target_id?: string;
}

/**
 * A subscription counts while its status grants access AND its paid period has not been over for longer than the
 * grace. Without the second half, a silent webhook outage would leave every ACTIVE subscription valid forever.
 * Parameters: $1 user, $2 granting statuses, $3 period cutoff (now - grace), $4 now (grants have no grace).
 */
const SUBSCRIPTION_IS_VALID = `s.status = ANY($2::subscription_status[]) AND (s.current_period_end IS NULL OR s.current_period_end > $3)`;
const GRANT_IS_VALID = `g.user_id = $1 AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > $4)`;

const toEntitlement = (row: Row): AccessEntitlement => ({
  source: row.source,
  validUntil: row.valid_until,
  cancelAtPeriodEnd: row.cancel_at_period_end,
});

/**
 * The read model behind every access decision. It queries subscriptions, program membership and grants directly,
 * because "who may play what" must be answered in one round trip, not by stitching together other modules' data.
 */
@Injectable()
export class AccessRepository {
  constructor(@InjectRepository(AccessGrant) private readonly grants: Repository<AccessGrant>) {}

  /** The best way this user can play the track, or null. A track subscription outranks a program, which outranks a grant. */
  async findTrackAccess(userId: string, trackId: string, now: Date): Promise<AccessEntitlement | null> {
    const rows: Row[] = await this.grants.query(
      `SELECT source, valid_until, cancel_at_period_end FROM (
         SELECT 'TRACK_SUBSCRIPTION' AS source, 1 AS priority, s.current_period_end AS valid_until, s.cancel_at_period_end
           FROM subscriptions s
          WHERE s.user_id = $1 AND s.track_id = $5 AND ${SUBSCRIPTION_IS_VALID}
         UNION ALL
         SELECT 'PROGRAM_SUBSCRIPTION', 2, s.current_period_end, s.cancel_at_period_end
           FROM subscriptions s JOIN program_tracks pt ON pt.program_id = s.program_id
          WHERE s.user_id = $1 AND pt.track_id = $5 AND ${SUBSCRIPTION_IS_VALID}
         UNION ALL
         SELECT 'GRANT', 3, g.expires_at, false
           FROM access_grants g
          WHERE ${GRANT_IS_VALID}
            AND (g.track_id = $5 OR g.program_id IN (SELECT pt.program_id FROM program_tracks pt WHERE pt.track_id = $5))
       ) access
       ORDER BY priority, valid_until DESC NULLS FIRST
       LIMIT 1`,
      [userId, ACCESS_GRANTING_STATUSES, this.cutoff(now), now, trackId],
    );
    return rows[0] ? toEntitlement(rows[0]) : null;
  }

  async findProgramAccess(userId: string, programId: string, now: Date): Promise<AccessEntitlement | null> {
    const rows: Row[] = await this.grants.query(
      `SELECT source, valid_until, cancel_at_period_end FROM (
         SELECT 'PROGRAM_SUBSCRIPTION' AS source, 1 AS priority, s.current_period_end AS valid_until, s.cancel_at_period_end
           FROM subscriptions s
          WHERE s.user_id = $1 AND s.program_id = $5 AND ${SUBSCRIPTION_IS_VALID}
         UNION ALL
         SELECT 'GRANT', 2, g.expires_at, false
           FROM access_grants g
          WHERE ${GRANT_IS_VALID} AND g.program_id = $5
       ) access
       ORDER BY priority, valid_until DESC NULLS FIRST
       LIMIT 1`,
      [userId, ACCESS_GRANTING_STATUSES, this.cutoff(now), now, programId],
    );
    return rows[0] ? toEntitlement(rows[0]) : null;
  }

  /** Everything the user holds directly (a bought or granted track or program), for the library. */
  async findDirectEntitlements(userId: string, now: Date): Promise<DirectEntitlement[]> {
    const rows: Row[] = await this.grants.query(
      `SELECT 'TRACK' AS kind, s.track_id AS target_id, 'TRACK_SUBSCRIPTION' AS source,
              s.current_period_end AS valid_until, s.cancel_at_period_end
         FROM subscriptions s WHERE s.user_id = $1 AND s.track_id IS NOT NULL AND ${SUBSCRIPTION_IS_VALID}
       UNION ALL
       SELECT 'PROGRAM', s.program_id, 'PROGRAM_SUBSCRIPTION', s.current_period_end, s.cancel_at_period_end
         FROM subscriptions s WHERE s.user_id = $1 AND s.program_id IS NOT NULL AND ${SUBSCRIPTION_IS_VALID}
       UNION ALL
       SELECT CASE WHEN g.track_id IS NOT NULL THEN 'TRACK' ELSE 'PROGRAM' END, COALESCE(g.track_id, g.program_id),
              'GRANT', g.expires_at, false
         FROM access_grants g WHERE ${GRANT_IS_VALID}`,
      [userId, ACCESS_GRANTING_STATUSES, this.cutoff(now), now],
    );
    return rows.map((row) => ({ ...toEntitlement(row), kind: row.kind as ContentKind, targetId: row.target_id as string }));
  }

  private cutoff(now: Date): Date {
    return new Date(now.getTime() - ACCESS_PERIOD_GRACE_SECONDS * 1000);
  }
}
