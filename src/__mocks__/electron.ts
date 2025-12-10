/**
 * Mock for electron module in tests
 */

export const app = {
  whenReady: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  quit: jest.fn(),
};

export const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn(),
  loadFile: jest.fn(),
}));

export const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
};

export const contextBridge = {
  exposeInMainWorld: jest.fn(),
};

export const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  send: jest.fn(),
  removeListener: jest.fn(),
};
