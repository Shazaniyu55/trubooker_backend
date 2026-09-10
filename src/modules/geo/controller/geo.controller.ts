import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '@shared/decorators/isPublic.decorator';
import { SkipKillSwitch } from '@modules/kill-switch/kill-switch.guard';
import { ServiceName } from '@shared/decorators/servicename.decorators';
import { GeoService } from '../service/geo.service';
import { ListLgasQueryDto, ListStatesQueryDto } from '../dto/geo-query.dto';

@ApiTags('Geo - States & LGAs')
@ServiceName('geo')
@Controller('v1/geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Public()
  @SkipKillSwitch()
  @Get('states')
  @ApiOperation({ summary: 'List states (public). Optional search, zone filter, and LGA inclusion.' })
  @ApiQuery({ name: 'q', required: false, description: 'Partial state-name search' })
  @ApiQuery({ name: 'zone', required: false, description: 'Geopolitical zone, e.g. "South West"' })
  @ApiQuery({ name: 'withLgas', required: false, type: Boolean, description: 'Include each state\'s LGAs' })
  listStates(@Query() query: ListStatesQueryDto) {
    return this.geoService.listStates(query);
  }

  @Public()
  @SkipKillSwitch()
  @Get('states/:idOrSlug')
  @ApiOperation({ summary: 'Get one state with its LGAs, by UUID or slug (public)' })
  getState(@Param('idOrSlug') idOrSlug: string) {
    return this.geoService.getStateWithLgas(idOrSlug);
  }

  @Public()
  @SkipKillSwitch()
  @Get('states/:idOrSlug/lgas')
  @ApiOperation({ summary: 'List the LGAs of a state, by UUID or slug (public)' })
  listStateLgas(@Param('idOrSlug') idOrSlug: string) {
    return this.geoService.listLgasForState(idOrSlug);
  }

  @Public()
  @SkipKillSwitch()
  @Get('lgas')
  @ApiOperation({ summary: 'Search/list LGAs (public). Optional state filter and name search.' })
  @ApiQuery({ name: 'stateId', required: false, description: 'Restrict to one state (UUID)' })
  @ApiQuery({ name: 'q', required: false, description: 'Partial LGA-name search (max 50 results)' })
  listLgas(@Query() query: ListLgasQueryDto) {
    return this.geoService.listLgas(query);
  }
}