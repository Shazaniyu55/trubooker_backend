// system-setting.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { SystemSettingService } from '../service/system.service';
import { PriceControlDto, ReferralProgramDto } from 'src/types/enums';
import { ServiceName } from '@shared/decorators/servicename.decorators';
import { RolesGuard } from '@shared/guards/roles.guard';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { AdminOnly } from '@shared/decorators/roles.decorator';
import { PreferredTimeSlotDto, SetPreferredTimeSlotsDto } from '../dto/timeslot.dto';
import { SetDispatchWindowDto } from '../dto/dispatch-window.dto';
import { SetPerKmRateDto } from '../dto/per-km-rate.dto';

@ServiceName('system settings')
@ApiTags('System Settings')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('v1/admin/settings')
export class SystemSettingController {
  constructor(private readonly settingService: SystemSettingService) {}

  @AdminOnly()
  @Get('get-all')
  @ApiOperation({ summary: 'Get all system settings' })
  getAllSettings() {
    return this.settingService.getAllSettings();
  }

  @AdminOnly()
  @Patch('price-control')
  @ApiOperation({ summary: 'Update price control settings' })
  setPriceControl(@Body() dto: PriceControlDto) {
    return this.settingService.setPriceControl(dto);
  }

  @AdminOnly()
  @Get('price-control')
  @ApiOperation({ summary: 'Get price control settings' })
  getPriceControl() {
    return this.settingService.getPriceControl();
  }

  @AdminOnly()
  @Patch('referral-program')
  @ApiOperation({ summary: 'Update referral program settings' })
  
  setReferralProgram(@Body() dto: ReferralProgramDto) {
    return this.settingService.setReferralProgram(dto);
  }

  @AdminOnly()
  @Get('referral-program')
  @ApiOperation({ summary: 'Get referral program settings' })
  getReferralProgram() {
    return this.settingService.getReferralProgram();
  }

  @AdminOnly()
  @Post('price-per-km')
  @ApiOperation({
    summary: '[LEGACY] Set a single flat price per km',
    description:
      'Kept for back-compat only. FareService now prices inter-state and ' +
      'intra-state trips independently — use PATCH /per-km-rate instead.',
  })
  @ApiBody({ schema: { type: 'object', properties: { pricePerKm: { type: 'number' } } } })
  setPricePerKm(@Body('pricePerKm') pricePerKm: number) {
    return this.settingService.setPricePerKm(pricePerKm);
  }

  @AdminOnly()
  @Patch('per-km-rate')
  @ApiOperation({
    summary: 'Set per-km rate (inter-state / intra-state)',
    description:
      'Inter-state and intra-state trips are priced independently — set one ' +
      'or both. Either field alone updates just that trip type.',
  })
  setPerKmRate(@Body() dto: SetPerKmRateDto) {
    return this.settingService.setPerKmRate(dto);
  }

  @AdminOnly()
  @Get('per-km-rate')
  @ApiOperation({ summary: 'Get per-km rate (inter-state / intra-state)' })
  getPerKmRate() {
    return this.settingService.getPerKmRate();
  }

  @AdminOnly()
  @Patch('dispatch-window')
  @ApiOperation({
    summary: 'Set driver-board dispatch window hours (intra-state / inter-state)',
    description:
      'How many hours before departure a matched pool of requests is pushed to the ' +
      'driver board. Either field alone updates just that one trip type.',
  })
  setDispatchWindow(@Body() dto: SetDispatchWindowDto) {
    return this.settingService.setDispatchWindow(dto);
  }

  @AdminOnly()
  @Get('dispatch-window')
  @ApiOperation({ summary: 'Get driver-board dispatch window hours (intra-state / inter-state)' })
  getDispatchWindow() {
    return this.settingService.getDispatchWindow();
  }


@Get('settings/preferred-time-slots')
getSlots() {
  return this.settingService.getPreferredTimeSlots();
}

@Put('settings/preferred-time-slots')
replaceSlots(@Body() dto: SetPreferredTimeSlotsDto) {
  return this.settingService.setPreferredTimeSlots(dto);
}

@Post('settings/preferred-time-slots')
addSlot(@Body() dto: PreferredTimeSlotDto) {
  return this.settingService.addPreferredTimeSlot(dto);
}

@Patch('settings/preferred-time-slots/:key')
updateSlot(@Param('key') key: string, @Body() dto: Partial<Omit<PreferredTimeSlotDto, 'key'>>) {
  return this.settingService.updatePreferredTimeSlot(key, dto);
}

@Delete('settings/preferred-time-slots/:key')
removeSlot(@Param('key') key: string) {
  return this.settingService.removePreferredTimeSlot(key);
}

@Patch('settings/preferred-time-slots/reorder')
reorder(@Body('keys') keys: string[]) {
  return this.settingService.reorderPreferredTimeSlots(keys);
}

}


// // system-setting.controller.ts
// import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
// import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
// import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
// import { SystemSettingService } from '../service/system.service';
// import { PriceControlDto, ReferralProgramDto } from 'src/types/enums';
// import { ServiceName } from '@shared/decorators/servicename.decorators';
// import { RolesGuard } from '@shared/guards/roles.guard';
// import { PermissionsGuard } from '@shared/guards/permissions.guard';
// import { AdminOnly } from '@shared/decorators/roles.decorator';
// import { PreferredTimeSlotDto, SetPreferredTimeSlotsDto } from '../dto/timeslot.dto';
// import { SetDispatchWindowDto } from '../dto/dispatch.window';


// @ServiceName('system settings')
// @ApiTags('System Settings')
// @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
// @Controller('v1/admin/settings')
// export class SystemSettingController {
//   constructor(private readonly settingService: SystemSettingService) {}

//   @AdminOnly()
//   @Get('get-all')
//   @ApiOperation({ summary: 'Get all system settings' })
//   getAllSettings() {
//     return this.settingService.getAllSettings();
//   }

//   @AdminOnly()
//   @Patch('price-control')
//   @ApiOperation({ summary: 'Update price control settings' })
//   setPriceControl(@Body() dto: PriceControlDto) {
//     return this.settingService.setPriceControl(dto);
//   }

//   @AdminOnly()
//   @Get('price-control')
//   @ApiOperation({ summary: 'Get price control settings' })
//   getPriceControl() {
//     return this.settingService.getPriceControl();
//   }

//     @AdminOnly()
//   @Patch('dispatch-window')
//   @ApiOperation({
//     summary: 'Set driver-board dispatch window hours (intra-state / inter-state)',
//     description:
//       'How many hours before departure a matched pool of requests is pushed to the ' +
//       'driver board. Either field alone updates just that one trip type.',
//   })
//   setDispatchWindow(@Body() dto: SetDispatchWindowDto) {
//     return this.settingService.setDispatchWindow(dto);
//   }

//   @AdminOnly()
//   @Get('dispatch-window')
//   @ApiOperation({ summary: 'Get driver-board dispatch window hours (intra-state / inter-state)' })
//   getDispatchWindow() {
//     return this.settingService.getDispatchWindow();
//   }

//   @AdminOnly()
//   @Patch('referral-program')
//   @ApiOperation({ summary: 'Update referral program settings' })
  
//   setReferralProgram(@Body() dto: ReferralProgramDto) {
//     return this.settingService.setReferralProgram(dto);
//   }

//   @AdminOnly()
//   @Get('referral-program')
//   @ApiOperation({ summary: 'Get referral program settings' })
//   getReferralProgram() {
//     return this.settingService.getReferralProgram();
//   }

//   @AdminOnly()
//   @Post('price-per-km')
//   @ApiOperation({ summary: 'Set price per km' })
//   @ApiBody({ schema: { type: 'object', properties: { pricePerKm: { type: 'number' } } } })
//   setPricePerKm(@Body('pricePerKm') pricePerKm: number) {
//     return this.settingService.setPricePerKm(pricePerKm);
//   }


// @Get('settings/preferred-time-slots')
// getSlots() {
//   return this.settingService.getPreferredTimeSlots();
// }

// @Put('settings/preferred-time-slots')
// replaceSlots(@Body() dto: SetPreferredTimeSlotsDto) {
//   return this.settingService.setPreferredTimeSlots(dto);
// }

// @Post('settings/preferred-time-slots')
// addSlot(@Body() dto: PreferredTimeSlotDto) {
//   return this.settingService.addPreferredTimeSlot(dto);
// }

// @Patch('settings/preferred-time-slots/:key')
// updateSlot(@Param('key') key: string, @Body() dto: Partial<Omit<PreferredTimeSlotDto, 'key'>>) {
//   return this.settingService.updatePreferredTimeSlot(key, dto);
// }

// @Delete('settings/preferred-time-slots/:key')
// removeSlot(@Param('key') key: string) {
//   return this.settingService.removePreferredTimeSlot(key);
// }

// @Patch('settings/preferred-time-slots/reorder')
// reorder(@Body('keys') keys: string[]) {
//   return this.settingService.reorderPreferredTimeSlots(keys);
// }

// }