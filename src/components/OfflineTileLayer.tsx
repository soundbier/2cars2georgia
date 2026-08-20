/**
 * Kartenebene, die gespeicherte Kacheln vor dem Netz bevorzugt.
 *
 * Ersetzt `TileLayer` aus react-leaflet an genau einer Stelle: Statt die
 * Kachel direkt vom Kachelserver zu laden, wird zuerst im Offline-Speicher
 * nachgesehen (siehe lib/offlineTiles). Alles andere – Quelle, Attribution,
 * Zoomgrenzen, Overlay-Reihenfolge – bleibt wie gehabt, die Ebene ist ein
 * direkter Ersatz mit denselben Eigenschaften.
 *
 * Ohne Netz und ohne gespeicherte Kachel wird bewusst gar nicht erst geladen:
 * Das vermeidet eine Wand aus Netzwerkfehlern in der Konsole und zeigt
 * stattdessen ein erkennbar leeres Feld – „hier ist nichts heruntergeladen“
 * statt „die Karte ist kaputt“.
 */

import { createElementObject, createTileLayerComponent, updateGridLayer, withPane } from '@react-leaflet/core';
import L from 'leaflet';
import type { TileLayerProps } from 'react-leaflet';
import { readCachedTile, subscribeOfflineAreas, TILE_SUBDOMAIN } from '../lib/offlineTiles';

/** 1×1 transparent – Platzhalter statt kaputtem Bildsymbol. */
const EMPTY_TILE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Kachel-Element mit der Blob-URL, die nach dem Ausblenden freigegeben wird. */
interface OfflineTileElement extends HTMLImageElement {
  _offlineObjectUrl?: string;
}

class OfflineCapableTileLayer extends L.TileLayer {
  private _offlineUnsubscribe?: () => void;
  private _redrawOnNetworkChange = () => this.redraw();

  override onAdd(map: L.Map): this {
    super.onAdd(map);
    // Nach einem Download sollen die eben geladenen Felder sofort erscheinen,
    // und beim Verbindungswechsel wird neu entschieden, ob überhaupt ans Netz
    // gegangen wird.
    this._offlineUnsubscribe = subscribeOfflineAreas(this._redrawOnNetworkChange);
    window.addEventListener('online', this._redrawOnNetworkChange);
    window.addEventListener('offline', this._redrawOnNetworkChange);
    this.on('tileunload', releaseTile);
    return this;
  }

  override onRemove(map: L.Map): this {
    this._offlineUnsubscribe?.();
    this._offlineUnsubscribe = undefined;
    window.removeEventListener('online', this._redrawOnNetworkChange);
    window.removeEventListener('offline', this._redrawOnNetworkChange);
    this.off('tileunload', releaseTile);
    return super.onRemove(map);
  }

  override createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img') as OfflineTileElement;
    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    // Leaflet erwartet den Rückruf genau einmal – auch wenn nichts geladen
    // wird, sonst bleibt die Kachel dauerhaft im Ladezustand hängen.
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      done(undefined, tile);
    };

    tile.addEventListener('load', finish);
    tile.addEventListener('error', () => {
      markMissing(tile);
      finish();
    });

    const url = this.getTileUrl(coords);
    void showTile(tile, url, finish);

    return tile;
  }
}

async function showTile(tile: OfflineTileElement, url: string, finish: () => void): Promise<void> {
  let cached: Response | undefined;
  try {
    cached = await readCachedTile(url);
  } catch {
    cached = undefined;
  }

  if (cached) {
    try {
      const blob = await cached.blob();
      const objectUrl = URL.createObjectURL(blob);
      tile._offlineObjectUrl = objectUrl;
      tile.src = objectUrl;
      return;
    } catch {
      // Beschädigter Eintrag: wie eine fehlende Kachel behandeln.
    }
  }

  if (!navigator.onLine) {
    markMissing(tile);
    tile.src = EMPTY_TILE;
    finish();
    return;
  }

  tile.src = url;
}

function markMissing(tile: HTMLImageElement): void {
  tile.classList.add('offline-tile-missing');
}

function releaseTile(event: L.TileEvent): void {
  const tile = event.tile as OfflineTileElement;
  if (!tile._offlineObjectUrl) return;
  URL.revokeObjectURL(tile._offlineObjectUrl);
  tile._offlineObjectUrl = undefined;
}

/**
 * Gleiche Eigenschaften wie `TileLayer`; die Subdomain steht fest, damit die
 * angeforderte URL exakt der gespeicherten entspricht.
 */
export const OfflineTileLayer = createTileLayerComponent<OfflineCapableTileLayer, TileLayerProps>(
  function createOfflineTileLayer({ url, ...options }, context) {
    const layer = new OfflineCapableTileLayer(
      url,
      withPane({ subdomains: TILE_SUBDOMAIN, ...options }, context)
    );
    return createElementObject(layer, context);
  },
  function updateOfflineTileLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps);
    if (props.url != null && props.url !== prevProps.url) layer.setUrl(props.url);
  }
);
