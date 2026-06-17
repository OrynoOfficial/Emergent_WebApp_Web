// Shared bulk-selection state machine + UI.
// One `useBulkSelection` hook + one `<BulkActionsBar />` component used across
// every management page so list-actions (delete/export/activate) behave
// consistently across the platform.

import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Manage selected rows in a list.
 *
 * @param {Array} rows       - the visible rows; objects must have a stable `id`
 *                              (or pass `idKey`).
 * @param {Object} options
 * @param {string} options.idKey  - field that holds the row id (default 'id')
 */
export function useBulkSelection(rows = [], { idKey = 'id' } = {}) {
  const [selected, setSelected] = useState(() => new Set());

  // Drop selections that no longer exist (e.g. after a refetch).
  useEffect(() => {
    const valid = new Set((rows || []).map((r) => r[idKey]));
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((id) => valid.has(id) && next.add(id));
      return next.size === prev.size ? prev : next;
    });
  }, [rows, idKey]);

  const isSelected = useCallback((id) => selected.has(id), [selected]);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === rows.length && rows.length > 0) return new Set();
      return new Set(rows.map((r) => r[idKey]));
    });
  }, [rows, idKey]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const partiallySelected = selected.size > 0 && !allSelected;
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r[idKey])),
    [rows, selected, idKey],
  );

  return {
    selected,
    selectedIds,
    selectedRows,
    isSelected,
    toggle,
    toggleAll,
    clear,
    allSelected,
    partiallySelected,
    count: selected.size,
  };
}
