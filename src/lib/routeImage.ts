import { GpsPoint, LogEvent } from '../types';
import { getUserColor } from './userColors';

/**
 * Zeichnet eine Tagesübersicht der Route als Bild – für Instagram & Co.
 *
 * Bewusst ohne Kartenkacheln: Die Dienste in lib/mapLayers.ts erlauben weder
 * Server-seitiges Rendern noch das Einbetten in einen Canvas (CORS), und ein
 * zusätzlicher Static-Maps-Dienst bräuchte einen API-Schlüssel. Stattdessen
 * entsteht eine abstrahierte, eigenständige Grafik: die Route selbst plus
 * Punkte für die Logbuch-Ereignisse des Tages, umrahmt von Kennzahlen. Das ist
 * näher an dem, was Lauf- und Rad-Apps für ihre Share-Bilder ohnehin zeigen.
 */

// 4:5 – das Seitenverhältnis, das Instagram im Feed am größten darstellt.
const WIDTH = 1080;
const HEIGHT = 1350;
const PADDING = 96;
const ROUTE_TOP = 320;
const ROUTE_BOTTOM = HEIGHT - 300;

export interface RouteImageOptions {
  tripName: string;
  dateLabel: string;
  distanceLabel: string;
  durationLabel: string;
  track: GpsPoint[];
  events: LogEvent[];
}

interface Projected {
  x: number;
  y: number;
}

/**
 * Projiziert Koordinaten linear auf den verfügbaren Zeichenbereich.
 *
 * Für die kurzen Distanzen eines Reisetags ist die Verzerrung einer
 * unechten Projektion nicht sichtbar – eine Mercator-Rechnung wäre hier
 * spürbar mehr Code für keinen erkennbaren Unterschied im Ergebnis.
 */
function project(points: { lat: number; lng: number }[]): Projected[] {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const availableW = WIDTH - PADDING * 2;
  const availableH = ROUTE_BOTTOM - ROUTE_TOP;

  // Streckenkorrektur: Breitengrade stauchen Längengrade zunehmend Richtung Pol.
  const midLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lngSpan = Math.max(maxLng - minLng, 1e-9) * Math.cos(midLatRad);
  const latSpan = Math.max(maxLat - minLat, 1e-9);

  const scale = Math.min(availableW / lngSpan, availableH / latSpan);
  const drawW = lngSpan * scale;
  const drawH = latSpan * scale;
  const offsetX = PADDING + (availableW - drawW) / 2;
  const offsetY = ROUTE_TOP + (availableH - drawH) / 2;

  return points.map((p) => ({
    x: offsetX + (p.lng - minLng) * Math.cos(midLatRad) * scale,
    y: offsetY + (maxLat - p.lat) * scale
  }));
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Zeichnet die Tagesübersicht auf ein bereits im DOM vorhandenes Canvas. */
export function drawRouteImage(canvas: HTMLCanvasElement, options: RouteImageOptions): void {
  const { tripName, dateLabel, distanceLabel, durationLabel, track, events } = options;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Hintergrund: dunkler Verlauf, damit helle Route und weißer Text auf jedem
  // Gerät und in jedem Feed lesbar bleiben, unabhängig vom hellen/dunklen
  // Farbschema der App selbst.
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#0b1220');
  bg.addColorStop(1, '#152238');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Kopf: Reisename + Datum.
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 40px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(tripName, PADDING, 108);
  ctx.fillStyle = '#93a5c2';
  ctx.font = '400 30px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(dateLabel, PADDING, 152);

  if (track.length > 1) {
    const projectedTrack = project(track);

    // Sanfter Schatten unter der Route, wie bei den Karten-Overlays selbst.
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    projectedTrack.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y + 4) : ctx.lineTo(p.x, p.y + 4)));
    ctx.stroke();
    ctx.restore();

    const routeGradient = ctx.createLinearGradient(
      projectedTrack[0].x,
      projectedTrack[0].y,
      projectedTrack[projectedTrack.length - 1].x,
      projectedTrack[projectedTrack.length - 1].y
    );
    routeGradient.addColorStop(0, '#38bdf8');
    routeGradient.addColorStop(1, '#818cf8');

    ctx.strokeStyle = routeGradient;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    projectedTrack.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    // Start (hohler Ring) und Ziel (voller Punkt) heben Anfang und Ende hervor.
    const start = projectedTrack[0];
    const end = projectedTrack[projectedTrack.length - 1];
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(start.x, start.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b1220';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#818cf8';
    ctx.beginPath();
    ctx.arc(end.x, end.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Ereignisse als kleine Punkte in der Farbe ihres Autors – die gleiche
    // Zuordnung wie auf der Karte selbst, siehe lib/userColors.ts.
    if (events.length) {
      const projectedEvents = project(events);
      events.forEach((evt, i) => {
        const p = projectedEvents[i];
        ctx.fillStyle = getUserColor(evt.author);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0b1220';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
  } else {
    ctx.fillStyle = '#5b6b7a';
    ctx.font = '400 28px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('—', WIDTH / 2, (ROUTE_TOP + ROUTE_BOTTOM) / 2);
    ctx.textAlign = 'left';
  }

  // Kennzahlen-Karte am unteren Rand.
  const cardY = HEIGHT - 220;
  const cardH = 150;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  roundedRect(ctx, PADDING, cardY, WIDTH - PADDING * 2, cardH, 24);
  ctx.fill();

  const stats: [string, string][] = [
    [distanceLabel, 'Strecke'],
    [durationLabel, 'Dauer'],
    [String(events.length), 'Ereignisse']
  ];
  const colW = (WIDTH - PADDING * 2) / stats.length;
  stats.forEach(([value, label], i) => {
    const cx = PADDING + colW * i + colW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 46px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(value, cx, cardY + 66);
    ctx.fillStyle = '#93a5c2';
    ctx.font = '400 24px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(label, cx, cardY + 106);
  });
  ctx.textAlign = 'left';

  ctx.fillStyle = '#5b6b7a';
  ctx.font = '400 22px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('2cars2georgia', WIDTH / 2, HEIGHT - 36);
  ctx.textAlign = 'left';
}

export function canvasToPngFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Bild konnte nicht erzeugt werden'));
        return;
      }
      resolve(new File([blob], fileName, { type: 'image/png' }));
    }, 'image/png');
  });
}
