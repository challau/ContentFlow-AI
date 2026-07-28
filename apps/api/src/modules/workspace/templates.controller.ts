import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AgentKind } from '@contentflow/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { buildGraph } from '../../orchestrator/dag';
import { BUILT_IN_TEMPLATES, type BuiltInTemplate } from './templates';

class UseTemplateDto {
  @ApiProperty({ example: 'AI note taking app for clinicians' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  topic!: string;

  @ApiPropertyOptional({ example: 'Q3 launch' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  projectName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  audience?: string;
}

@ApiTags('templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List built-in and organization templates' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('category') category?: string,
  ) {
    const custom = await this.prisma.template.findMany({
      where: {
        organizationId: user.organizationId,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const builtIn = BUILT_IN_TEMPLATES.filter(
      (t) => !category || t.category === category,
    ).map(toDto);

    return { builtIn, custom };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get one template' })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    const builtIn = BUILT_IN_TEMPLATES.find((t) => t.slug === slug);
    if (builtIn) return toDto(builtIn);

    const custom = await this.prisma.template.findFirst({
      where: { slug, organizationId: user.organizationId },
    });
    if (!custom) throw new NotFoundException('Template not found');
    return custom;
  }

  @Post(':slug/use')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({
    summary: 'Create a project and pipeline from a template, ready to run',
  })
  async use(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body() dto: UseTemplateDto,
  ) {
    const template = BUILT_IN_TEMPLATES.find((t) => t.slug === slug);
    if (!template) throw new NotFoundException(`Unknown template: ${slug}`);

    const brandKit = await this.prisma.brandKit.findFirst({
      where: { organizationId: user.organizationId, isDefault: true },
      select: { id: true },
    });

    const project = await this.prisma.project.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.id,
        brandKitId: brandKit?.id,
        name: dto.projectName ?? `${template.name}: ${dto.topic}`.slice(0, 160),
        description: template.description,
        topic: dto.topic,
        audience: dto.audience ?? template.defaultInput.audience,
        goal: template.defaultInput.goal,
        tone: template.defaultInput.tone,
        targetPlatforms: template.platforms,
      },
    });

    const pipeline = await this.prisma.pipeline.create({
      data: {
        projectId: project.id,
        createdById: user.id,
        name: `${template.name} Pipeline`,
        description: template.description,
        graph: graphJsonFor(template.agents),
      },
    });

    return { project, pipeline, template: toDto(template) };
  }
}

function toDto(template: BuiltInTemplate) {
  return {
    slug: template.slug,
    name: template.name,
    description: template.description,
    category: template.category,
    icon: template.icon,
    isBuiltIn: true,
    agents: template.agents,
    platforms: template.platforms,
    defaultInput: template.defaultInput,
  };
}

function graphJsonFor(agents: AgentKind[]): Prisma.InputJsonValue {
  const adjacency = buildGraph(agents);
  return {
    nodes: agents.map((kind, i) => ({
      id: kind,
      agentKind: kind,
      position: { x: (i % 4) * 260, y: Math.floor(i / 4) * 180 },
    })),
    edges: Object.entries(adjacency).flatMap(([target, sources]) =>
      (sources ?? []).map((source) => ({ id: `${source}->${target}`, source, target })),
    ),
  } as unknown as Prisma.InputJsonValue;
}
