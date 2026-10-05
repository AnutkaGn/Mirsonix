import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type {
  AdminProgramDetail,
  AdminProgramList,
  AdminProgramListQuery,
  CreateProgramInput,
  SetProgramTracksInput,
  UpdateProgramInput,
} from '@mirsonix/shared';
import { isUniqueViolation } from '../../common/db-errors';
import { toPaginationMeta } from '../../common/pagination';
import { uniqueSlug } from '../../common/slug';
import { AuditService } from '../audit/audit.service';
import { MediaService } from '../media/media.service';
import { toAdminProgram, toAdminTrack } from './catalog.mapper';
import { assertTransition } from './content-status';
import type { Program } from './entities/program.entity';
import { ProgramsRepository, type ProgramPatch } from './programs.repository';
import { TracksRepository } from './tracks.repository';

@Injectable()
export class ProgramsAdminService {
  constructor(
    private readonly programs: ProgramsRepository,
    private readonly tracks: TracksRepository,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminProgramListQuery): Promise<AdminProgramList> {
    const { items, total } = await this.programs.search({ ...query, sort: 'updated' });
    const [aggregates, posters] = await Promise.all([
      this.programs.aggregates(items.map((p) => p.id), { publishedOnly: false }),
      this.media.imageUrls(items.map((program) => program.posterAsset)),
    ]);
    return {
      items: items.map((program, i) => toAdminProgram(program, posters[i] ?? null, aggregates.get(program.id))),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  async get(id: string): Promise<AdminProgramDetail> {
    const program = await this.require(id);
    const programTracks = await this.programs.findTracks(id, { publishedOnly: false });
    const [posterUrl, covers] = await Promise.all([
      this.media.imageUrl(program.posterAsset),
      this.media.imageUrls(programTracks.map(({ track }) => track.coverAsset)),
    ]);
    const aggregate = {
      trackCount: programTracks.length,
      totalDurationSec: programTracks.reduce((sum, { track }) => sum + track.durationSec, 0),
    };
    return {
      ...toAdminProgram(program, posterUrl, aggregate),
      tracks: programTracks.map(({ track }, i) => toAdminTrack(track, covers[i] ?? null)),
    };
  }

  async create(adminId: string, input: CreateProgramInput): Promise<AdminProgramDetail> {
    const poster = input.posterAssetId ? await this.media.requireReadyAsset(input.posterAssetId, 'IMAGE') : null;
    const slug = await uniqueSlug(input.title, (candidate) => this.programs.slugExists(candidate));
    let id: string;
    try {
      id = await this.programs.create({
        slug,
        title: input.title,
        description: input.description,
        posterAssetId: poster?.id ?? null,
        createdById: adminId,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Another program took this title at the same moment; try again');
      throw error;
    }
    await this.audit.record({ adminId, action: 'program.create', entityType: 'program', entityId: id, metadata: { title: input.title } });
    return this.get(id);
  }

  async update(adminId: string, id: string, input: UpdateProgramInput): Promise<AdminProgramDetail> {
    const program = await this.require(id);
    this.assertEditable(program);
    const patch: ProgramPatch = {};

    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.posterAssetId !== undefined) {
      if (input.posterAssetId === null && program.status === 'PUBLISHED') {
        throw new UnprocessableEntityException('A published program needs a poster');
      }
      patch.posterAssetId = input.posterAssetId ? (await this.media.requireReadyAsset(input.posterAssetId, 'IMAGE')).id : null;
    }

    await this.programs.update(id, patch);
    await this.audit.record({ adminId, action: 'program.update', entityType: 'program', entityId: id, metadata: { fields: Object.keys(input) } });
    return this.get(id);
  }

  /** The program builder: replaces the whole ordered list in one transaction. */
  async setTracks(adminId: string, id: string, input: SetProgramTracksInput): Promise<AdminProgramDetail> {
    const program = await this.require(id);
    this.assertEditable(program);

    const found = await this.tracks.findStatuses(input.trackIds);
    if (found.length !== input.trackIds.length) throw new UnprocessableEntityException('One or more tracks do not exist');
    if (program.status === 'PUBLISHED') {
      if (!input.trackIds.length) throw new UnprocessableEntityException('A published program needs at least one track');
      if (found.some((track) => track.status !== 'PUBLISHED')) {
        throw new UnprocessableEntityException('A published program can only contain published tracks');
      }
    }

    await this.programs.setTracks(id, input.trackIds);
    await this.audit.record({
      adminId,
      action: 'program.set-tracks',
      entityType: 'program',
      entityId: id,
      metadata: { trackIds: input.trackIds },
    });
    return this.get(id);
  }

  async publish(adminId: string, id: string): Promise<AdminProgramDetail> {
    const program = await this.require(id);
    assertTransition(program.status, 'PUBLISHED', 'program');
    if (!program.posterAssetId) throw new UnprocessableEntityException('A program needs a poster before it can be published');

    const tracks = await this.programs.findStatusesOfTracksIn(id);
    if (!tracks.length) throw new UnprocessableEntityException('A program needs at least one track before it can be published');
    const unpublished = tracks.filter((track) => track.status !== 'PUBLISHED');
    if (unpublished.length) {
      throw new UnprocessableEntityException(`Publish these tracks first: ${unpublished.map((track) => track.title).join(', ')}`);
    }

    await this.programs.update(id, { status: 'PUBLISHED', publishedAt: program.publishedAt ?? new Date() });
    await this.audit.record({ adminId, action: 'program.publish', entityType: 'program', entityId: id });
    return this.get(id);
  }

  async archive(adminId: string, id: string): Promise<AdminProgramDetail> {
    const program = await this.require(id);
    assertTransition(program.status, 'ARCHIVED', 'program');

    await this.programs.update(id, { status: 'ARCHIVED' });
    await this.audit.record({ adminId, action: 'program.archive', entityType: 'program', entityId: id });
    return this.get(id);
  }

  private async require(id: string): Promise<Program> {
    const program = await this.programs.findById(id);
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  private assertEditable(program: Program): void {
    if (program.status === 'ARCHIVED') throw new ConflictException('An archived program cannot be edited; publish it again first');
  }
}
