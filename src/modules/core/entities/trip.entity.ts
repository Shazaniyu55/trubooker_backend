import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { TripStatus } from '../../../types/enums';
import { Driver } from './driver.entity';
import { Vehicle } from './vehicle.entity';
import { BaseEntity } from './base.entity';
import { Passenger } from './passenger.entity';
import { Booking } from './booking.entity';

@Entity('trips')
export class Trip extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  reference: string;

  @Column({ type: 'string' })
  driverId: string;

  @ManyToOne(() => Driver)
  @JoinColumn({ name: 'driverId' })
  driver: Driver;

  @Column({ type: 'uuid', nullable: true })
  vehicleId: string;

  @ManyToOne(() => Vehicle, { nullable: true })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ type: 'uuid', nullable: true })
  passengerId: string | null;

  @ManyToOne(() => Passenger, { nullable: true })
  @JoinColumn({ name: 'passengerId' })
  passenger: Passenger;


  @Column({ type: 'date' })
  departureDate: string;

  @Column({ type: 'time' })
  departureTime: string;

  @Column({ type: 'date', nullable: true })
  arrivalDate: string | null;

  @Column({ type: 'time', nullable: true })
  arrivalTime: string;

    @Column({ type: 'varchar',  nullable: true})
  departureLocation: string;

    @Column({ type: 'jsonb', nullable: true })
  arrivalDestination: any[];

    @Column({ type: 'jsonb', nullable: true })
  tripSpecification: any[];

    @Column({ type: 'varchar', nullable: true })
  pickStation: string | null;

    @Column({ type: 'varchar', nullable: true })
  dropOffStation: string | null;

    @Column({ type: 'date', nullable: true })
  bookingClosingDate: string | null;

    @Column({ type: 'time', nullable: true })
  bookingClosingTime: string | null;

  @Column({ type: 'jsonb', nullable: true })
  busStop: any[];

  @Column({ type: 'integer' })
  totalSeats: number;

  

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'integer' })
  availableSeats: number;

  @Column({ type: 'varchar', enum: TripStatus, default: TripStatus.PENDING })
  status: TripStatus;

  @Column({ type: 'jsonb', nullable: true })
  waypoints: any[];

  @Column({ type: 'integer', default: 0 })
bookedSeats: number;

  @Column({ type: 'varchar', nullable: true })       // ← ADD
  description: string;

  @Column({ type: 'jsonb', nullable: true })          // ← ADD
  vehicleFeatures : string[];

   @Column({ type: 'varchar', nullable: true })
  reasonForTripCancellation: string | null;

   @Column({ type: 'boolean', default: false })
  cancelledByDriver: boolean;

    @Column({ type: 'jsonb', nullable: true })
  departureLatlong: any[];

    /** Canonical state name, e.g. "Delta". */
  @Column({ type: 'varchar', nullable: true })
  departureState: string | null;

  /** LGA ("district"), normalised, e.g. "ika south". */
  @Index('IDX_trips_departureLga')
  @Column({ type: 'varchar', nullable: true })
  departureLga: string | null;

  /** City / town, normalised, e.g. "agbor". */
  @Index('IDX_trips_departureCity')
  @Column({ type: 'varchar', nullable: true })
  departureCity: string | null;

  @Column({ type: 'jsonb', nullable: true })
  busstopLatlong: any[];

    @Column({ type: 'varchar', nullable: true })
  bookingStatus: string | null;

    @OneToMany(() => Booking, (bookTrip) => bookTrip.trip)
  passengers: Booking[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', nullable: true })
state: string | null;

}
