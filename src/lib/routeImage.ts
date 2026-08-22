import { GpsPoint, LogEvent, QuickLogConfig } from '../types';
import {
  iconShapesForEvent,
  IconShape,
  ICON_STROKE_WIDTH,
  ICON_VIEWBOX
} from './quickLogIconShapes';
import { getUserColor } from './userColors';

/**
 * Zeichnet eine Tagesübersicht der Route als Bild – für Instagram & Co.
 *
 * Bewusst ohne echte Kartenkacheln: Die Dienste in lib/mapLayers.ts senden
 * keinen `Access-Control-Allow-Origin`-Header, ein per drawImage() ins Canvas
 * geladenes Kachelbild würde das Canvas also "tainten" – toBlob()/toDataURL()
 * würfen danach eine SecurityError-Exception statt eines Bilds. Ein
 * zusätzlicher Static-Maps-Dienst bräuchte zudem einen API-Schlüssel.
 * Stattdessen bekommt jeder Hintergrundstil (siehe BackgroundStyle) eine
 * eigene, selbst gezeichnete Optik, die an Satelliten-/Straßenkarten
 * *erinnert*, ohne echte Kacheln zu laden.
 */

// 4:5 – das Seitenverhältnis, das Instagram im Feed am größten darstellt.
const WIDTH = 1080;
const HEIGHT = 1350;
const PADDING = 96;
const ROUTE_TOP = 320;
const ROUTE_BOTTOM = HEIGHT - 300;

/**
 * Hintergrundstil des Tagesbilds.
 * - `reduced`: dunkel & minimal, der bisherige Stil (Standard).
 * - `standard`: hell, an eine Straßenkarte angelehnt (Grid + Straßenlinien).
 * - `satellite`: erdig-grün, an ein Satellitenbild angelehnt.
 */
export type BackgroundStyle = 'reduced' | 'standard' | 'satellite';

interface Palette {
  routeStart: string;
  routeEnd: string;
  routeShadow: string;
  heading: string;
  subheading: string;
  cardBg: string;
  statValue: string;
  statLabel: string;
  brandText: string;
  brandBg: string;
  emptyText: string;
  /**
   * Kontur hinter den Ereignis-Icons. Liegt nah am Hintergrund: Sie soll das
   * Symbol vom Untergrund und von der Routenlinie trennen, nicht selbst
   * auffallen.
   */
  markerHalo: string;
}

const PALETTES: Record<BackgroundStyle, Palette> = {
  reduced: {
    routeStart: '#38bdf8',
    routeEnd: '#818cf8',
    routeShadow: 'rgba(0, 0, 0, 0.35)',
    heading: '#ffffff',
    subheading: '#93a5c2',
    cardBg: 'rgba(255, 255, 255, 0.06)',
    statValue: '#ffffff',
    statLabel: '#93a5c2',
    brandText: '#ffffff',
    brandBg: 'rgba(255, 255, 255, 0.12)',
    emptyText: '#5b6b7a',
    markerHalo: 'rgba(11, 18, 32, 0.9)'
  },
  standard: {
    routeStart: '#2563eb',
    routeEnd: '#0ea5e9',
    routeShadow: 'rgba(15, 23, 42, 0.18)',
    heading: '#0f172a',
    subheading: '#475569',
    cardBg: 'rgba(15, 23, 42, 0.06)',
    statValue: '#0f172a',
    statLabel: '#475569',
    brandText: '#ffffff',
    brandBg: 'rgba(15, 23, 42, 0.85)',
    emptyText: '#94a3b8',
    markerHalo: 'rgba(238, 242, 246, 0.95)'
  },
  satellite: {
    routeStart: '#facc15',
    routeEnd: '#fb923c',
    routeShadow: 'rgba(0, 0, 0, 0.45)',
    heading: '#ffffff',
    subheading: '#d9e4d3',
    cardBg: 'rgba(0, 0, 0, 0.28)',
    statValue: '#ffffff',
    statLabel: '#d9e4d3',
    brandText: '#0f172a',
    brandBg: 'rgba(255, 255, 255, 0.85)',
    emptyText: '#c9d6c2',
    markerHalo: 'rgba(0, 0, 0, 0.6)'
  }
};

export interface RouteImageOptions {
  tripName: string;
  dateLabel: string;
  distanceLabel: string;
  durationLabel: string;
  track: GpsPoint[];
  events: LogEvent[];
  /**
   * Schnell-Log-Kategorien des Roadtrips – sie ordnen jedem Ereignis sein
   * Icon zu (siehe lib/quickLogIconShapes.ts).
   */
  quickLogs: QuickLogConfig[];
  backgroundStyle: BackgroundStyle;
}

/** Kantenlänge eines Ereignis-Icons im Bild. */
const EVENT_ICON_SIZE = 38;

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
 *
 * `bounds` legt den Ausschnitt fest, `project` rechnet darin. Beides ist
 * getrennt, weil Route und Ereignisse denselben Ausschnitt brauchen: Würde
 * jede Liste ihren eigenen bekommen, säßen die Ereignis-Icons irgendwo neben
 * der Strecke, an der sie protokolliert wurden.
 */
function createProjector(bounds: { lat: number; lng: number }[]): (p: { lat: number; lng: number }) => Projected {
  const lats = bounds.map((p) => p.lat);
  const lngs = bounds.map((p) => p.lng);
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

  return (p) => ({
    x: offsetX + (p.lng - minLng) * Math.cos(midLatRad) * scale,
    y: offsetY + (maxLat - p.lat) * scale
  });
}

/**
 * Zeichnet ein Schnell-Log-Icon mittig auf (x, y).
 *
 * Zwei Durchgänge: erst breit im Kontraston, dann in der Autorenfarbe darüber.
 * Das ergibt die Kontur, die ein Strichsymbol braucht, um auf einer
 * Satellitenfläche oder quer über der Routenlinie noch lesbar zu sein – ohne
 * eine Scheibe darunter, die das Symbol selbst kleiner machen würde.
 */
function drawIconShapes(
  ctx: CanvasRenderingContext2D,
  shapes: IconShape[],
  x: number,
  y: number,
  size: number,
  color: string,
  halo: string
): void {
  const scale = size / ICON_VIEWBOX;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-ICON_VIEWBOX / 2, -ICON_VIEWBOX / 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const pass of [
    { paint: halo, width: ICON_STROKE_WIDTH + 2.5, grow: 1.25 },
    { paint: color, width: ICON_STROKE_WIDTH, grow: 0 }
  ]) {
    ctx.strokeStyle = pass.paint;
    ctx.fillStyle = pass.paint;
    ctx.lineWidth = pass.width;
    for (const shape of shapes) traceShape(ctx, shape, pass.grow);
  }

  ctx.restore();
}

/** Eine einzelne Form eines Icons, im lucide-Raster gezeichnet. */
function traceShape(ctx: CanvasRenderingContext2D, shape: IconShape, grow: number): void {
  if (shape.kind === 'path') {
    ctx.stroke(new Path2D(shape.d));
    return;
  }

  ctx.beginPath();
  if (shape.kind === 'circle') {
    // Gefüllte Punkte (z.B. das Loch im Preisschild) wachsen im Kontur-
    // Durchgang mit, statt eine Linie um sich herum zu bekommen.
    ctx.arc(shape.cx, shape.cy, shape.r + (shape.filled ? grow : 0), 0, Math.PI * 2);
    if (shape.filled) {
      ctx.fill();
      return;
    }
  } else if (shape.kind === 'line') {
    ctx.moveTo(shape.x1, shape.y1);
    ctx.lineTo(shape.x2, shape.y2);
  } else {
    shape.points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  }
  ctx.stroke();
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

/** Zeichnet den Canvas-Hintergrund passend zum gewählten Stil. */
function paintBackground(ctx: CanvasRenderingContext2D, style: BackgroundStyle): void {
  if (style === 'standard') {
    // Helles Straßenkarten-Gefühl: cremefarbener Grund plus ein grobes Grid,
    // das an Blockraster erinnert – ganz ohne echte Kartenkacheln zu laden.
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#eef2f6');
    bg.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)';
    ctx.lineWidth = 2;
    const step = 72;
    for (let x = 0; x <= WIDTH; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= HEIGHT; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }
  } else if (style === 'satellite') {
    // Erdig-grüner Verlauf mit unregelmäßigen, weichen Flecken – erinnert an
    // Vegetation/Gelände aus der Vogelperspektive, ohne echtes Satellitenbild.
    const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, '#2f3e24');
    bg.addColorStop(0.5, '#3f4f2c');
    bg.addColorStop(1, '#4a3826');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Deterministischer "Rauschteppich" statt Math.random(): gleiche Route
    // ergibt immer dasselbe Bild, praktisch beim Vergleichen von Exporten.
    let seed = 42;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 42; i++) {
      const x = next() * WIDTH;
      const y = next() * HEIGHT;
      const r = 60 + next() * 140;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + next() * 0.07})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.6, next() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // reduced: dunkler, minimaler Verlauf – der bisherige Standardstil.
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#0b1220');
    bg.addColorStop(1, '#152238');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

/** Zeichnet die Tagesübersicht auf ein bereits im DOM vorhandenes Canvas. */
export function drawRouteImage(canvas: HTMLCanvasElement, options: RouteImageOptions): void {
  const { tripName, dateLabel, distanceLabel, durationLabel, track, events, quickLogs, backgroundStyle } =
    options;
  const palette = PALETTES[backgroundStyle];
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  paintBackground(ctx, backgroundStyle);

  // Markenbadge oben rechts: das ist das Bild, das später ohne App-Kontext
  // auf Instagram/TikTok kursiert – der Kanalname muss auf den ersten Blick
  // sitzen, nicht nur klein im Footer stehen.
  ctx.font = '700 28px system-ui, -apple-system, "Segoe UI", sans-serif';
  const brandLabel = '2cars2georgia';
  const brandPaddingX = 24;
  const brandW = ctx.measureText(brandLabel).width + brandPaddingX * 2;
  const brandH = 56;
  const brandX = WIDTH - PADDING - brandW;
  const brandY = 64;
  ctx.fillStyle = palette.brandBg;
  roundedRect(ctx, brandX, brandY, brandW, brandH, brandH / 2);
  ctx.fill();
  ctx.fillStyle = palette.brandText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(brandLabel, brandX + brandPaddingX, brandY + brandH / 2 + 1);
  ctx.textBaseline = 'alphabetic';

  // Kopf: Reisename + Datum.
  ctx.fillStyle = palette.heading;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 40px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(tripName, PADDING, 108);
  ctx.fillStyle = palette.subheading;
  ctx.font = '400 30px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(dateLabel, PADDING, 152);

  const hasRoute = track.length > 1;

  if (hasRoute || events.length) {
    // Ein gemeinsamer Ausschnitt für Strecke und Ereignisse: Nur so sitzt das
    // Icon eines Logs dort, wo es aufgenommen wurde.
    const project = createProjector([...track, ...events]);

    if (hasRoute) {
      const projectedTrack = track.map(project);

      // Sanfter Schatten unter der Route, wie bei den Karten-Overlays selbst.
      ctx.save();
      ctx.strokeStyle = palette.routeShadow;
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
      routeGradient.addColorStop(0, palette.routeStart);
      routeGradient.addColorStop(1, palette.routeEnd);

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
      ctx.fillStyle = palette.routeStart;
      ctx.beginPath();
      ctx.arc(start.x, start.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = palette.emptyText;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = palette.routeEnd;
      ctx.beginPath();
      ctx.arc(end.x, end.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = palette.heading;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Ereignisse mit dem Icon ihrer Kategorie, in der Farbe ihres Autors – die
    // gleiche Zuordnung wie in Cockpit und Logbuch (lib/quickLogIconShapes.ts,
    // lib/userColors.ts). Kein Titel dazu: Auf einem Bild, das ohne App-Kontext
    // kursiert, sind Ortsnamen und Notizen der Crew nichts für Fremde.
    for (const evt of events) {
      const p = project(evt);
      drawIconShapes(
        ctx,
        iconShapesForEvent(evt.type, quickLogs),
        p.x,
        p.y,
        EVENT_ICON_SIZE,
        getUserColor(evt.author),
        palette.markerHalo
      );
    }
  } else {
    ctx.fillStyle = palette.emptyText;
    ctx.font = '400 28px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('—', WIDTH / 2, (ROUTE_TOP + ROUTE_BOTTOM) / 2);
    ctx.textAlign = 'left';
  }

  // Kennzahlen-Karte am unteren Rand.
  const cardY = HEIGHT - 220;
  const cardH = 150;
  ctx.fillStyle = palette.cardBg;
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
    ctx.fillStyle = palette.statValue;
    ctx.font = '600 46px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(value, cx, cardY + 66);
    ctx.fillStyle = palette.statLabel;
    ctx.font = '400 24px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(label, cx, cardY + 106);
  });
  ctx.textAlign = 'left';

  // Footer-Handle: derselbe Kanalname wie im Badge oben, als zweite,
  // dezentere Nennung – falls das Bild beschnitten oder das Badge überdeckt
  // wird, bleibt die Zuordnung trotzdem erhalten.
  ctx.fillStyle = palette.subheading;
  ctx.font = '600 24px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('@2cars2georgia', WIDTH / 2, HEIGHT - 36);
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
