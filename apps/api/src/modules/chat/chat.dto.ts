import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export const CHAT_ACTIONS = [
  'CHAT',
  'REWRITE',
  'EXPAND',
  'SHORTEN',
  'CHANGE_TONE',
  'TRANSLATE',
  'IDEAS',
] as const;

export type ChatActionValue = (typeof CHAT_ACTIONS)[number];

export class CreateConversationDto {
  @ApiPropertyOptional({ example: 'Launch week copy' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Grounds the assistant in one project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Make this punchier for LinkedIn.' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;

  @ApiPropertyOptional({ enum: CHAT_ACTIONS, default: 'CHAT' })
  @IsOptional()
  @IsIn(CHAT_ACTIONS)
  action?: ChatActionValue;

  @ApiPropertyOptional({ description: 'Text the action operates on' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  sourceContent?: string;

  @ApiPropertyOptional({ description: 'Target tone, or target language for TRANSLATE' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  target?: string;

  @ApiPropertyOptional({ description: 'Pull an existing asset in as the source content' })
  @IsOptional()
  @IsUUID()
  assetId?: string;
}

export class UpdateConversationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class ListConversationsQuery {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({ default: 30, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @ApiPropertyOptional({ description: 'Include archived conversations' })
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}
