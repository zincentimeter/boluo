import { Bell, Plus } from 'icons';
import type { FC } from 'react';
import { useMemo } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Button } from 'ui';
import { useChannelList } from '../../hooks/useChannelList';
import { useChatPaneDispatch } from '../../state/chat-view';
import { makePane, Pane } from '../../types/chat-pane';
import { SidebarChannelItem } from './SidebarChannelItem';
import { SidebarItem } from './SidebarItem';

interface Props {
  spaceId: string;
  panes: Pane[];
}

export const SidebarChannelList: FC<Props> = ({ spaceId, panes }) => {
  const channels = useChannelList(spaceId);
  const channelIdFromPanes = useMemo(
    () => panes.flatMap((pane) => pane.type === 'CHANNEL' ? [pane.channelId] : []),
    [panes],
  );
  const dispatch = useChatPaneDispatch();
  const handleOpenCreateChannelPane = () => {
    dispatch({ type: 'TOGGLE', pane: makePane({ type: 'CREATE_CHANNEL', spaceId }) });
  };
  const handleToggleNotification = () => {
    // To be implemented
  };
  const isCreateChannelPaneOpened = useMemo(() => panes.find(pane => pane.type === 'CREATE_CHANNEL') !== undefined, [
    panes,
  ]);
  const intl = useIntl();
  const toggleNotification = intl.formatMessage({ defaultMessage: 'Toggle Notification' });
  return (
    <div>
      <div className="py-2 px-4 text-surface-600 flex justify-between items-center text-sm">
        <span>
          <FormattedMessage defaultMessage="Channels" />
        </span>
        <div>
          <Button
            onClick={handleToggleNotification}
            type="button"
            data-small
            data-type="switch"
            data-on={false}
            title={toggleNotification}
            aria-label={toggleNotification}
          >
            <Bell />
          </Button>
        </div>
      </div>
      {channels.map((channel) => (
        <SidebarChannelItem
          key={channel.id}
          channel={channel}
          active={channelIdFromPanes.includes(channel.id)}
        />
      ))}
      <SidebarItem icon={<Plus />} toggle active={isCreateChannelPaneOpened} onClick={handleOpenCreateChannelPane}>
        <span className="text-surface-400 group-hover:text-surface-800">
          <FormattedMessage defaultMessage="Add New" />
        </span>
      </SidebarItem>
    </div>
  );
};
