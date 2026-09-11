import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateNotificationUseCase } from '../usecases/create-notification.usecase';
import { SendPushNotificationUseCase } from '../usecases/send-push-notification.usecase';
import { CreateNotificationDto } from '../dtos/create-notification.dto';
import { AuthUser } from '@shared/decorators/authUser.decorator';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { ServiceName } from '@shared/decorators/servicename.decorators';
import { Broker } from '@broker/broker';
import { GetUnReadNotificationUseCase } from '../usecases/getunread.usecase';
import { GetAllNotificationUseCase } from '../usecases/getallnotify.usecase';
import { MarkAllNotificationUseCase } from '../usecases/markallread.usecase';
import { DelteNotificationUseCase } from '../usecases/deletenotify.usecase';
import { MarkOneNotificationUseCase } from '../usecases/markoneread.usecase';
import { DeleteOneNotificationUseCase } from '../usecases/deleteonenotify.usecase';
import { RegisterPushTokenUseCase } from '../usecases/register-push-token.usecase';
import { RegisterPushTokenDto } from '../dtos/register-push-token.dto';

@ServiceName('notification')
@ApiTags('Notifications')
@Controller('v1/notifications')
export class NotificationController {
  constructor(
    private readonly broker: Broker,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
    private readonly sendPushNotificationUseCase: SendPushNotificationUseCase,
    private readonly getUnreadNotificationUsecase: GetUnReadNotificationUseCase,
    private readonly getAllNotificationUsecase: GetAllNotificationUseCase,
    private readonly markAllNotificationUsecase: MarkAllNotificationUseCase,
    private readonly deleteNotificationUsecase: DelteNotificationUseCase,
    private readonly markOneAsReadUsecase:MarkOneNotificationUseCase,
    private readonly deleteOneNotifyUsecase: DeleteOneNotificationUseCase,
    private readonly registerPushTokenUsecase: RegisterPushTokenUseCase
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('create')
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({ status: 201, description: 'Notification created successfully' })
  async create(@AuthUser() user: any, @Body() dto: CreateNotificationDto) {
    return this.broker.runUsecases([this.createNotificationUseCase], { id: user.sub, dto });
  }

  @UseGuards(JwtAuthGuard)
  @Post('push')
  @ApiOperation({ summary: 'Send push notification' })
  @ApiResponse({ status: 200, description: 'Push notification sent successfully' })
  async sendPush(@AuthUser() user: any) {
    return this.broker.runUsecases([this.sendPushNotificationUseCase], {id:user.sub});
  }

  @UseGuards(JwtAuthGuard)
  @Post('push-token')
  @ApiOperation({ summary: 'Register / refresh this device Expo push token' })
  @ApiResponse({ status: 200, description: 'Expo push token registered' })
  async registerPushToken(@AuthUser() user: any, @Body() dto: RegisterPushTokenDto) {
    return this.broker.runUsecases(
      [this.registerPushTokenUsecase],
      { id: user.sub, expoToken: dto.expoToken },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread')                      
  @ApiOperation({ summary: 'Get unread notifications' })
  @ApiResponse({ status: 200, description: 'Unread notifications fetched' })
  async getUnread(@AuthUser() user: any) {
    return this.broker.runUsecases([this.getUnreadNotificationUsecase], {id:user.sub});
  }

  @UseGuards(JwtAuthGuard)
  @Get('all')                       
  @ApiOperation({ summary: 'Get all notifications' })
  @ApiResponse({ status: 200, description: 'All notifications fetched' })
  async getAllNotify(@AuthUser() user: any) {
    return this.broker.runUsecases([this.getAllNotificationUsecase], { id: user.id });
  }

  @UseGuards(JwtAuthGuard)
  @Post('markall')                    
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAll(@AuthUser() user: any) {
    return this.broker.runUsecases([this.markAllNotificationUsecase], {id:user.sub});
  }

  @UseGuards(JwtAuthGuard)
  @Post('mark-as-read/:id')                    
  @ApiOperation({ summary: 'Mark one notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markOne(@AuthUser() user: any, @Param('id') notifyId: string) {
  return this.broker.runUsecases([this.markOneAsReadUsecase], {notifyId: notifyId, id: user.sub});
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-notify')             
  @ApiOperation({ summary: 'Delete notifications' })
  @ApiResponse({ status: 200, description: 'Notifications deleted' })
  async deleteNotify(@AuthUser() user: any) {
    return this.broker.runUsecases([this.deleteNotificationUsecase], {id:user.sub});
  }

  @UseGuards(JwtAuthGuard)
  @Post('clear/:id')                    
  @ApiOperation({ summary: 'delete one notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async deleteOne(@AuthUser() user: any, @Param('id') notifyId: string) {
  return this.broker.runUsecases([this.deleteOneNotifyUsecase], {notifyId: notifyId, id: user.sub});
  }
}
// import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
// import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
// import { CreateNotificationUseCase } from '../usecases/create-notification.usecase';
// import { SendPushNotificationUseCase } from '../usecases/send-push-notification.usecase';
// import { CreateNotificationDto } from '../dtos/create-notification.dto';
// import { AuthUser } from '@shared/decorators/authUser.decorator';
// import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
// import { ServiceName } from '@shared/decorators/servicename.decorators';
// import { Broker } from '@broker/broker';
// import { GetUnReadNotificationUseCase } from '../usecases/getunread.usecase';
// import { GetAllNotificationUseCase } from '../usecases/getallnotify.usecase';
// import { MarkAllNotificationUseCase } from '../usecases/markallread.usecase';
// import { DelteNotificationUseCase } from '../usecases/deletenotify.usecase';

// @ServiceName('notification') // For kill switch targeting
// @ApiTags('Notifications')
// @Controller('v1/notifications')
// export class NotificationController {
//   constructor(
//     private readonly broker: Broker,
//     private readonly createNotificationUseCase: CreateNotificationUseCase,
//     private readonly sendPushNotificationUseCase: SendPushNotificationUseCase,
//     private readonly getUnreadNotificationUsecase:GetUnReadNotificationUseCase,
//     private readonly getAllNotificationUsecase:GetAllNotificationUseCase,
//     private readonly markAllNotificationUsecase:MarkAllNotificationUseCase,
//     private readonly deleteNotificationUsecase:DelteNotificationUseCase
//   ) {}

//   @UseGuards(JwtAuthGuard)
//   @Post('create')
//   @ApiOperation({ summary: 'create a new notification' })
//   @ApiResponse({
//     status: 201,
//     description: 'Notification created successfully',
//   })

//   async create(@AuthUser() user: any, @Body() dto: CreateNotificationDto) {
//     return this.broker.runUsecases([this.createNotificationUseCase], {id: user.sub, dto: dto})
//   }

//   @UseGuards(JwtAuthGuard)
//   @ApiOperation({ summary: 'send push notification' })
//   @ApiResponse({
//     status: 200,
//     description: 'Push notification sent successfully',
//   })

//   @Post('push')
//   async sendPush( @AuthUser() user: any) {
//     return this.broker.runUsecases([this.sendPushNotificationUseCase], user.sub)
    
//   }

//   @UseGuards(JwtAuthGuard)
//   @ApiOperation({ summary: 'get unread notification' })
//   @ApiResponse({
//     status: 200,
//     description: 'get-unread notification',
//   })

//   @Get('unread:id')
//   async getunread( @AuthUser() user: any) {
//     return this.broker.runUsecases([this.getUnreadNotificationUsecase], user.sub)
    
//   }

//   @UseGuards(JwtAuthGuard)
//   @ApiOperation({ summary: 'get all notification' })
//   @ApiResponse({
//     status: 200,
//     description: 'get all notification',
//   })

//   @Get('all:id')
//   async getallnotify( @AuthUser() user: any) {
//     return this.broker.runUsecases([this.getAllNotificationUsecase], user.sub)
    
//   }

//   @UseGuards(JwtAuthGuard)
//   @ApiOperation({ summary: 'mark all notification' })
//   @ApiResponse({
//     status: 200,
//     description: 'mark all notification',
//   })

//   @Post('markall:id')
//   async markall( @AuthUser() user: any) {
//     return this.broker.runUsecases([this.markAllNotificationUsecase], user.sub)
    
//   }

//   @UseGuards(JwtAuthGuard)
//   @ApiOperation({ summary: 'mark all notification' })
//   @ApiResponse({
//     status: 200,
//     description: 'mark all notification',
//   })

//   @Post('delete-notify:id')
//   async deletenotify( @AuthUser() user: any) {
//     return this.broker.runUsecases([this.deleteNotificationUsecase], user.sub)
    
//   }
// }
