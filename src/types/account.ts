/**
 * Account type definitions for Virtuoso
 */

export interface AccountData {
  jid: string;
  password: string;
  host?: string;
  port?: string;
  connectionMethod?: 'auto' | 'direct-tls' | 'plain';
  _source?: 'dev' | 'ui';
}

export interface AccountInfo extends AccountData {
  _source: 'dev' | 'ui';
}

export type AccountStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'online'
  | 'error'
  | 'offline';

export interface AccountRecord {
  [accountId: string]: AccountData;
}
