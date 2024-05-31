import { patch } from '@boluo/api-browser';
import { type Settings } from '@boluo/common';
import { toSettings } from '@boluo/common/settings';
import { type FC, useCallback } from 'react';
import type { MutationFetcher } from 'swr/mutation';
import useSWRMutation from 'swr/mutation';
import { Button } from '@boluo/ui/Button';
import { identity } from '@boluo/utils';
import { useSettings } from '../../hooks/useSettings';

interface Props {}

export const ExpandDiceSwitch: FC<Props> = () => {
  const key = ['/users/settings'] as const;
  const updater: MutationFetcher<Settings, typeof key, boolean> = useCallback(async (url, { arg: expandDice }) => {
    const settings: Settings = { expandDice };
    const settingsResult = await patch('/users/update_settings', null, settings);
    return settingsResult.map(toSettings).unwrapOr({});
  }, []);
  const { trigger, isMutating } = useSWRMutation(key, updater, {
    populateCache: identity,
    revalidate: false,
  });
  const settings = useSettings();
  const expandDice = settings?.expandDice ?? false;
  const toggle = () => trigger(!expandDice);
  return (
    <Button disabled={isMutating} data-type="switch" data-on={expandDice} onClick={toggle}>
      Enable
    </Button>
  );
};
