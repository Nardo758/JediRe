import type { Server } from 'socket.io';

let _io: Server | null = null;

export function setSocketIo(io: Server): void {
  _io = io;
}

export function getSocketIo(): Server | null {
  return _io;
}
