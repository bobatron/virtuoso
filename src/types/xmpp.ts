/**
 * XMPP type definitions for Virtuoso
 */

import type { Client as XMPPClient } from '@xmpp/client';
import type { Element } from 'ltx';

export interface XMPPAccount {
  xmpp: XMPPClient;
  onStanza: ((stanza: string) => void) | null;
  onStatus: ((status: string) => void) | null;
  listeners: {
    errorListener: (err: Error) => void;
    statusListener: (status: string) => void;
    onlineListener: (address: any) => void;
    offlineListener: () => void;
    stanzaListener: (stanza: Element) => void;
  };
}

export interface XMPPAccounts {
  [accountId: string]: XMPPAccount;
}

export interface XMPPConfig {
  service: string;
  domain: string;
  resource: string;
  username: string;
  password: string;
  tls?: {
    rejectUnauthorized: boolean;
  };
}
