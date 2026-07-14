import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';

@Injectable()
export class CallSocketService {
  /**
   * Ek user ke multiple sockets ho sakte hain:
   * browser tabs, mobile app aur web app.
   *
   * userId -> Map<socketId, Socket>
   */
  private readonly userSockets = new Map<
    string,
    Map<string, Socket>
  >();

  /**
   * socketId -> userId
   */
  private readonly socketUsers = new Map<string, string>();

  registerUser(userId: string, socket: Socket): void {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      return;
    }

    /*
     * Agar same socket pehle kisi doosre user ke naam se
     * registered tha, to purani mapping remove karenge.
     */
    const previousUserId = this.socketUsers.get(socket.id);

    if (
      previousUserId &&
      previousUserId !== normalizedUserId
    ) {
      this.removeSocketFromUser(
        previousUserId,
        socket.id,
      );
    }

    let sockets = this.userSockets.get(normalizedUserId);

    if (!sockets) {
      sockets = new Map<string, Socket>();
      this.userSockets.set(normalizedUserId, sockets);
    }

    sockets.set(socket.id, socket);
    this.socketUsers.set(socket.id, normalizedUserId);
  }

  unregisterSocket(socketId: string): void {
    const userId = this.socketUsers.get(socketId);

    if (!userId) {
      return;
    }

    this.removeSocketFromUser(userId, socketId);
  }

  getSocket(userId: string): Socket | undefined {
    const sockets = this.getSockets(userId);

    return sockets[0];
  }

  getSockets(userId: string): Socket[] {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      return [];
    }

    const sockets = this.userSockets.get(normalizedUserId);

    if (!sockets) {
      return [];
    }

    /*
     * Disconnected sockets ko automatically cleanup karenge.
     */
    const connectedSockets: Socket[] = [];

    for (const [socketId, socket] of sockets.entries()) {
      if (socket.connected) {
        connectedSockets.push(socket);
      } else {
        sockets.delete(socketId);
        this.socketUsers.delete(socketId);
      }
    }

    if (sockets.size === 0) {
      this.userSockets.delete(normalizedUserId);
    }

    return connectedSockets;
  }

  isOnline(userId: string): boolean {
    return this.getSockets(userId).length > 0;
  }

  emitToUser(
    userId: string,
    event: string,
    payload: unknown,
  ): boolean {
    const sockets = this.getSockets(userId);

    if (sockets.length === 0) {
      return false;
    }

    for (const socket of sockets) {
      socket.emit(event, payload);
    }

    return true;
  }

  emitToSocket(
    socketId: string,
    event: string,
    payload: unknown,
  ): boolean {
    const userId = this.socketUsers.get(socketId);

    if (!userId) {
      return false;
    }

    const socket = this.userSockets
      .get(userId)
      ?.get(socketId);

    if (!socket || !socket.connected) {
      this.unregisterSocket(socketId);
      return false;
    }

    socket.emit(event, payload);

    return true;
  }

  getUserIdBySocket(
    socketId: string,
  ): string | undefined {
    return this.socketUsers.get(socketId);
  }

  getOnlineUsers(): string[] {
    const onlineUsers: string[] = [];

    for (const userId of this.userSockets.keys()) {
      if (this.isOnline(userId)) {
        onlineUsers.push(userId);
      }
    }

    return onlineUsers;
  }

  getOnlineUserCount(): number {
    return this.getOnlineUsers().length;
  }

  getUserSocketCount(userId: string): number {
    return this.getSockets(userId).length;
  }

  private removeSocketFromUser(
    userId: string,
    socketId: string,
  ): void {
    const sockets = this.userSockets.get(userId);

    if (sockets) {
      sockets.delete(socketId);

      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.socketUsers.delete(socketId);
  }
}