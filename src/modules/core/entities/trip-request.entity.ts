import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Passenger } from './passenger.entity';
import { Admin } from './admin.entity';
import { Trip } from './trip.entity';
import { TripRequestPool } from './trip-request-pool.entity';
import { TripRequestStatus } from 'src/types/enums';

/**
 * A passenger's request for a route/date that currently has no matching trip.
 * Created when a search returns nothing; surfaced on the admin trip dashboard,
 * where an admin manually approves (optionally linking a real trip) or declines.
 */
@Entity('trip_requests')
export class TripRequest extends BaseEntity {
  // ── Who asked ──────────────────────────────────────────────────────────
  @Index()
  @Column({ type: 'uuid' })
  requesterUserId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requesterUserId' })
  requester: User;

  @Column({ type: 'uuid', nullable: true })
  passengerId: string | null;

  @ManyToOne(() => Passenger, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'passengerId' })
  passenger: Passenger;

  // ── What they want ─────────────────────────────────────────────────────
  @Column({ type: 'varchar' })
  origin: string;
    @Column({ type: 'varchar', nullable: true })
  originState: string | null;

  @Column({ type: 'varchar', nullable: true })
  originLga: string | null;

  @Column({ type: 'varchar', nullable: true })
  originCity: string | null;

  @Column({ type: 'varchar' })
  destination: string;

  @Column({ type: 'date' })
  requestedDate: string;

  @Column({ type: 'integer', default: 1 })
  seats: number;

  /** Passenger's preferred departure window, e.g. "7:00 AM - 9:00 AM". The
   *  concrete time used for pool scheduling is derived from the chosen slot in
   *  `metadata.preferredSlot`. */
  @Column({ type: 'varchar', nullable: true })
  preferredTime: string | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  // ── Matching ───────────────────────────────────────────────────────────
  /** Set once this request is grouped into a pool with others on the same route/date. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  poolId: string | null;

  @ManyToOne(() => TripRequestPool, (pool) => pool.requests, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'poolId' })
  pool: TripRequestPool;

  // ── Lifecycle ──────────────────────────────────────────────────────────
  @Index()
  @Column({
    type: 'varchar',
    enum: TripRequestStatus,
    default: TripRequestStatus.PENDING,
  })
  status: TripRequestStatus;

  @Column({ type: 'varchar', nullable: true })
  adminNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  processedByAdminId: string | null;

  @ManyToOne(() => Admin, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'processedByAdminId' })
  processedByAdmin: Admin;

  @Column({ type: 'timestamp with time zone', nullable: true })
  processedAt: Date | null;

  /** Set when an admin links/creates a trip that fulfils this request. */
  @Column({ type: 'uuid', nullable: true })
  linkedTripId: string | null;

  @ManyToOne(() => Trip, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linkedTripId' })
  linkedTrip: Trip;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
// import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
// import { BaseEntity } from './base.entity';
// import { User } from './user.entity';
// import { Passenger } from './passenger.entity';
// import { Admin } from './admin.entity';
// import { Trip } from './trip.entity';
// import { TripRequestPool } from './trip-request-pool.entity';
// import { TripRequestStatus } from 'src/types/enums';

// /**
//  * A passenger's request for a route/date that currently has no matching trip.
//  * Created when a search returns nothing; surfaced on the admin trip dashboard,
//  * where an admin manually approves (optionally linking a real trip) or declines.
//  */
// @Entity('trip_requests')
// export class TripRequest extends BaseEntity {
//   // ── Who asked ──────────────────────────────────────────────────────────
//   @Index()
//   @Column({ type: 'uuid' })
//   requesterUserId: string;

//   @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
//   @JoinColumn({ name: 'requesterUserId' })
//   requester: User;

//   @Column({ type: 'uuid', nullable: true })
//   passengerId: string | null;

//   @ManyToOne(() => Passenger, { nullable: true, onDelete: 'SET NULL' })
//   @JoinColumn({ name: 'passengerId' })
//   passenger: Passenger;

//   // ── What they want ─────────────────────────────────────────────────────
//   @Column({ type: 'varchar' })
//   origin: string;

//   @Column({ type: 'varchar' })
//   destination: string;

//   @Column({ type: 'date' })
//   requestedDate: string;

//   @Column({ type: 'integer', default: 1 })
//   seats: number;

//   /** Passenger's preferred departure time (HH:mm[:ss]). Drives pool scheduling. */
//   @Column({ type: 'time', nullable: true })
//   preferredTime: string | null;

//   @Column({ type: 'varchar', nullable: true })
//   note: string | null;

//   // ── Matching ───────────────────────────────────────────────────────────
//   /** Set once this request is grouped into a pool with others on the same route/date. */
//   @Index()
//   @Column({ type: 'uuid', nullable: true })
//   poolId: string | null;

//   @ManyToOne(() => TripRequestPool, (pool) => pool.requests, {
//     nullable: true,
//     onDelete: 'SET NULL',
//   })
//   @JoinColumn({ name: 'poolId' })
//   pool: TripRequestPool;

//   // ── Lifecycle ──────────────────────────────────────────────────────────
//   @Index()
//   @Column({
//     type: 'varchar',
//     enum: TripRequestStatus,
//     default: TripRequestStatus.PENDING,
//   })
//   status: TripRequestStatus;

//   @Column({ type: 'varchar', nullable: true })
//   adminNote: string | null;

//   @Column({ type: 'uuid', nullable: true })
//   processedByAdminId: string | null;

//   @ManyToOne(() => Admin, { nullable: true, onDelete: 'SET NULL' })
//   @JoinColumn({ name: 'processedByAdminId' })
//   processedByAdmin: Admin;

//   @Column({ type: 'timestamp with time zone', nullable: true })
//   processedAt: Date | null;

//   /** Set when an admin links/creates a trip that fulfils this request. */
//   @Column({ type: 'uuid', nullable: true })
//   linkedTripId: string | null;

//   @ManyToOne(() => Trip, { nullable: true, onDelete: 'SET NULL' })
//   @JoinColumn({ name: 'linkedTripId' })
//   linkedTrip: Trip;

//   @Column({ type: 'jsonb', nullable: true })
//   metadata: Record<string, any>;
// }