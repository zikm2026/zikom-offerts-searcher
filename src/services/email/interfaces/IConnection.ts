import { EventEmitter } from 'events';

export interface IConnection extends EventEmitter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getIsConnected(): boolean;
}

