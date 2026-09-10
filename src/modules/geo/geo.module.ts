import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { State } from '@modules/core/entities/state.entity';
import { Lga } from '@modules/core/entities/lga.entity';
import { GeoService } from './service/geo.service';
import { GeoController } from './controller/geo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([State, Lga])],
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}