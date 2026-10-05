import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, Unique, type Relation } from 'typeorm';
import { Program } from './program.entity';
import { Track } from './track.entity';

@Entity('program_tracks')
@Check('chk_program_tracks_order_non_negative', '"order_index" >= 0')
// Deferred so a reorder (swapping two indexes) can be done in one transaction without transient violations.
@Unique('uq_program_tracks_order', ['programId', 'orderIndex'], { deferrable: 'INITIALLY DEFERRED' })
export class ProgramTrack {
  @PrimaryColumn({ type: 'uuid' })
  programId: string;

  @PrimaryColumn({ type: 'uuid' })
  trackId: string;

  @ManyToOne(() => Program, (p) => p.programTracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program: Relation<Program>;

  /** Reverse lookup (which programs contain this track) is on the hot path of the access check. */
  @Index()
  @ManyToOne(() => Track, (t) => t.programTracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'track_id' })
  track: Relation<Track>;

  @Column({ type: 'int' })
  orderIndex: number;
}
