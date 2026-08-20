/**
 * Downloadmodus für Offline-Karten.
 *
 * Drei Teile, die zusammengehören und deshalb in einer Datei stehen:
 * `useOfflineDownload` hält den Zustand, `OfflineGrid` zeichnet die
 * auswählbaren Rasterfelder in die Karte, `OfflineDownloadPanel` ist die
 * Bedienleiste darunter. Die Karte selbst weiß davon nur, dass sie die drei
 * Teile einhängt – ihre bestehende Logik bleibt unberührt.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Rectangle, Tooltip } from 'react-leaflet';
import { Download, Trash2, X } from 'lucide-react';
import { Button } from './ui';
import { useI18n, useT } from '../i18n';
import { Coordinates } from '../types';
import {
  buildRouteGrid,
  estimateTileCountPerCell,
  GridCell,
  MAX_DOWNLOAD_ZOOM,
  MIN_DOWNLOAD_ZOOM
} from '../lib/tileGrid';
import {
  clearOfflineTiles,
  downloadCells,
  DownloadProgress,
  estimateBytes,
  OfflineLayer,
  offlineTilesSupported,
  readOfflineAreas,
  subscribeOfflineAreas
} from '../lib/offlineTiles';
import './OfflineMapDownload.css';

const GRID_STYLE = {
  available: { color: '#0f172a', weight: 1, opacity: 0.5, fillColor: '#0f172a', fillOpacity: 0.05 },
  selected: { color: '#bc4f27', weight: 2, opacity: 0.95, fillColor: '#bc4f27', fillOpacity: 0.3 },
  downloaded: { color: '#2a7f87', weight: 2, opacity: 0.9, fillColor: '#2a7f87', fillOpacity: 0.22 }
} as const;

export interface OfflineDownloadState {
  supported: boolean;
  active: boolean;
  open: () => void;
  close: () => void;
  cells: GridCell[];
  selected: Set<string>;
  downloaded: Set<string>;
  toggleCell: (key: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  start: () => Promise<void>;
  cancel: () => void;
  removeAll: () => Promise<void>;
  busy: boolean;
  progress: DownloadProgress | null;
  /** Kacheln, die die aktuelle Auswahl über alle aktiven Ebenen umfasst. */
  selectedTiles: number;
  storedAreas: number;
}

/**
 * Zustand des Downloadmodus.
 *
 * Das Raster wird erst beim Öffnen berechnet und danach festgehalten: Der
 * Track wächst während der Fahrt weiter, und ein Raster, das sich unter der
 * gerade getroffenen Auswahl neu sortiert, wäre unbrauchbar.
 */
export function useOfflineDownload(
  route: Coordinates[],
  layers: OfflineLayer[],
  onFinished?: (result: { failed: number; aborted: boolean }) => void
): OfflineDownloadState {
  const [active, setActive] = useState(false);
  const [cells, setCells] = useState<GridCell[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Route und Ebenen ändern sich bei jedem Render (neue Arrays aus Firestore
  // bzw. den Einstellungen) – für den Start des Downloads zählt der Stand zum
  // Zeitpunkt des Klicks, nicht der beim Aufbau des Callbacks.
  const routeRef = useRef(route);
  routeRef.current = route;
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const areas = useSyncExternalStore(subscribeOfflineAreas, readOfflineAreas);
  const downloaded = useMemo(() => new Set(Object.keys(areas)), [areas]);

  const open = useCallback(() => {
    setCells(buildRouteGrid(routeRef.current));
    setSelected(new Set());
    setProgress(null);
    setActive(true);
  }, []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setActive(false);
    setProgress(null);
  }, []);

  const toggleCell = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(
    () => setSelected(new Set(cells.map((cell) => cell.key))),
    [cells]
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const start = useCallback(async () => {
    const chosen = cells.filter((cell) => selected.has(cell.key));
    if (chosen.length === 0 || busy) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress({ total: 0, completed: 0, failed: 0 });

    try {
      const result = await downloadCells(chosen, layersRef.current, {
        signal: controller.signal,
        onProgress: setProgress
      });
      onFinished?.({ failed: result.failed, aborted: result.aborted });
      if (!result.aborted) setSelected(new Set());
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [busy, cells, onFinished, selected]);

  const removeAll = useCallback(async () => {
    await clearOfflineTiles();
    setSelected(new Set());
    setProgress(null);
  }, []);

  // Ein laufender Download soll den Tab-Wechsel nicht überleben.
  useEffect(() => () => abortRef.current?.abort(), []);

  const selectedTiles = selected.size * estimateTileCountPerCell() * Math.max(1, layers.length);

  return {
    supported: offlineTilesSupported(),
    active,
    open,
    close,
    cells,
    selected,
    downloaded,
    toggleCell,
    selectAll,
    clearSelection,
    start,
    cancel,
    removeAll,
    busy,
    progress,
    selectedTiles,
    storedAreas: downloaded.size
  };
}

/** Auswählbare Rasterfelder als Rechtecke über der Karte. */
export function OfflineGrid({
  cells,
  selected,
  downloaded,
  onToggle,
  disabled
}: {
  cells: GridCell[];
  selected: Set<string>;
  downloaded: Set<string>;
  onToggle: (key: string) => void;
  disabled: boolean;
}) {
  const t = useT();

  return (
    <>
      {cells.map((cell) => {
        const isSelected = selected.has(cell.key);
        const isDownloaded = downloaded.has(cell.key);
        const style = isSelected
          ? GRID_STYLE.selected
          : isDownloaded
            ? GRID_STYLE.downloaded
            : GRID_STYLE.available;

        return (
          <Rectangle
            key={cell.key}
            bounds={[
              [cell.bounds.south, cell.bounds.west],
              [cell.bounds.north, cell.bounds.east]
            ]}
            pathOptions={{ ...style, interactive: !disabled }}
            eventHandlers={{ click: () => !disabled && onToggle(cell.key) }}
          >
            <Tooltip direction="center">
              {isDownloaded ? t('map.offlineLegendDownloaded') : t('map.offlineTapToSelect')}
            </Tooltip>
          </Rectangle>
        );
      })}
    </>
  );
}

function formatSize(bytes: number, locale: string): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toLocaleString(locale, { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}

/** Bedienleiste des Downloadmodus. */
export function OfflineDownloadPanel({
  state,
  isOnline,
  sourceLabel
}: {
  state: OfflineDownloadState;
  isOnline: boolean;
  /** Woher die Route stammt (geplant oder gefahren) – nur zur Anzeige. */
  sourceLabel?: string;
}) {
  const t = useT();
  const { locale } = useI18n();

  const percent =
    state.progress && state.progress.total > 0
      ? Math.round((state.progress.completed / state.progress.total) * 100)
      : 0;

  return (
    <div className="offline-panel" role="dialog" aria-label={t('map.offlineTitle')}>
      <div className="offline-panel-header">
        <strong>{t('map.offlineTitle')}</strong>
        <button
          type="button"
          className="offline-panel-close"
          onClick={state.close}
          aria-label={t('map.offlineClose')}
        >
          <X size={18} />
        </button>
      </div>

      {!state.supported ? (
        <p className="helper-text">{t('map.offlineUnsupported')}</p>
      ) : state.cells.length === 0 ? (
        <p className="helper-text">{t('map.offlineNoRoute')}</p>
      ) : (
        <>
          <p className="helper-text">
            {t('map.offlineIntro')}{' '}
            {t('map.offlineZoomRange', { min: MIN_DOWNLOAD_ZOOM, max: MAX_DOWNLOAD_ZOOM })}
            {sourceLabel && <> {t('map.offlineSource', { source: sourceLabel })}</>}
          </p>

          <div className="offline-legend">
            <span className="offline-legend-item offline-legend-selected">
              {t('map.offlineLegendSelected')}
            </span>
            <span className="offline-legend-item offline-legend-downloaded">
              {t('map.offlineLegendDownloaded')}
            </span>
          </div>

          <div className="offline-panel-stats">
            <span>{t('map.offlineSelected', { count: state.selected.size })}</span>
            <span className="helper-text">
              {t('map.offlineEstimate', {
                tiles: state.selectedTiles,
                size: formatSize(estimateBytes(state.selectedTiles), locale)
              })}
            </span>
          </div>

          {state.busy && state.progress && (
            <div className="offline-progress">
              <div className="offline-progress-bar">
                <div className="offline-progress-fill" style={{ width: `${percent}%` }} />
              </div>
              <span className="helper-text">
                {t('map.offlineProgress', {
                  done: state.progress.completed,
                  total: state.progress.total
                })}
              </span>
            </div>
          )}

          {!isOnline && !state.busy && <p className="helper-text">{t('map.offlineNeedsNetwork')}</p>}

          <div className="row">
            <Button variant="secondary" fullWidth onClick={state.selectAll} disabled={state.busy}>
              {t('map.offlineSelectAll')}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={state.clearSelection}
              disabled={state.busy || state.selected.size === 0}
            >
              {t('map.offlineClearSelection')}
            </Button>
          </div>

          {state.busy ? (
            <Button variant="secondary" fullWidth onClick={state.cancel}>
              {t('map.offlineCancel')}
            </Button>
          ) : (
            <Button
              fullWidth
              onClick={state.start}
              disabled={state.selected.size === 0 || !isOnline}
            >
              <Download size={16} /> {t('map.offlineStart')}
            </Button>
          )}
        </>
      )}

      <div className="offline-panel-footer">
        <span className="helper-text">
          {state.storedAreas > 0
            ? t('map.offlineStored', { count: state.storedAreas })
            : t('map.offlineNone')}
        </span>
        {state.storedAreas > 0 && (
          <button
            type="button"
            className="offline-panel-delete"
            onClick={state.removeAll}
            disabled={state.busy}
          >
            <Trash2 size={14} /> {t('map.offlineDelete')}
          </button>
        )}
      </div>
    </div>
  );
}
