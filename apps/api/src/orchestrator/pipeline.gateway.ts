import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  PIPELINE_NAMESPACE,
  PIPELINE_ROOM,
  type PipelineEvent,
} from '@contentflow/shared';

/**
 * Broadcasts live run progress. Clients join a per-run room so a dashboard
 * watching one pipeline never receives another tenant's traffic.
 */
@WebSocketGateway({
  namespace: PIPELINE_NAMESPACE,
  cors: { origin: true, credentials: true },
})
export class PipelineGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PipelineGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`client disconnected: ${client.id}`);
  }

  @SubscribeMessage('run:subscribe')
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { runId?: string },
  ): { ok: boolean; room?: string; error?: string } {
    if (!payload?.runId) return { ok: false, error: 'runId is required' };
    const room = PIPELINE_ROOM(payload.runId);
    void client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('run:unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { runId?: string },
  ): { ok: boolean } {
    if (payload?.runId) void client.leave(PIPELINE_ROOM(payload.runId));
    return { ok: true };
  }

  emit(runId: string, event: PipelineEvent): void {
    // The gateway is optional in worker/CLI contexts, so guard the server ref.
    this.server?.to(PIPELINE_ROOM(runId)).emit(event.type, event);
  }
}
