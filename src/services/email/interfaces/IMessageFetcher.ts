import { EmailMessage } from '../../../types/email';

export interface IMessageFetcher {
  fetchNewMessages(): Promise<EmailMessage[]>;
  setLastCheckedUid(uid: number): void;
  getLastCheckedUid(): number;
}

