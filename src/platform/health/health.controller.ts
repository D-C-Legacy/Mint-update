import { Controller, Get, HttpCode } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get('ready')
  @HttpCode(200)
  ready(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
