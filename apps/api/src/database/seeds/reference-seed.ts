import type { EntityManager } from 'typeorm';
import { Element } from '../../modules/catalog/entities/element.entity';
import { Issue } from '../../modules/catalog/entities/issue.entity';
import { Meridian } from '../../modules/catalog/entities/meridian.entity';
import { ELEMENTS, ISSUES, MERIDIANS } from './reference-data';

/** Elements, meridians and issues. Idempotent: existing rows are updated by their natural key, never duplicated. */
export async function seedReferenceData(em: EntityManager): Promise<void> {
  await em.getRepository(Element).upsert(ELEMENTS, ['code']);
  const elements = new Map((await em.getRepository(Element).find()).map((e) => [e.code, e.id]));

  await em.getRepository(Meridian).upsert(
    MERIDIANS.map(({ element, ...meridian }) => ({ ...meridian, elementId: element ? (elements.get(element) ?? null) : null })),
    ['code'],
  );
  await em.getRepository(Issue).upsert(ISSUES, ['slug']);
}
