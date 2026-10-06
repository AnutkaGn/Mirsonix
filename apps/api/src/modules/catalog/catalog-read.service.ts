import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ProgramDetail,
  ProgramList,
  ProgramListQuery,
  ProgramSummary,
  Taxonomy,
  TrackList,
  TrackListQuery,
  TrackSummary,
  WuXingElement,
} from '@mirsonix/shared';
import { toPaginationMeta } from '../../common/pagination';
import { MediaService } from '../media/media.service';
import { PricingService } from '../pricing/pricing.service';
import { toProgramSummary, toTrackSummary } from './catalog.mapper';
import type { Program } from './entities/program.entity';
import type { Track } from './entities/track.entity';
import { ProgramsRepository } from './programs.repository';
import { TaxonomyRepository } from './taxonomy.repository';
import { TracksRepository } from './tracks.repository';

/** Classical order of the Wu Xing generating cycle. */
const ELEMENT_ORDER: WuXingElement[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

/**
 * What a signed-in listener may browse: published content only, and no way to reach the audio from here.
 * The `*ById` methods are for the library, where a subscriber keeps seeing what they bought even after it is archived.
 */
@Injectable()
export class CatalogReadService {
  constructor(
    private readonly tracks: TracksRepository,
    private readonly programs: ProgramsRepository,
    private readonly taxonomyRepository: TaxonomyRepository,
    private readonly media: MediaService,
    private readonly pricing: PricingService,
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
    return { items: await this.trackSummaries(items), meta: toPaginationMeta(query.page, query.limit, total) };
  }

  async getTrack(slug: string): Promise<TrackSummary> {
    const track = await this.tracks.findBySlug(slug, 'PUBLISHED');
    if (!track) throw new NotFoundException('Track not found');
    return this.trackSummary(track);
  }

  async listPrograms(query: ProgramListQuery): Promise<ProgramList> {
    const { items, total } = await this.programs.search({ ...query, status: 'PUBLISHED', sort: 'published' });
    return {
      items: await this.programSummaries(items, { publishedOnly: true }),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  async getProgram(slug: string): Promise<ProgramDetail> {
    const program = await this.programs.findBySlug(slug, 'PUBLISHED');
    if (!program) throw new NotFoundException('Program not found');
    return this.programDetail(program, { publishedOnly: true });
  }

  /* ---------- for the library: any status ---------- */

  async trackCardsByIds(ids: string[]): Promise<Map<string, TrackSummary>> {
    const summaries = await this.trackSummaries(await this.tracks.findManyByIds(ids));
    return new Map(summaries.map((summary) => [summary.id, summary]));
  }

  async programCardsByIds(ids: string[]): Promise<Map<string, ProgramSummary>> {
    const summaries = await this.programSummaries(await this.programs.findManyByIds(ids), { publishedOnly: false });
    return new Map(summaries.map((summary) => [summary.id, summary]));
  }

  async programDetailById(id: string): Promise<ProgramDetail> {
    const program = await this.programs.findById(id);
    if (!program) throw new NotFoundException('Program not found');
    return this.programDetail(program, { publishedOnly: false });
  }

  /* ---------- building blocks ---------- */

  /** Cover URLs and prices for a page of tracks, each fetched in one batch rather than once per track. */
  private async trackSummaries(tracks: Track[]): Promise<TrackSummary[]> {
    const [covers, book] = await Promise.all([
      this.media.imageUrls(tracks.map((track) => track.coverAsset)),
      this.pricing.bookFor(tracks.map((track) => track.id), []),
    ]);
    return tracks.map((track, i) => toTrackSummary(track, covers[i] ?? null, book.for({ kind: 'TRACK', id: track.id })));
  }

  private async trackSummary(track: Track): Promise<TrackSummary> {
    const [summary] = await this.trackSummaries([track]);
    return summary as TrackSummary; // one track in, one summary out
  }

  private async programSummaries(programs: Program[], options: { publishedOnly: boolean }): Promise<ProgramSummary[]> {
    const ids = programs.map((program) => program.id);
    const [aggregates, posters, book] = await Promise.all([
      this.programs.aggregates(ids, options),
      this.media.imageUrls(programs.map((program) => program.posterAsset)),
      this.pricing.bookFor([], ids),
    ]);
    return programs.map((program, i) =>
      toProgramSummary(program, posters[i] ?? null, book.for({ kind: 'PROGRAM', id: program.id }), aggregates.get(program.id)),
    );
  }

  private async programDetail(program: Program, options: { publishedOnly: boolean }): Promise<ProgramDetail> {
    const tracks = (await this.programs.findTracks(program.id, options)).map(({ track }) => track);
    const [posterUrl, prices, trackSummaries] = await Promise.all([
      this.media.imageUrl(program.posterAsset),
      this.pricing.pricesOf({ kind: 'PROGRAM', id: program.id }),
      this.trackSummaries(tracks),
    ]);
    const aggregate = {
      trackCount: tracks.length,
      totalDurationSec: tracks.reduce((sum, track) => sum + track.durationSec, 0),
    };
    return { ...toProgramSummary(program, posterUrl, prices, aggregate), tracks: trackSummaries };
  }
}
