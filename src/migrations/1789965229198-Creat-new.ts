import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatNew1789965229198 implements MigrationInterface {
    name = 'CreatNew1789965229198'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lgas" DROP CONSTRAINT "FK_lgas_stateId"`);
        await queryRunner.query(`ALTER TABLE "trips" ADD "departureState" character varying`);
        await queryRunner.query(`ALTER TABLE "trips" ADD "departureLga" character varying`);
        await queryRunner.query(`ALTER TABLE "trips" ADD "departureCity" character varying`);
        await queryRunner.query(`ALTER TABLE "trip_requests" ADD "originState" character varying`);
        await queryRunner.query(`ALTER TABLE "trip_requests" ADD "originLga" character varying`);
        await queryRunner.query(`ALTER TABLE "trip_requests" ADD "originCity" character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_trips_departureLga" ON "trips" ("departureLga") `);
        await queryRunner.query(`CREATE INDEX "IDX_trips_departureCity" ON "trips" ("departureCity") `);
        await queryRunner.query(`ALTER TABLE "lgas" ADD CONSTRAINT "FK_74e3629b4446a89c22db6d97fc9" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lgas" DROP CONSTRAINT "FK_74e3629b4446a89c22db6d97fc9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_trips_departureCity"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_trips_departureLga"`);
        await queryRunner.query(`ALTER TABLE "trip_requests" DROP COLUMN "originCity"`);
        await queryRunner.query(`ALTER TABLE "trip_requests" DROP COLUMN "originLga"`);
        await queryRunner.query(`ALTER TABLE "trip_requests" DROP COLUMN "originState"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "departureCity"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "departureLga"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "departureState"`);
        await queryRunner.query(`ALTER TABLE "lgas" ADD CONSTRAINT "FK_lgas_stateId" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
