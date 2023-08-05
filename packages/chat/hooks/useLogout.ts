import { get } from 'api-browser';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';

async function deleteAllIndexedDbDatabases() {
  // https://gist.github.com/rmehner/b9a41d9f659c9b1c3340
  const dbs = await window.indexedDB.databases();
  dbs.forEach(db => {
    if (db.name) {
      window.indexedDB.deleteDatabase(db.name);
    }
  });
}

export function useLogout(): () => void {
  const { mutate } = useSWRConfig();
  return useCallback(async () => {
    await Promise.all([
      get('/users/logout', null),
      deleteAllIndexedDbDatabases(),
    ]);
    localStorage.clear();
    sessionStorage.clear();
    await mutate(['/users/get_me'], null);
  }, [mutate]);
}
