import { useAtomValue, useSetAtom } from 'jotai';
import { FC } from 'react';
import { FormattedMessage } from 'react-intl';
import { Button } from '@boluo/ui/Button';
import { chatAtom } from '../../state/chat.atoms';
import { devMode } from '../../state/dev.atoms';

interface Props {}

export const ConnectionIndicatorConnected: FC<Props> = ({}) => {
  const isDevMode = useAtomValue(devMode);
  const dispatch = useSetAtom(chatAtom);
  const disconnect = () => {
    dispatch({ type: 'debugCloseConnection', payload: { countdown: 5 } });
  };
  return (
    <div>
      <div className="font-bold">
        <FormattedMessage defaultMessage="Connected" />
      </div>
      {isDevMode && (
        <div className="mt-2">
          <Button data-small onClick={disconnect}>
            <FormattedMessage defaultMessage="Disconnect" />
          </Button>
        </div>
      )}
    </div>
  );
};
