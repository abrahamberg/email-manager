export interface Address {
  name?: string;
  address: string;
}

/** A parsed message. Only what decisions need: bodies are never stored. */
export interface Email {
  uid: number;
  messageId: string;
  /** Root of the References chain, or the message id when it starts a thread. */
  threadId: string;
  from: Address;
  replyTo?: Address;
  to: Address[];
  cc: Address[];
  subject: string;
  date: string;
  /** Lower-cased header names; repeated headers joined with "\n". */
  headers: Record<string, string>;
  /** Plain text, from the text part or converted from HTML. */
  text: string;
  links: string[];
  hasAttachments: boolean;
}
