import { ApiError } from 'api';
import { useErrorExplain } from 'common';
import { AlertCircle } from 'icons';
import { useCallback } from 'react';
import { useSetBanner } from './useBanner';

export const useErrorAlert = () => {
  const explain = useErrorExplain();
  const setBanner = useSetBanner();
  return useCallback((e: ApiError) => {
    const content = (
      <div className="flex items-center gap-2">
        <AlertCircle className="text-error-500" />
        {explain(e)}
      </div>
    );
    setBanner({ level: 'ERROR', content });
    return e;
  }, [explain, setBanner]);
};
