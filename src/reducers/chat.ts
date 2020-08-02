import { Channel, Member } from '@/api/channels';
import { List, Map } from 'immutable';
import { Message } from '@/api/messages';
import { Preview } from '@/api/events';
import { Action } from '@/actions';
import { ChannelEventReceived, CloseChat, LoadMessages } from '@/actions/chat';
import { DEBUG } from '@/settings';
import { Id, newId } from '@/utils/id';

export interface MessageChatItem {
  id: Id;
  type: 'MESSAGE';
  message: Message;
  date: Date;
}

export interface PreviewChatItem {
  type: 'PREVIEW';
  preview: Preview;
  date: Date;
  id: Id;
}

export interface MyPreviewItem {
  type: 'MY_PREVIEW';
  preview?: Preview;
  date: Date;
  id: Id;
}

export interface EmptyItem {
  type: 'EMPTY';
  date: Date;
  id: Id;
}

export const newPreviewChatItem = (preview: Preview): PreviewChatItem => ({
  type: 'PREVIEW',
  preview,
  date: new Date(preview.start),
  id: preview.senderId,
});

export const newMessageChatItem = (message: Message): MessageChatItem => ({
  type: 'MESSAGE',
  date: new Date(message.orderDate),
  id: message.id,
  message,
});

export const newMyPreviewItem = (myId: Id, preview?: Preview): MyPreviewItem => ({
  type: 'MY_PREVIEW',
  date: preview ? new Date(preview.start) : new Date(),
  id: myId,
  preview,
});

export const newEmptyItem = (date: Date): EmptyItem => ({ type: 'EMPTY', date, id: newId() });

export type ChatItem = MessageChatItem | PreviewChatItem | EmptyItem | MyPreviewItem;

export interface PreviewEntry {
  type: 'PREVIEW';
  date: Date;
  previewId: Id;
}

export interface MessageEntry {
  type: 'MESSAGE';
  date: Date;
}

export type ItemMap = Map<Id, PreviewEntry | MessageEntry>;

export const addMessageToItemMap = (itemMap: ItemMap, message: Message): ItemMap =>
  itemMap.set(message.id, { type: 'MESSAGE', date: new Date(message.orderDate) });

export const addPreviewToItemMap = (itemMap: ItemMap, preview: Preview): ItemMap =>
  itemMap.set(preview.senderId, { type: 'PREVIEW', date: new Date(preview.start), previewId: preview.id });

export const findItem = (itemList: List<ChatItem>, date: Date, id: Id): [number, ChatItem] => {
  let i = 0;
  for (const item of itemList) {
    if (item.id === id) {
      return [i, item];
    } else if (item.date < date) {
      throw new Error('failed to find item');
    }
    i += 1;
  }
  throw new Error('failed to find item');
};

export const queryMessageEntry = (itemMap: ItemMap, messageId: Id): MessageEntry | undefined => {
  const result = itemMap.get(messageId);
  if (result === undefined) {
    return undefined;
  } else if (result.type !== 'MESSAGE') {
    throw new Error('Unexpected entry');
  } else {
    return result;
  }
};

export const queryPreviewEntry = (itemMap: ItemMap, senderId: Id): PreviewEntry | undefined => {
  const result = itemMap.get(senderId);
  if (result === undefined) {
    return undefined;
  } else if (result.type !== 'PREVIEW') {
    throw new Error('Unexpected entry');
  } else {
    return result;
  }
};

export interface ChatState {
  connection: WebSocket;
  channel: Channel;
  members: Member[];
  colorMap: Map<Id, string>;
  itemList: List<ChatItem>;
  heartbeatMap: Map<Id, number>;
  itemMap: ItemMap;
  finished: boolean;
  messageBefore: number;
  eventAfter: number;
  initialized: boolean;
  filter: 'IN_GAME' | 'OUT_GAME' | 'NONE';
  memberList: boolean;
}

export const initChatState = undefined;

const loadChat = (prevState: ChatState | undefined, nextState: ChatState): ChatState => {
  if (!prevState) {
    return nextState;
  }
  if (prevState.colorMap.equals(nextState.colorMap)) {
    nextState.colorMap = prevState.colorMap;
  }
  if (prevState.channel.id === nextState.channel.id) {
    // reload
    const { channel, members, colorMap, connection } = nextState;
    return { ...prevState, channel, members, colorMap, connection };
  }
  return nextState;
};

export const closeChat = (state: ChatState, { id }: CloseChat): ChatState | undefined => {
  return state.channel.id === id ? undefined : state;
};

const loadMessages = (chat: ChatState, { messages, finished }: LoadMessages): ChatState => {
  const len = messages.length;
  if (len === 0) {
    return { ...chat, finished };
  }
  let { itemList, itemMap } = chat;

  for (const message of messages) {
    if (itemMap.has(message.id)) {
      continue;
    }
    itemList = itemList.push(newMessageChatItem(message));
    itemMap = addMessageToItemMap(itemMap, message);
  }

  itemList = itemList
    .filter((item) => item.type !== 'EMPTY')
    .sort((a, b) => {
      if (a.date > b.date) {
        return -1;
      } else if (a.date < b.date) {
        return 1;
      } else {
        return 0;
      }
    });
  const messageBefore = Math.min(messages[len - 1].orderDate, chat.messageBefore);
  const eventAfter = itemList.first(undefined)?.date.getTime() ?? chat.eventAfter;
  return { ...chat, messageBefore, itemList, itemMap, finished, eventAfter };
};

const editMessage = (itemList: List<ChatItem>, itemMap: ItemMap, message: Message): List<ChatItem> => {
  const itemInfo = itemMap.get(message.id);
  if (itemInfo === undefined) {
    return itemList;
  }
  const { type, date } = itemInfo;
  if (type === 'PREVIEW') {
    console.warn('attempt edit a preview item');
    return itemList;
  }
  const [index] = findItem(itemList, date, message.id);
  return itemList.set(index, newMessageChatItem(message));
};

const deleteMessage = (itemList: List<ChatItem>, itemMap: ItemMap, messageId: Id): [List<ChatItem>, ItemMap] => {
  const itemInfo = itemMap.get(messageId);
  if (itemInfo === undefined) {
    return [itemList, itemMap];
  }
  const { type, date } = itemInfo;
  if (type === 'PREVIEW') {
    console.warn('attempt edit a preview item');
    return [itemList, itemMap];
  }
  const [index, item] = findItem(itemList, date, messageId);
  if (item.type !== 'MESSAGE') {
    console.warn('failed to find item');
    return [itemList, itemMap];
  }
  return [itemList.set(index, newEmptyItem(item.date)), itemMap.remove(messageId)];
};

const newPreview = (
  itemList: List<ChatItem>,
  itemMap: ItemMap,
  preview: Preview,
  myId: Id | undefined
): [List<ChatItem>, ItemMap] => {
  const messageInfo = queryMessageEntry(itemMap, preview.id);
  if (messageInfo !== undefined) {
    console.warn('There is already a message with the same id.');
    console.debug(preview, messageInfo);
    return [itemList, itemMap];
  }

  const previousPreviewEntry = queryPreviewEntry(itemMap, preview.senderId);
  const previewItem = preview.senderId === myId ? newMyPreviewItem(myId, preview) : newPreviewChatItem(preview);

  // Users have sent previews.
  if (previousPreviewEntry !== undefined) {
    const { previewId, date } = previousPreviewEntry;
    const [index] = findItem(itemList, date, preview.senderId);
    if (previewId === preview.id) {
      // same id, replace it.
      itemList = itemList.set(index, previewItem);
      return [itemList, itemMap];
    } else {
      // different id, delete it.
      itemList = itemList.set(index, newEmptyItem(date));
    }
  }

  itemMap = addPreviewToItemMap(itemMap, preview);
  const startDate = previewItem.date;

  // insert new item to item list.
  let i = 0;
  for (const item of itemList) {
    if (item.date < startDate) {
      return [i === 0 ? itemList.unshift(previewItem) : itemList.insert(i, previewItem), itemMap];
    }
    i += 1;
  }
  return [itemList.push(previewItem), itemMap];
};

const newMessage = (
  itemList: List<ChatItem>,
  itemMap: ItemMap,
  message: Message,
  messageBefore: number,
  eventAfter: number,
  initialized: boolean,
  finished: boolean
): [List<ChatItem>, ItemMap] => {
  const messageItem = newMessageChatItem(message);
  const messageDate = messageItem.date;
  const previousPreview = queryPreviewEntry(itemMap, message.senderId);

  // new message ordered before oldest message, don't show it.
  if (initialized && !finished && message.orderDate < Math.min(messageBefore, eventAfter)) {
    if (previousPreview === undefined) {
      return [itemList, itemMap];
    }
    // delete preview.
    itemMap = itemMap.remove(message.senderId);
    const [index] = findItem(itemList, previousPreview.date, message.senderId);
    itemList = itemList.set(index, newEmptyItem(previousPreview.date));
    return [itemList, itemMap];
  }

  // Some users have sent preview messages
  if (previousPreview !== undefined) {
    const { previewId, date } = previousPreview;
    const [index] = findItem(itemList, date, message.senderId);
    itemMap = itemMap.remove(message.senderId);

    if (previewId === message.id) {
      // same id, replace it.
      itemList = itemList.set(index, messageItem);
      itemMap = addMessageToItemMap(itemMap, message);
      return [itemList, itemMap];
    } else {
      // different id, delete it.
      itemList = itemList.set(index, newEmptyItem(date));
    }
  }

  const previousMessage = itemMap.get(message.id);
  if (previousMessage !== undefined) {
    console.warn('duplicate message.');
    return [itemList, itemMap];
  }
  itemMap = addMessageToItemMap(itemMap, message);
  let i = 0;
  for (const item of itemList) {
    if (item.date < messageDate) {
      return [i === 0 ? itemList.unshift(messageItem) : itemList.insert(i, messageItem), itemMap];
    }
    i += 1;
  }
  return [itemList.push(messageItem), itemMap];
};

const updateColorMap = (members: Member[], colorMap: Map<Id, string>): Map<Id, string> => {
  for (const member of members) {
    const { textColor, userId } = member.channel;
    if (textColor !== colorMap.get(userId, null)) {
      if (textColor) {
        colorMap = colorMap.set(userId, textColor);
      } else {
        colorMap = colorMap.remove(userId);
      }
    }
  }
  return colorMap;
};

const handleChannelEvent = (chat: ChatState, { event }: ChannelEventReceived, myId: Id | undefined): ChatState => {
  if (event.mailbox !== chat.channel.id) {
    return chat;
  }
  const body = event.body;
  let { itemList, itemMap, channel, colorMap, members, heartbeatMap, eventAfter, initialized } = chat;

  let messageBefore = chat.messageBefore;
  if (DEBUG) {
    console.log('Channel Event: ', body.type, body);
  }
  switch (body.type) {
    case 'NEW_MESSAGE':
      [itemList, itemMap] = newMessage(
        itemList,
        itemMap,
        body.message,
        messageBefore,
        eventAfter,
        initialized,
        chat.finished
      );
      messageBefore = Math.min(body.message.orderDate, messageBefore);
      break;
    case 'MESSAGE_PREVIEW':
      [itemList, itemMap] = newPreview(itemList, itemMap, body.preview, myId);
      break;
    case 'MESSAGE_DELETED':
      [itemList, itemMap] = deleteMessage(itemList, itemMap, body.messageId);
      break;
    case 'MESSAGE_EDITED':
      itemList = editMessage(itemList, itemMap, body.message);
      break;
    case 'CHANNEL_EDITED':
      if (channel.id === body.channel.id) {
        channel = body.channel;
      }
      break;
    case 'INITIALIZED':
      initialized = true;
      break;
    case 'MEMBERS':
      members = body.members;
      colorMap = updateColorMap(members, colorMap);
      break;
    case 'HEARTBEAT_MAP':
      heartbeatMap = Map(body.heartbeatMap);
      break;
  }
  eventAfter = event.timestamp;
  return { ...chat, channel, colorMap, itemList, itemMap, eventAfter, messageBefore, heartbeatMap, initialized };
};

export const chatReducer = (
  state: ChatState | undefined,
  action: Action,
  myId: Id | undefined
): ChatState | undefined => {
  if (action.type === 'CHAT_LOADED') {
    return loadChat(state, action.chat);
  }
  if (state === undefined) {
    return undefined;
  }
  switch (action.type) {
    case 'CLOSE_CHAT':
      return closeChat(state, action);
    case 'LOAD_MESSAGES':
      return loadMessages(state, action);
    case 'CHAT_FILTER':
      return { ...state, filter: action.filter };
    case 'TOGGLE_MEMBER_LIST':
      return { ...state, memberList: !state.memberList };
    case 'CHANNEL_EVENT_RECEIVED':
      return handleChannelEvent(state, action, myId);
  }
  return state;
};
