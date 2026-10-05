import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ContentStatus, WaveType, WuXingElement } from '@mirsonix/shared';
import { EntityManager, In, Repository } from 'typeorm';
import { escapeLike, toOffset } from '../../common/pagination';
import { ProgramTrack } from './entities/program-track.entity';
import { TrackIssue } from './entities/track-issue.entity';
import { TrackMeridian } from './entities/track-meridian.entity';
import { Track } from './entities/track.entity';

export interface TrackSearch {
  page: number;
  limit: number;
  /** `published`: newest release first (catalog). `updated`: last edited first (admin). */
  sort: 'published' | 'updated';
  status?: ContentStatus;
  q?: string;
  wave?: WaveType;
  issue?: string;
  meridian?: string;
  element?: WuXingElement;
}

export type TrackPatch = Partial<
  Pick<
    Track,
    'title' | 'description' | 'durationSec' | 'frequencyHz' | 'waveType' | 'audioAssetId' | 'coverAssetId' | 'status' | 'publishedAt'
  >
>;

export type NewTrack = Pick<
  Track,
  'slug' | 'title' | 'description' | 'durationSec' | 'frequencyHz' | 'waveType' | 'audioAssetId' | 'coverAssetId' | 'createdById'
>;

/** Everything a track card needs, loaded in one go so listing never turns into N+1 queries. */
const CARD_RELATIONS = { coverAsset: true, trackMeridians: { meridian: true }, trackIssues: { issue: true } } as const;

@Injectable()
export class TracksRepository {
  constructor(@InjectRepository(Track) private readonly tracks: Repository<Track>) {}

  findById(id: string): Promise<Track | null> {
    return this.tracks.findOne({ where: { id }, relations: CARD_RELATIONS });
  }

  findBySlug(slug: string, status?: ContentStatus): Promise<Track | null> {
    return this.tracks.findOne({ where: { slug, ...(status && { status }) }, relations: CARD_RELATIONS });
  }

  slugExists(slug: string): Promise<boolean> {
    return this.tracks.existsBy({ slug });
  }

  findStatuses(ids: string[]): Promise<Pick<Track, 'id' | 'status'>[]> {
    return ids.length ? this.tracks.find({ select: { id: true, status: true }, where: { id: In(ids) } }) : Promise.resolve([]);
  }

  /** Titles of published programs that contain the track; archiving it would leave them with a dead entry. */
  async publishedProgramTitlesContaining(trackId: string): Promise<string[]> {
    const rows = await this.tracks.manager
      .createQueryBuilder(ProgramTrack, 'pt')
      .innerJoin('pt.program', 'p')
      .select('p.title', 'title')
      .where('pt.trackId = :trackId', { trackId })
      .andWhere("p.status = 'PUBLISHED'")
      .orderBy('p.title')
      .getRawMany<{ title: string }>();
    return rows.map((row) => row.title);
  }

  async search(filters: TrackSearch): Promise<{ items: Track[]; total: number }> {
    const qb = this.tracks.createQueryBuilder('t').select('t.id');
    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status });
    if (filters.q) qb.andWhere('t.title ILIKE :q', { q: `%${escapeLike(filters.q)}%` });
    if (filters.wave) qb.andWhere('t.waveType = :wave', { wave: filters.wave });
    // EXISTS keeps one row per track, so pagination stays correct without DISTINCT or joins that multiply rows.
    if (filters.issue) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM track_issues ti JOIN issues i ON i.id = ti.issue_id WHERE ti.track_id = t.id AND i.slug = :issue)',
        { issue: filters.issue },
      );
    }
    if (filters.meridian) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM track_meridians tm JOIN meridians m ON m.id = tm.meridian_id WHERE tm.track_id = t.id AND m.code = :meridian)',
        { meridian: filters.meridian },
      );
    }
    if (filters.element) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM track_meridians tm JOIN meridians m ON m.id = tm.meridian_id
                 JOIN elements e ON e.id = m.element_id WHERE tm.track_id = t.id AND e.code = :element)`,
        { element: filters.element },
      );
    }

    if (filters.sort === 'published') qb.orderBy('t.publishedAt', 'DESC', 'NULLS LAST').addOrderBy('t.title', 'ASC');
    else qb.orderBy('t.updatedAt', 'DESC');
    qb.addOrderBy('t.id', 'ASC'); // stable order, so a page never repeats or skips a row

    const [page, total] = await qb.skip(toOffset(filters.page, filters.limit)).take(filters.limit).getManyAndCount();
    return { items: await this.hydrate(page.map((t) => t.id)), total };
  }

  /** Loads full cards for the ids of one page and returns them in that page's order. */
  private async hydrate(ids: string[]): Promise<Track[]> {
    if (!ids.length) return [];
    const loaded = await this.tracks.find({ where: { id: In(ids) }, relations: CARD_RELATIONS });
    const byId = new Map(loaded.map((track) => [track.id, track]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  create(data: NewTrack, meridianIds: string[], issueIds: string[]): Promise<string> {
    return this.tracks.manager.transaction(async (em) => {
      const track = await em.save(Track, em.create(Track, { ...data, status: 'DRAFT' }));
      await this.replaceTaxonomy(em, track.id, meridianIds, issueIds);
      return track.id;
    });
  }

  /** `meridianIds` / `issueIds` left undefined mean "unchanged". */
  update(id: string, patch: TrackPatch, meridianIds?: string[], issueIds?: string[]): Promise<void> {
    return this.tracks.manager.transaction(async (em) => {
      await em.update(Track, id, { ...patch, updatedAt: new Date() });
      await this.replaceTaxonomy(em, id, meridianIds, issueIds);
    });
  }

  private async replaceTaxonomy(em: EntityManager, trackId: string, meridianIds?: string[], issueIds?: string[]): Promise<void> {
    if (meridianIds) {
      await em.delete(TrackMeridian, { trackId });
      if (meridianIds.length) await em.insert(TrackMeridian, meridianIds.map((meridianId) => ({ trackId, meridianId })));
    }
    if (issueIds) {
      await em.delete(TrackIssue, { trackId });
      if (issueIds.length) await em.insert(TrackIssue, issueIds.map((issueId) => ({ trackId, issueId })));
    }
  }
}
