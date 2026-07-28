import { Module } from '@nestjs/common';
import { BrandKitsController } from './brand-kits.controller';
import { CampaignsController, SchedulesController } from './campaigns.controller';
import { DashboardController } from './dashboard.controller';
import { NotificationsController } from './notifications.controller';
import { TemplatesController } from './templates.controller';

@Module({
  controllers: [
    BrandKitsController,
    TemplatesController,
    CampaignsController,
    SchedulesController,
    DashboardController,
    NotificationsController,
  ],
})
export class WorkspaceModule {}
