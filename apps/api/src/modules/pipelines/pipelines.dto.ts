import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AGENT_KINDS, PLATFORMS } from '@contentflow/shared';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class GraphNodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ enum: AGENT_KINDS })
  @IsIn(AGENT_KINDS)
  agentKind!: (typeof AGENT_KINDS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  position?: { x: number; y: number };
}

class GraphEdgeDto {
  @ApiProperty({ enum: AGENT_KINDS })
  @IsIn(AGENT_KINDS)
  source!: (typeof AGENT_KINDS)[number];

  @ApiProperty({ enum: AGENT_KINDS })
  @IsIn(AGENT_KINDS)
  target!: (typeof AGENT_KINDS)[number];
}

export class GraphDto {
  @ApiProperty({ type: [GraphNodeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphNodeDto)
  nodes!: GraphNodeDto[];

  @ApiPropertyOptional({ type: [GraphEdgeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphEdgeDto)
  edges?: GraphEdgeDto[];
}

export class CreatePipelineDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty({ example: 'Launch week pipeline' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ type: GraphDto })
  @ValidateNested()
  @Type(() => GraphDto)
  graph!: GraphDto;
}

export class UpdatePipelineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ type: GraphDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GraphDto)
  graph?: GraphDto;
}

export class StartRunDto {
  @ApiPropertyOptional({ description: 'Overrides the project topic for this run only' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  topic?: string;

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

  @ApiPropertyOptional({ enum: PLATFORMS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(PLATFORMS, { each: true })
  platforms?: Array<(typeof PLATFORMS)[number]>;

  @ApiPropertyOptional({ maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  extraContext?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Run synchronously instead of queueing (useful for tests and CLI)',
  })
  @IsOptional()
  @IsBoolean()
  sync?: boolean;
}
