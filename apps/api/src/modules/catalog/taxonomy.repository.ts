import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Element } from './entities/element.entity';
import { Issue } from './entities/issue.entity';
import { Meridian } from './entities/meridian.entity';

@Injectable()
export class TaxonomyRepository {
  constructor(
    @InjectRepository(Element) private readonly elements: Repository<Element>,
    @InjectRepository(Meridian) private readonly meridians: Repository<Meridian>,
    @InjectRepository(Issue) private readonly issues: Repository<Issue>,
  ) {}

  findElements(): Promise<Element[]> {
    return this.elements.find();
  }

  findMeridians(): Promise<Meridian[]> {
    return this.meridians.find({ order: { code: 'ASC' } });
  }

  findIssues(): Promise<Issue[]> {
    return this.issues.find({ order: { name: 'ASC' } });
  }

  async countMeridians(ids: string[]): Promise<number> {
    return ids.length ? this.meridians.countBy({ id: In(ids) }) : 0;
  }

  async countIssues(ids: string[]): Promise<number> {
    return ids.length ? this.issues.countBy({ id: In(ids) }) : 0;
  }
}
