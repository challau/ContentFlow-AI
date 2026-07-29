import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
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
import { CreateConversationDto, SendMessageDto, UpdateConversationDto } from './chat.dto';
import { ChatService } from './chat.service';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('conversations')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Start a conversation, optionally grounded in a project' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConversationDto) {
    return this.chat.createConversation({
      organizationId: user.organizationId,
      userId: user.id,
      title: dto.title,
      projectId: dto.projectId,
    });
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations in the organization' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('includeArchived', new ParseBoolPipe({ optional: true })) includeArchived?: boolean,
  ) {
    return this.chat.listConversations({
      organizationId: user.organizationId,
      skip,
      take,
      includeArchived,
    });
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation with its full message history' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.getConversation(user.organizationId, id);
  }

  @Patch('conversations/:id')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Rename or archive a conversation' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.chat.updateConversation(user.organizationId, id, dto);
  }

  @Delete('conversations/:id')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a conversation and its messages' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.chat.deleteConversation(user.organizationId, id);
  }

  @Post('conversations/:id/messages')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Send a message and get the assistant reply' })
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage({
      organizationId: user.organizationId,
      userId: user.id,
      conversationId: id,
      dto,
    });
  }
}
