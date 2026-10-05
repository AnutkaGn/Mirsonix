import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ContentStatus } from '@mirsonix/shared';
import { Repository } from 'typeorm';
import { escapeLike, toOffset } from '../../common/pagination';
import { ProgramTrack } from './entities/program-track.entity';
import { Program } from './entities/program.entity';

export interface ProgramSearch {
  page: number;
  limit: number;
  sort: 'published' | 'updated';
  status?: ContentStatus;
  q?: string;
}

export interface ProgramAggregate {
  trackCount: number;
  totalDurationSec: number;
}

export type ProgramPatch = Partial<Pick<Program, 'title' | 'description' | 'posterAssetId' | 'status' | 'publishedAt'>>;
export type NewProgram = Pick<Program, 'slug' | 'title' | 'description' | 'posterAssetId' | 'createdById'>;

const PROGRAM_RELATIONS = { posterAsset: true } as const;
const TRACK_CARD_RELATIONS = {
  track: { coverAsset: true, trackMeridians: { meridian: true }, trackIssues: { issue: true } },
} as const;

@Injectable()
export class ProgramsRepository {
  constructor(
    @InjectRepository(Program) private readonly programs: Repository<Program>,
    @InjectRepository(ProgramTrack) private readonly programTracks: Repository<ProgramTrack>,
  ) {}

  findById(id: string): Promise<Program | null> {
    return this.programs.findOne({ where: { id }, relations: PROGRAM_RELATIONS });
  }

  findBySlug(slug: string, status?: ContentStatus): Promise<Program | null> {
    return this.programs.findOne({ where: { slug, ...(status && { status }) }, relations: PROGRAM_RELATIONS });
  }

  slugExists(slug: string): Promise<boolean> {
    return this.programs.existsBy({ slug });
  }

  async create(data: NewProgram): Promise<string> {
    const program = await this.programs.save(this.programs.create({ ...data, status: 'DRAFT' }));
    return program.id;
  }

  async update(id: string, patch: ProgramPatch): Promise<void> {
    await this.programs.update(id, { ...patch, updatedAt: new Date() });
  }

  async search(filters: ProgramSearch): Promise<{ items: Program[]; total: number }> {
    const qb = this.programs.createQueryBuilder('p').leftJoinAndSelect('p.posterAsset', 'poster');
    if (filters.status) qb.andWhere('p.status = :status', { status: filters.status });
    if (filters.q) qb.andWhere('p.title ILIKE :q', { q: `%${escapeLike(filters.q)}%` });

    if (filters.sort === 'published') qb.orderBy('p.publishedAt', 'DESC', 'NULLS LAST').addOrderBy('p.title', 'ASC');
    else qb.orderBy('p.updatedAt', 'DESC');
    qb.addOrderBy('p.id', 'ASC');

    const [items, total] = await qb.skip(toOffset(filters.page, filters.limit)).take(filters.limit).getManyAndCount();
    return { items, total };
  }

  /** The program's tracks in play order, with everything a track card needs. */
  findTracks(programId: string, options: { publishedOnly: boolean }): Promise<ProgramTrack[]> {
    return this.programTracks.find({
      where: { programId, ...(options.publishedOnly && { track: { status: 'PUBLISHED' as const } }) },
      relations: TRACK_CARD_RELATIONS,
      order: { orderIndex: 'ASC' },
    });
  }

  /** Track count and total length for a page of programs, in one grouped query. */
  async aggregates(programIds: string[], options: { publishedOnly: boolean }): Promise<Map<string, ProgramAggregate>> {
    if (!programIds.length) return new Map();
    const qb = this.programTracks
      .createQueryBuilder('pt')
      .innerJoin('pt.track', 't')
      .select('pt.programId', 'programId')
      .addSelect('COUNT(*)::int', 'trackCount')
      .addSelect('COALESCE(SUM(t.durationSec), 0)::int', 'totalDurationSec')
      .where('pt.programId IN (:...programIds)', { programIds })
      .groupBy('pt.programId');
    if (options.publishedOnly) qb.andWhere("t.status = 'PUBLISHED'");

    const rows = await qb.getRawMany<{ programId: string } & ProgramAggregate>();
    return new Map(rows.map(({ programId, ...aggregate }) => [programId, aggregate]));
  }

  /** Replaces the program's track list; the array index becomes the play order. */
  setTracks(programId: string, trackIds: string[]): Promise<void> {
    return this.programs.manager.transaction(async (em) => {
      await em.delete(ProgramTrack, { programId });
      if (trackIds.length) {
        await em.insert(
          ProgramTrack,
          trackIds.map((trackId, orderIndex) => ({ programId, trackId, orderIndex })),
        );
      }
      await em.update(Program, programId, { updatedAt: new Date() });
    });
  }

  findStatusesOfTracksIn(programId: string): Promise<{ id: string; title: string; status: ContentStatus }[]> {
    return this.programTracks
      .createQueryBuilder('pt')
      .innerJoin('pt.track', 't')
      .select(['t.id AS id', 't.title AS title', 't.status AS status'])
      .where('pt.programId = :programId', { programId })
      .orderBy('pt.orderIndex')
      .getRawMany();
  }

}
