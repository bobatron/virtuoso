/**
 * Type declarations for @xmpp/client package
 */

declare module '@xmpp/client' {
  export interface Client {
    on(event: string, handler: (...args: any[]) => void): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(stanza: any): void;
    removeListener(event: string, handler: (...args: any[]) => void): void;
    removeAllListeners(event?: string): void;
    status: string;
  }

  export function client(config: any): Client;
  
  export function xml(name: string, attrs?: Record<string, any>, ...children: any[]): any;
  
  export function jid(str: string): any;
}
