import { AccessGrant } from '../modules/access/entities/access-grant.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { Invoice } from '../modules/billing/entities/invoice.entity';
import { Price } from '../modules/billing/entities/price.entity';
import { StripeEvent } from '../modules/billing/entities/stripe-event.entity';
import { Subscription } from '../modules/billing/entities/subscription.entity';
import { Element } from '../modules/catalog/entities/element.entity';
import { Issue } from '../modules/catalog/entities/issue.entity';
import { Meridian } from '../modules/catalog/entities/meridian.entity';
import { ProgramTrack } from '../modules/catalog/entities/program-track.entity';
import { Program } from '../modules/catalog/entities/program.entity';
import { TrackIssue } from '../modules/catalog/entities/track-issue.entity';
import { TrackMeridian } from '../modules/catalog/entities/track-meridian.entity';
import { Track } from '../modules/catalog/entities/track.entity';
import { MediaAsset } from '../modules/media/entities/media-asset.entity';
import { PlaybackProgress } from '../modules/playback/entities/playback-progress.entity';
import { PlaybackSession } from '../modules/playback/entities/playback-session.entity';
import { AuthIdentity } from '../modules/users/entities/auth-identity.entity';
import { RefreshToken } from '../modules/users/entities/refresh-token.entity';
import { User } from '../modules/users/entities/user.entity';

/** Explicit list (no globs) so the same set works under tsc, SWC/vitest and the CLI. */
export const entities = [
  User, AuthIdentity, RefreshToken, MediaAsset,
  Element, Meridian, Issue, Track, Program, ProgramTrack, TrackMeridian, TrackIssue,
  Price, Subscription, Invoice, StripeEvent,
  AccessGrant, PlaybackSession, PlaybackProgress, AuditLog,
];
