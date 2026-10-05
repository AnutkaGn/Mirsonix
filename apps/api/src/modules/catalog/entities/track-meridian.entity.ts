import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Meridian } from './meridian.entity';
import { Track } from './track.entity';

@Entity('track_meridians')
export class TrackMeridian {
  @PrimaryColumn({ type: 'uuid' })
  trackId: string;

  @PrimaryColumn({ type: 'uuid' })
  meridianId: string;

  @ManyToOne(() => Track, (t) => t.trackMeridians, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'track_id' })
  track: Relation<Track>;

  @Index()
  @ManyToOne(() => Meridian, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meridian_id' })
  meridian: Relation<Meridian>;
}
