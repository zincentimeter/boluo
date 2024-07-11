// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { Channel } from './Channel';
import type { Member } from './Member';
import type { Message } from './Message';
import type { Preview } from './Preview';
import type { SpaceWithRelated } from './SpaceWithRelated';
import type { UserStatus } from './UserStatus';

export type EventBody =
  | { type: 'NEW_MESSAGE'; channelId: string; message: Message; previewId: string | null }
  | { type: 'MESSAGE_DELETED'; messageId: string; channelId: string }
  | { type: 'MESSAGE_EDITED'; channelId: string; message: Message }
  | { type: 'MESSAGE_PREVIEW'; channelId: string; preview: Preview }
  | { type: 'CHANNEL_DELETED'; channelId: string }
  | { type: 'CHANNEL_EDITED'; channelId: string; channel: Channel }
  | { type: 'MEMBERS'; channelId: string; members: Array<Member> }
  | { type: 'BATCH'; encodedEvents: Array<string> }
  | { type: 'INITIALIZED' }
  | { type: 'STATUS_MAP'; statusMap: { [key: string]: UserStatus }; spaceId: string }
  | { type: 'SPACE_UPDATED'; spaceWithRelated: SpaceWithRelated }
  | { type: 'ERROR'; reason: string }
  | { type: 'APP_UPDATED'; version: string };
