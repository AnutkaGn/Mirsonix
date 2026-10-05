import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';

/** camelCase properties -> snake_case columns, matching the ERD. Table names are set explicitly per entity. */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override columnName(propertyName: string, customName: string | undefined, embeddedPrefixes: string[]): string {
    const name = customName ?? snakeCase(propertyName);
    return embeddedPrefixes.length ? `${snakeCase(embeddedPrefixes.join('_'))}_${name}` : name;
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }
}
