/** The two things that can be sold, subscribed to, or granted: a single track or a whole program. */
export type ContentKind = 'TRACK' | 'PROGRAM';

export interface ContentTarget {
  kind: ContentKind;
  id: string;
}

export const targetKey = (target: ContentTarget): string => `${target.kind}:${target.id}`;
