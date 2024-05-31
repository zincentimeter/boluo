import type { EventId, ServerEvent } from '@boluo/api';
import type { Reducer } from 'react';
import { eventIdCompare } from '../sort';
import type { ChannelState } from './channel.reducer';
import { channelReducer, makeInitialChannelState } from './channel.reducer';
import { type ChatAction, type ChatActionUnion, eventToChatAction } from './chat.actions';
import type { ConnectionState } from './connection.reducer';
import { connectionReducer, initialConnectionState } from './connection.reducer';
import { recordError } from '../error';

export interface ChatReducerContext {
  spaceId: string;
  initialized: boolean;
}

export interface ChatSpaceState {
  connection: ConnectionState;
  channels: Record<string, ChannelState>;
  context: ChatReducerContext;
  lastEventId: EventId;
  /**
   * A timestamp is used to trigger the responsive system to check
   * if an event has occurred that is worth notifying the user about.
   */
  notifyTimestamp: number;
}

export const zeroEventId: EventId = { timestamp: 0, seq: 0, node: 0 };

export const initialChatState: ChatSpaceState = {
  connection: {
    type: 'CLOSED',
    retry: 0,
    countdown: 0,
  },
  channels: {},
  context: {
    spaceId: '',
    initialized: false,
  },
  lastEventId: zeroEventId,
  notifyTimestamp: 0,
};

const channelsReducer = (
  channels: ChatSpaceState['channels'],
  action: ChatActionUnion,
  context: ChatReducerContext,
): ChatSpaceState['channels'] => {
  if ('channelId' in action.payload) {
    const { channelId } = action.payload;
    const channelState = channelReducer(channels[channelId] ?? makeInitialChannelState(channelId), action, context);
    return { ...channels, [channelId]: channelState };
  } else {
    const nextChannels: ChatSpaceState['channels'] = {};
    for (const channelState of Object.values(channels)) {
      nextChannels[channelState.id] = channelReducer(channelState, action, context);
    }
    return nextChannels;
  }
};

const handleSpaceUpdated = (
  state: ChatSpaceState,
  { payload: spaceWithRelated }: ChatAction<'spaceUpdated'>,
): ChatSpaceState => {
  const spaceId = spaceWithRelated.space.id;
  if (state.context.spaceId !== spaceId) {
    state = { ...initialChatState, context: { initialized: false, spaceId } };
  }
  const channels = { ...state.channels };
  for (const channel of spaceWithRelated.channels) {
    if (channel.id in state.channels) {
      continue;
    }
    const newChannelState = makeInitialChannelState(channel.id);
    channels[channel.id] = newChannelState;
  }
  return { ...state, channels };
};

export const makeChatState = (spaceId: string): ChatSpaceState => ({
  channels: {},
  connection: initialConnectionState,
  context: {
    spaceId,
    initialized: false,
  },
  lastEventId: zeroEventId,
  notifyTimestamp: 0,
});

const handleChannelDeleted = (
  state: ChatSpaceState,
  { payload: { channelId } }: ChatAction<'channelDeleted'>,
): ChatSpaceState => {
  const { channels } = state;
  const nextChannels = { ...channels };
  delete nextChannels[channelId];
  return { ...state, channels: nextChannels };
};

const handleEventFromServer = (
  state: ChatSpaceState,
  { payload: event }: ChatAction<'eventFromServer'>,
): ChatSpaceState => {
  if (eventIdCompare(event.id, state.lastEventId) <= 0) {
    return state;
  }
  const lastEventId = event.id;
  if (event.body.type === 'BATCH') {
    const { encodedEvents } = event.body;
    const events: Array<ServerEvent | null> = encodedEvents.map((encodedEvent) => {
      try {
        return JSON.parse(encodedEvent) as ServerEvent;
      } catch {
        recordError('Failed to parse event', { event: encodedEvent });
        return null;
      }
    });
    let nextState = state;
    for (const event of events) {
      if (event === null) {
        continue;
      }
      const chatAction = eventToChatAction(event);
      if (chatAction === null) {
        continue;
      }
      nextState = chatReducer(nextState, chatAction);
    }
    return { ...nextState, lastEventId };
  }
  const chatAction = eventToChatAction(event);
  if (chatAction === null) {
    return { ...state, lastEventId };
  }
  return { ...chatReducer(state, chatAction), lastEventId };
};
export const chatReducer: Reducer<ChatSpaceState, ChatActionUnion> = (
  state: ChatSpaceState,
  action: ChatActionUnion,
): ChatSpaceState => {
  if (action.type === 'eventFromServer') {
    return handleEventFromServer(state, action);
  }
  if (action.type === 'spaceUpdated') {
    return handleSpaceUpdated(state, action);
  } else if (action.type === 'enterSpace') {
    if (state.context.spaceId === action.payload.spaceId) {
      return state;
    }
    return makeChatState(action.payload.spaceId);
  } else if (action.type === 'channelDeleted') {
    return handleChannelDeleted(state, action);
  }
  const { context } = state;
  if (action.type === 'initialized') {
    return { ...state, context: { ...context, initialized: true } };
  }

  const { channels, connection, ...rest } = state;
  let { notifyTimestamp } = state;
  if (action.type === 'receiveMessage') {
    const created = Date.parse(action.payload.message.created);
    if (!Number.isNaN(created)) {
      notifyTimestamp = Math.max(notifyTimestamp, created);
    }
  }

  return {
    connection: connectionReducer(connection, action, context),
    channels: channelsReducer(channels, action, context),
    ...rest,
    notifyTimestamp,
  };
};
