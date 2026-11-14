import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { URL } from 'url';
import { and, eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db, isDatabaseConfigured } from '../db/index.ts';
import { leagueMembers } from '../db/schema.ts';

interface ClientMeta {
  ws: WebSocket;
  uid: string;
  leagueId: number | null;
}

class LeagueWebSocketHub {
  private wss: WebSocketServer | null = null;
  private clients = new Set<ClientMeta>();
  private leagueRooms = new Map<number, Set<ClientMeta>>();
  private tickerTimer: ReturnType<typeof setInterval> | null = null;
  private onTickCallback: (() => Promise<void>) | null = null;

  init(server: HttpServer, onTick?: () => Promise<void>) {
    if (this.wss) return;
    this.onTickCallback = onTick ?? null;

    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', async (request, socket, head) => {
      try {
        const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
        if (reqUrl.pathname !== '/ws') {
          return;
        }

        const token = reqUrl.searchParams.get('token');
        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        const decoded = await adminAuth.verifyIdToken(token);
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.handleConnection(ws, decoded.uid);
        });
      } catch (err) {
        console.error('WebSocket upgrade auth error:', err);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });

    if (this.onTickCallback && isDatabaseConfigured) {
      let ticking = false;
      let backoffUntil = 0;
      this.tickerTimer = setInterval(async () => {
        if (ticking || Date.now() < backoffUntil) return;
        ticking = true;
        try {
          await this.onTickCallback!();
        } catch (err) {
          backoffUntil = Date.now() + 15000;
          console.error('Auction ticker error:', err);
        } finally {
          ticking = false;
        }
      }, 1000);
    }
  }

  private handleConnection(ws: WebSocket, uid: string) {
    const meta: ClientMeta = { ws, uid, leagueId: null };
    this.clients.add(meta);

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe_league' && typeof msg.leagueId === 'number') {
          await this.joinLeagueRoom(meta, msg.leagueId);
        } else if (msg.type === 'unsubscribe_league') {
          this.leaveCurrentRoom(meta);
        } else if (msg.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }));
          }
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    });

    ws.on('close', () => {
      this.leaveCurrentRoom(meta);
      this.clients.delete(meta);
    });

    ws.on('error', () => {
      this.leaveCurrentRoom(meta);
      this.clients.delete(meta);
    });

    ws.send(JSON.stringify({ type: 'connected', uid, serverTime: Date.now() }));
  }

  private async joinLeagueRoom(meta: ClientMeta, leagueId: number) {
    try {
      const membership = await db
        .select()
        .from(leagueMembers)
        .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userUid, meta.uid)))
        .limit(1);

      if (!membership.length) {
        if (meta.ws.readyState === WebSocket.OPEN) {
          meta.ws.send(JSON.stringify({ type: 'error', message: 'Not a member of this league.' }));
        }
        return;
      }

      this.leaveCurrentRoom(meta);
      meta.leagueId = leagueId;
      if (!this.leagueRooms.has(leagueId)) {
        this.leagueRooms.set(leagueId, new Set());
      }
      this.leagueRooms.get(leagueId)!.add(meta);

      this.broadcastPresence(leagueId);
    } catch (err) {
      console.error('Failed to join league room:', err);
    }
  }

  private leaveCurrentRoom(meta: ClientMeta) {
    if (meta.leagueId === null) return;
    const prevId = meta.leagueId;
    const room = this.leagueRooms.get(prevId);
    if (room) {
      room.delete(meta);
      if (room.size === 0) {
        this.leagueRooms.delete(prevId);
      }
    }
    meta.leagueId = null;
    this.broadcastPresence(prevId);
  }

  getOnlineUids(leagueId: number): string[] {
    const room = this.leagueRooms.get(leagueId);
    if (!room) return [];
    const uids = new Set<string>();
    for (const client of room) {
      if (client.ws.readyState === WebSocket.OPEN) {
        uids.add(client.uid);
      }
    }
    return Array.from(uids);
  }

  getOnlineUserUids(): string[] {
    const uids = new Set<string>();
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        uids.add(client.uid);
      }
    }
    return Array.from(uids);
  }

  sendToUser(uid: string, type: string, payload: unknown) {
    const serialized = JSON.stringify({
      type,
      payload,
      serverTime: Date.now(),
    });
    for (const client of this.clients) {
      if (client.uid === uid && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(serialized);
      }
    }
  }

  broadcastPresence(leagueId: number) {
    this.broadcastToLeague(leagueId, 'presence:update', {
      leagueId,
      onlineUids: this.getOnlineUids(leagueId),
    });
  }

  broadcastToLeague(leagueId: number, type: string, payload: unknown) {
    const room = this.leagueRooms.get(leagueId);
    if (!room) return;
    const serialized = JSON.stringify({
      type,
      payload,
      serverTime: Date.now(),
    });
    for (const client of room) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(serialized);
      }
    }
  }

  shutdown() {
    if (this.tickerTimer) {
      clearInterval(this.tickerTimer);
      this.tickerTimer = null;
    }
    this.wss?.close();
  }
}

export const wsHub = new LeagueWebSocketHub();
