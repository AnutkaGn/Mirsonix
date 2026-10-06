import { Injectable } from '@nestjs/common';
import type { Library, LibraryProgramDetail } from '@mirsonix/shared';
import { CatalogReadService } from '../catalog/catalog-read.service';
import { AccessService, toAccessInfo } from './access.service';

/** "My Library": exactly what the user may play, and nothing they merely browsed. */
@Injectable()
export class LibraryService {
  constructor(
    private readonly access: AccessService,
    private readonly catalog: CatalogReadService,
  ) {}

  async get(userId: string, now: Date = new Date()): Promise<Library> {
    const entitlements = await this.access.directEntitlements(userId, now);
    const trackEntitlements = entitlements.filter((e) => e.kind === 'TRACK');
    const programEntitlements = entitlements.filter((e) => e.kind === 'PROGRAM');

    const [trackCards, programCards] = await Promise.all([
      this.catalog.trackCardsByIds(trackEntitlements.map((e) => e.targetId)),
      this.catalog.programCardsByIds(programEntitlements.map((e) => e.targetId)),
    ]);
    const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);
    return {
      tracks: trackEntitlements
        .flatMap((e) => {
          const card = trackCards.get(e.targetId);
          return card ? [{ ...card, access: toAccessInfo(e) }] : [];
        })
        .sort(byTitle),
      programs: programEntitlements
        .flatMap((e) => {
          const card = programCards.get(e.targetId);
          return card ? [{ ...card, access: toAccessInfo(e) }] : [];
        })
        .sort(byTitle),
    };
  }

  /** A program the user holds, with its tracks in play order, even if it has been archived since they bought it. */
  async program(userId: string, programId: string, now: Date = new Date()): Promise<LibraryProgramDetail> {
    const access = await this.access.assertProgramAccess(userId, programId, now);
    return { ...(await this.catalog.programDetailById(programId)), access };
  }
}
