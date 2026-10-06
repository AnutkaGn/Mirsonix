import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { AccessGrant as AccessGrantDto, AccessGrantList, AccessGrantListQuery, CreateAccessGrantInput } from '@mirsonix/shared';
import { toPaginationMeta } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { ContentLookupService } from '../catalog/content-lookup.service';
import { UsersService } from '../users/users.service';
import { AccessGrantsRepository } from './access-grants.repository';
import type { AccessGrant } from './entities/access-grant.entity';

const toDto = (grant: AccessGrant): AccessGrantDto => ({
  id: grant.id,
  userId: grant.userId,
  userEmail: grant.user.email,
  trackId: grant.trackId,
  programId: grant.programId,
  source: grant.source,
  expiresAt: grant.expiresAt?.toISOString() ?? null,
  revokedAt: grant.revokedAt?.toISOString() ?? null,
  note: grant.note,
  createdAt: grant.createdAt.toISOString(),
});

/** Manual access that bypasses billing: support gestures and promotions. Always attributed to an administrator. */
@Injectable()
export class AccessGrantsService {
  constructor(
    private readonly grants: AccessGrantsRepository,
    private readonly users: UsersService,
    private readonly content: ContentLookupService,
    private readonly audit: AuditService,
  ) {}

  async create(adminId: string, input: CreateAccessGrantInput): Promise<AccessGrantDto> {
    const user = await this.users.findByEmail(input.userEmail);
    if (!user) throw new NotFoundException('No user has that email');
    await this.content.basics(input.trackId ? { kind: 'TRACK', id: input.trackId } : { kind: 'PROGRAM', id: input.programId as string });

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) throw new UnprocessableEntityException('The expiry must be in the future');

    const id = await this.grants.create({
      userId: user.id,
      trackId: input.trackId ?? null,
      programId: input.programId ?? null,
      source: input.source,
      expiresAt,
      note: input.note ?? null,
      grantedById: adminId,
    });
    await this.audit.record({
      adminId,
      action: 'access-grant.create',
      entityType: 'access_grant',
      entityId: id,
      metadata: { userId: user.id, trackId: input.trackId ?? null, programId: input.programId ?? null, source: input.source },
    });
    return this.require(id);
  }

  /** Revoking twice is harmless: the first revocation time is kept. */
  async revoke(adminId: string, id: string): Promise<AccessGrantDto> {
    const grant = await this.requireEntity(id);
    if (!grant.revokedAt) {
      await this.grants.revoke(id, new Date());
      await this.audit.record({ adminId, action: 'access-grant.revoke', entityType: 'access_grant', entityId: id });
    }
    return this.require(id);
  }

  async list(query: AccessGrantListQuery): Promise<AccessGrantList> {
    const { items, total } = await this.grants.search(query);
    return { items: items.map(toDto), meta: toPaginationMeta(query.page, query.limit, total) };
  }

  private async require(id: string): Promise<AccessGrantDto> {
    return toDto(await this.requireEntity(id));
  }

  private async requireEntity(id: string): Promise<AccessGrant> {
    const grant = await this.grants.findById(id);
    if (!grant) throw new NotFoundException('Access grant not found');
    return grant;
  }
}
