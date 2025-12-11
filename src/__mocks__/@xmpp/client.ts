/**
 * Mock for @xmpp/client package
 */

// Mock client instance
const mockClientInstance = {
  on: jest.fn(),
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  send: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  status: 'offline',
};

// Mock client factory function
export const client = jest.fn(() => mockClientInstance);

// Mock xml function
export const xml = jest.fn((name: string, attrs?: any, ...children: any[]) => {
  return {
    name,
    attrs: attrs || {},
    children: children || [],
    toString: () => `<${name} />`,
  };
});

// Mock jid function  
export const jid = jest.fn((str: string) => {
  const [local, domain] = str.split('@');
  return {
    local,
    domain,
    resource: '',
    bare: () => str,
    toString: () => str,
  };
});

export default {
  client,
  xml,
  jid,
};
