import { useState } from 'react';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useRoadtrip, tripPath } from './useRoadtrip';
import { writeErrorKey, writeOptimistically } from '../lib/writeOutcome';
import { useT, TranslationKey } from '../i18n';
import { useToast } from '../components/ui';

/**
 * Weiches Löschen mit Rückgängig-Toast, geteilt zwischen Logbuch, Karte und
 * Reisekasse: Bestätigungsdialog einholen, `deletedAt` setzen (siehe
 * lib/trash.ts) und über die Toast-Aktion wieder entfernbar machen.
 */
export function useSoftDelete(collectionName: string, trashedKey: TranslationKey, restoredKey: TranslationKey) {
  const { tripId } = useRoadtrip();
  const { notify } = useToast();
  const t = useT();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const restore = (id: string) => {
    if (!tripId) return;
    writeOptimistically(
      updateDoc(doc(db, tripPath(tripId, collectionName), id), { deletedAt: deleteField() }),
      (err) => notify(t(writeErrorKey(err, 'common.restoreFailed')), 'danger')
    );
    notify(t(restoredKey), 'success');
  };

  const confirmDelete = () => {
    if (!deleteTargetId || !tripId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    writeOptimistically(
      updateDoc(doc(db, tripPath(tripId, collectionName), id), { deletedAt: Date.now() }),
      (err) => notify(t(writeErrorKey(err, 'common.deleteError')), 'danger')
    );
    notify(t(trashedKey), 'success', { label: t('common.undo'), onAct: () => restore(id) });
  };

  return {
    deleteTargetId,
    requestDelete: setDeleteTargetId,
    cancelDelete: () => setDeleteTargetId(null),
    confirmDelete
  };
}
