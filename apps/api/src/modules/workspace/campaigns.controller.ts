import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import type { CampaignStatus, ScheduleStatus } from '@prisma/client';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;

class CreateCampaignDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty({ example: 'Launch week' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

class UpdateCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ enum: CAMPAIGN_STATUSES })
  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: CampaignStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List campaigns' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('projectId') projectId?: string) {
    return this.prisma.campaign.findMany({
      where: {
        project: { organizationId: user.organizationId },
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { assets: true, schedules: true } } },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign with its scheduled assets' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, project: { organizationId: user.organizationId } },
      include: {
        assets: { select: { id: true, slug: true, title: true, platform: true, status: true } },
        schedules: {
          orderBy: { scheduledFor: 'asc' },
          include: { asset: { select: { id: true, title: true, platform: true } } },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Create a campaign' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCampaignDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.campaign.create({
      data: {
        projectId: dto.projectId,
        createdById: user.id,
        name: dto.name,
        description: dto.description,
        goal: dto.goal,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Update a campaign' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    await this.assertExists(user.organizationId, id);
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  @Get(':id/calendar')
  @ApiOperation({ summary: 'Scheduled posts for a campaign, ordered by time' })
  async calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertExists(user.organizationId, id);
    return this.prisma.schedule.findMany({
      where: { campaignId: id },
      orderBy: { scheduledFor: 'asc' },
      include: {
        asset: { select: { id: true, slug: true, title: true, platform: true, body: true } },
      },
    });
  }

  private async assertExists(organizationId: string, id: string): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, project: { organizationId } },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
  }
}

@ApiTags('schedules')
@ApiBearerAuth()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Upcoming scheduled posts across the organization' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: ScheduleStatus,
    @Query('projectId') projectId?: string,
  ) {
    return this.prisma.schedule.findMany({
      where: {
        asset: {
          project: {
            organizationId: user.organizationId,
            ...(projectId ? { id: projectId } : {}),
          },
        },
        ...(status ? { status } : {}),
      },
      orderBy: { scheduledFor: 'asc' },
      take: 200,
      include: {
        asset: { select: { id: true, slug: true, title: true, platform: true } },
      },
    });
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Reschedule or cancel a scheduled post' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { scheduledFor?: string; status?: ScheduleStatus },
  ) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id, asset: { project: { organizationId: user.organizationId } } },
      select: { id: true },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');

    return this.prisma.schedule.update({
      where: { id },
      data: {
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
        status: dto.status,
      },
    });
  }
}
