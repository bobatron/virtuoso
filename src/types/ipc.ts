/**
 * IPC (Inter-Process Communication) type definitions for Virtuoso
 */

import type { AccountData } from './account';
import type { Template } from './template';

export interface IpcResponse<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
  off: (channel: string, listener: (...args: any[]) => void) => void;
}

// Main process to renderer IPC channels
export type MainToRendererChannels = 
  | 'stanza-response'
  | 'account-status';

// Renderer to main process IPC channels
export type RendererToMainChannels = 
  | 'subscribe-stanza'
  | 'get-accounts'
  | 'add-account'
  | 'connect-account'
  | 'send-stanza'
  | 'disconnect-account'
  | 'remove-account'
  | 'get-templates'
  | 'save-template'
  | 'delete-template';

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
