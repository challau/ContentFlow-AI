import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/public.decorator';
import { OrchestratorService } from '../../orchestrator/orchestrator.service';
import { PipelineQueue } from '../../orchestrator/queue/pipeline.queue';
import { CreatePipelineDto, StartRunDto, UpdatePipelineDto } from './pipelines.dto';
import { PipelinesService } from './pipelines.service';

@ApiTags('pipelines')
@ApiBearerAuth()
@Controller('pipelines')
export class PipelinesController {
  constructor(
    private readonly pipelines: PipelinesService,
    private readonly orchestrator: OrchestratorService,
    private readonly queue: PipelineQueue,
  ) {}

  @Get('agents')
  @ApiOperation({ summary: 'Agent catalogue for the pipeline builder palette' })
  catalogue() {
    return this.pipelines.catalogue();
  }

  @Get()
  @ApiOperation({ summary: 'List pipelines, optionally filtered by project' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('projectId') projectId?: string) {
    return this.pipelines.findAll(user.organizationId, projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one pipeline including its graph' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.pipelines.findOne(user.organizationId, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Create a pipeline from a builder graph' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePipelineDto) {
    return this.pipelines.create(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Rename a pipeline or replace its graph' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    return this.pipelines.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Delete a pipeline and its runs' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.pipelines.remove(user.organizationId, id);
  }

  @Post(':id/run')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({
    summary: 'Start a pipeline run',
    description:
      'Queues the run and returns immediately. Pass sync=true to execute inline and ' +
      'return only once every agent has finished.',
  })
  async run(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartRunDto,
  ) {
    const { sync, ...override } = dto;

    const { runId, agents } = await this.orchestrator.createRun({
      pipelineId: id,
      userId: user.id,
      organizationId: user.organizationId,
      inputOverride: override,
    });

    if (sync) {
      await this.orchestrator.executeRun(runId);
      return { runId, agents, mode: 'sync' as const };
    }

    const jobId = await this.queue.enqueue({
      runId,
      organizationId: user.organizationId,
      userId: user.id,
    });
    return { runId, agents, jobId, mode: 'queued' as const };
  }
}
