/**
 * Preload script for Electron
 * Provides a secure bridge between the main process and renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../types/ipc';

const electronAPI: ElectronAPI = {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  off: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('electron', electronAPI);
