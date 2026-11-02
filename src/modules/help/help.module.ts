import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { HELP_REPOSITORY } from './domain/ports/help.repository.port';
import { HelpPrismaRepository } from './infra/repositories/help.prisma.repository';
import { HelpService } from './application/help.service';
import { HelpController } from './api/http/help.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [HelpController],
  providers: [{ provide: HELP_REPOSITORY, useClass: HelpPrismaRepository }, HelpService],
  exports: [HelpService],
})
export class HelpModule {}
