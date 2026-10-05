import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type {
  AdminTrack,
  AdminTrackList,
  AdminTrackListQuery,
  AudioPreview,
  CreateTrackInput,
  UpdateTrackInput,
} from '@mirsonix/shared';
import { isUniqueViolation } from '../../common/db-errors';
import { toPaginationMeta } from '../../common/pagination';
import { uniqueSlug } from '../../common/slug';
import { AuditService } from '../audit/audit.service';
import type { MediaAsset } from '../media/entities/media-asset.entity';
import { MediaService } from '../media/media.service';
import { toAdminTrack } from './catalog.mapper';
import { assertTransition } from './content-status';
import type { Track } from './entities/track.entity';
import { TaxonomyRepository } from './taxonomy.repository';
import { TracksRepository, type TrackPatch } from './tracks.repository';

const durationSecOf = (audio: MediaAsset): number => {
  if (!audio.durationMs) throw new UnprocessableEntityException(`Audio asset ${audio.id} has no duration`);
  return Math.max(1, Math.round(audio.durationMs / 1000));
};

@Injectable()
export class TracksAdminService {
  constructor(
    private readonly tracks: TracksRepository,
    private readonly taxonomy: TaxonomyRepository,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminTrackListQuery): Promise<AdminTrackList> {
    const { items, total } = await this.tracks.search({ ...query, sort: 'updated' });
    const covers = await this.media.imageUrls(items.map((track) => track.coverAsset));
    return {
      items: items.map((track, i) => toAdminTrack(track, covers[i] ?? null)),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  async get(id: string): Promise<AdminTrack> {
    const track = await this.require(id);
    return toAdminTrack(track, await this.media.imageUrl(track.coverAsset));
  }

  async create(adminId: string, input: CreateTrackInput): Promise<AdminTrack> {
    const audio = await this.media.requireReadyAsset(input.audioAssetId, 'AUDIO');
    const cover = input.coverAssetId ? await this.media.requireReadyAsset(input.coverAssetId, 'IMAGE') : null;
    await this.assertTaxonomyExists(input.meridianIds, input.issueIds);

    const slug = await uniqueSlug(input.title, (candidate) => this.tracks.slugExists(candidate));
    let id: string;
    try {
      id = await this.tracks.create(
        {
          slug,
          title: input.title,
          description: input.description,
          durationSec: durationSecOf(audio),
          frequencyHz: input.frequencyHz ?? null,
          waveType: input.waveType ?? null,
          audioAssetId: audio.id,
          coverAssetId: cover?.id ?? null,
          createdById: adminId,
        },
        input.meridianIds,
        input.issueIds,
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('Another track took this title at the same moment; try again');
      throw error;
    }
    await this.audit.record({ adminId, action: 'track.create', entityType: 'track', entityId: id, metadata: { title: input.title } });
    return this.get(id);
  }

  async update(adminId: string, id: string, input: UpdateTrackInput): Promise<AdminTrack> {
    const track = await this.require(id);
    const patch: TrackPatch = {};

    if (input.title !== undefined) patch.title = input.title; // the slug stays, so existing links keep working
    if (input.description !== undefined) patch.description = input.description;
    if (input.frequencyHz !== undefined) patch.frequencyHz = input.frequencyHz;
    if (input.waveType !== undefined) patch.waveType = input.waveType;
    if (input.audioAssetId !== undefined && input.audioAssetId !== track.audioAssetId) {
      const audio = await this.media.requireReadyAsset(input.audioAssetId, 'AUDIO');
      patch.audioAssetId = audio.id;
      patch.durationSec = durationSecOf(audio);
    }
    if (input.coverAssetId !== undefined) {
      if (input.coverAssetId === null && track.status === 'PUBLISHED') {
        throw new UnprocessableEntityException('A published track needs a cover');
      }
      patch.coverAssetId = input.coverAssetId ? (await this.media.requireReadyAsset(input.coverAssetId, 'IMAGE')).id : null;
    }
    await this.assertTaxonomyExists(input.meridianIds ?? [], input.issueIds ?? []);

    await this.tracks.update(id, patch, input.meridianIds, input.issueIds);
    await this.audit.record({ adminId, action: 'track.update', entityType: 'track', entityId: id, metadata: { fields: Object.keys(input) } });
    return this.get(id);
  }

  async publish(adminId: string, id: string): Promise<AdminTrack> {
    const track = await this.require(id);
    assertTransition(track.status, 'PUBLISHED', 'track');
    if (!track.coverAssetId) throw new UnprocessableEntityException('A track needs a cover before it can be published');

    await this.tracks.update(id, { status: 'PUBLISHED', publishedAt: track.publishedAt ?? new Date() });
    await this.audit.record({ adminId, action: 'track.publish', entityType: 'track', entityId: id });
    return this.get(id);
  }

  async archive(adminId: string, id: string): Promise<AdminTrack> {
    const track = await this.require(id);
    assertTransition(track.status, 'ARCHIVED', 'track');
    const programs = await this.tracks.publishedProgramTitlesContaining(id);
    if (programs.length) {
      throw new ConflictException(`Remove this track from the published programs first: ${programs.join(', ')}`);
    }

    await this.tracks.update(id, { status: 'ARCHIVED' });
    await this.audit.record({ adminId, action: 'track.archive', entityType: 'track', entityId: id });
    return this.get(id);
  }

  /** Lets an administrator listen to a track while editing it. Listener access is a separate, access-checked path. */
  async audioPreview(id: string): Promise<AudioPreview> {
    const track = await this.require(id);
    return this.media.signedAudioUrl(await this.media.requireReadyAsset(track.audioAssetId, 'AUDIO'));
  }

  private async require(id: string): Promise<Track> {
    const track = await this.tracks.findById(id);
    if (!track) throw new NotFoundException('Track not found');
    return track;
  }

  private async assertTaxonomyExists(meridianIds: string[], issueIds: string[]): Promise<void> {
    const [meridians, issues] = await Promise.all([this.taxonomy.countMeridians(meridianIds), this.taxonomy.countIssues(issueIds)]);
    if (meridians !== meridianIds.length) throw new UnprocessableEntityException('Unknown meridian id');
    if (issues !== issueIds.length) throw new UnprocessableEntityException('Unknown issue id');
  }
}
