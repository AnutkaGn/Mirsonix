import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Issue } from './issue.entity';
import { Track } from './track.entity';

@Entity('track_issues')
export class TrackIssue {
  @PrimaryColumn({ type: 'uuid' })
  trackId: string;

  @PrimaryColumn({ type: 'uuid' })
  issueId: string;

  @ManyToOne(() => Track, (t) => t.trackIssues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'track_id' })
  track: Relation<Track>;

  @Index()
  @ManyToOne(() => Issue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issue_id' })
  issue: Relation<Issue>;
}
