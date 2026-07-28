import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

class BrandKitDto {
  @ApiProperty({ example: 'Acme Brand' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: '#6366F1' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#8B5CF6' })
  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @ApiPropertyOptional({ example: '#EC4899' })
  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @ApiPropertyOptional({ example: 'Inter' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  headingFont?: string;

  @ApiPropertyOptional({ example: 'Inter' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  bodyFont?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  toneOfVoice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  writingGuidelines?: string;

  @ApiPropertyOptional({ type: [String], description: 'Words agents must never use' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bannedWords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

@ApiTags('brand-kits')
@ApiBearerAuth()
@Controller('brand-kits')
export class BrandKitsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List brand kits' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.brandKit.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a brand kit' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const kit = await this.prisma.brandKit.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { projects: { select: { id: true, name: true } } },
    });
    if (!kit) throw new NotFoundException('Brand kit not found');
    return kit;
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Create a brand kit' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: BrandKitDto) {
    return this.prisma.brandKit.create({
      data: { ...dto, organizationId: user.organizationId },
    });
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Update a brand kit' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<BrandKitDto>,
  ) {
    await this.assertExists(user.organizationId, id);
    return this.prisma.brandKit.update({ where: { id }, data: dto });
  }

  @Post(':id/default')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Make this the organization default brand kit' })
  async makeDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertExists(user.organizationId, id);
    // Exactly one default per organization.
    return this.prisma.$transaction(async (tx) => {
      await tx.brandKit.updateMany({
        where: { organizationId: user.organizationId },
        data: { isDefault: false },
      });
      return tx.brandKit.update({ where: { id }, data: { isDefault: true } });
    });
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Delete a brand kit' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertExists(user.organizationId, id);
    await this.prisma.brandKit.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertExists(organizationId: string, id: string): Promise<void> {
    const kit = await this.prisma.brandKit.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!kit) throw new NotFoundException('Brand kit not found');
  }
}
