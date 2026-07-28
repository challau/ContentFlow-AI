import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PLATFORMS, SOURCE_KINDS } from '@contentflow/shared';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'ContentFlow launch campaign' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'AI note taking app for clinicians' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  topic!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: SOURCE_KINDS, default: 'TOPIC' })
  @IsOptional()
  @IsIn(SOURCE_KINDS)
  sourceKind?: (typeof SOURCE_KINDS)[number];

  @ApiPropertyOptional({ example: 'https://github.com/acme/repo' })
  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  audience?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tone?: string;

  @ApiPropertyOptional({ default: 'English' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  language?: string;

  @ApiPropertyOptional({ enum: PLATFORMS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(PLATFORMS, { each: true })
  targetPlatforms?: Array<(typeof PLATFORMS)[number]>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandKitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
