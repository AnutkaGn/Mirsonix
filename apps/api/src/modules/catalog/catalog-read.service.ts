import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ProgramDetail,
  ProgramList,
  ProgramListQuery,
  Taxonomy,
  TrackList,
  TrackListQuery,
  TrackSummary,
  WuXingElement,
} from '@mirsonix/shared';
import { toPaginationMeta } from '../../common/pagination';
import { MediaService } from '../media/media.service';
import { toProgramSummary, toTrackSummary } from './catalog.mapper';
import { ProgramsRepository } from './programs.repository';
import { TaxonomyRepository } from './taxonomy.repository';
import { TracksRepository } from './tracks.repository';

/** Classical order of the Wu Xing generating cycle. */
const ELEMENT_ORDER: WuXingElement[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

/** What a signed-in listener may browse: published content only, and no way to reach the audio from here. */
@Injectable()
export class CatalogReadService {
  constructor(
    private readonly tracks: TracksRepository,
    private readonly programs: ProgramsRepository,
    private readonly taxonomyRepository: TaxonomyRepository,
    private readonly media: MediaService,
  ) {}

  async taxonomy(): Promise<Taxonomy> {
    const [elements, meridians, issues] = await Promise.all([
      this.taxonomyRepository.findElements(),
      this.taxonomyRepository.findMeridians(),
      this.taxonomyRepository.findIssues(),
    ]);
    const toMeridian = ({ id, code, name, polarity }: (typeof meridians)[number]) => ({ id, code, name, polarity });
    return {
      elements: [...elements]
        .sort((a, b) => ELEMENT_ORDER.indexOf(a.code) - ELEMENT_ORDER.indexOf(b.code))
        .map((element) => ({
          code: element.code,
          name: element.name,
          meridians: meridians.filter((m) => m.elementId === element.id).map(toMeridian),
        })),
      vessels: meridians.filter((m) => m.elementId === null).map(toMeridian),
      issues: issues.map(({ id, slug, name }) => ({ id, slug, name })),
    };
  }

  async listTracks(query: TrackListQuery): Promise<TrackList> {
    const { items, total } = await this.tracks.search({ ...query, status: 'PUBLISHED', sort: 'published' });
    const covers = await this.media.imageUrls(items.map((track) => track.coverAsset));
    return {
      items: items.map((track, i) => toTrackSummary(track, covers[i] ?? null)),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  async getTrack(slug: string): Promise<TrackSummary> {
    const track = await this.tracks.findBySlug(slug, 'PUBLISHED');
    if (!track) throw new NotFoundException('Track not found');
    return toTrackSummary(track, await this.media.imageUrl(track.coverAsset));
  }

  async listPrograms(query: ProgramListQuery): Promise<ProgramList> {
    const { items, total } = await this.programs.search({ ...query, status: 'PUBLISHED', sort: 'published' });
    const [aggregates, posters] = await Promise.all([
      this.programs.aggregates(items.map((p) => p.id), { publishedOnly: true }),
      this.media.imageUrls(items.map((program) => program.posterAsset)),
    ]);
    return {
      items: items.map((program, i) => toProgramSummary(program, posters[i] ?? null, aggregates.get(program.id))),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  async getProgram(slug: string): Promise<ProgramDetail> {
    const program = await this.programs.findBySlug(slug, 'PUBLISHED');
    if (!program) throw new NotFoundException('Program not found');

    const programTracks = await this.programs.findTracks(program.id, { publishedOnly: true });
    const [posterUrl, covers] = await Promise.all([
      this.media.imageUrl(program.posterAsset),
      this.media.imageUrls(programTracks.map(({ track }) => track.coverAsset)),
    ]);
    const aggregate = {
      trackCount: programTracks.length,
      totalDurationSec: programTracks.reduce((sum, { track }) => sum + track.durationSec, 0),
    };
    return {
      ...toProgramSummary(program, posterUrl, aggregate),
      tracks: programTracks.map(({ track }, i) => toTrackSummary(track, covers[i] ?? null)),
    };
  }
}
