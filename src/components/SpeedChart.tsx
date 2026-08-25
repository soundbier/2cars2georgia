import { useMemo } from 'react';
import { SpeedSample } from '../lib/statistics';
import { UnitSystem, speedUnitLabel, toDisplaySpeed } from '../lib/units';
import { useI18n, useT } from '../i18n';
import './SpeedChart.css';

interface SpeedChartProps {
  samples: SpeedSample[];
  unitSystem: UnitSystem;
  /** Durchschnitt in km/h – als gestrichelte Linie im Verlauf. */
  averageKmh: number;
}

/* Zeichenfläche in Nutzerkoordinaten. Die Grafik wird auf die Breite des
   Containers gezogen (preserveAspectRatio="none"), Linien behalten über
   vector-effect ihre Stärke. Beschriftungen stehen deshalb bewusst außerhalb
   des SVG als normaler Text – im gestreckten Koordinatensystem wären sie
   verzerrt. */
const WIDTH = 1000;
const HEIGHT = 240;

/**
 * Der Geschwindigkeitsverlauf eines Ausschnitts als Linie.
 *
 * Was ein Durchschnitt nicht beantwortet: Ging es gleichmäßig voran oder in
 * Schüben? Die Kurve zeigt das auf einen Blick, die gestrichelte Linie
 * darüber ist der Schnitt zum Vergleich.
 *
 * Eingedampft wird vorher (siehe lib/statistics.ts, `speedSeries`) – hier
 * kommen höchstens ein paar hundert Werte an.
 */
export function SpeedChart({ samples, unitSystem, averageKmh }: SpeedChartProps) {
  const { locale } = useI18n();
  const t = useT();

  const chart = useMemo(() => {
    if (samples.length < 2) return null;

    const first = samples[0].timestamp;
    const last = samples[samples.length - 1].timestamp;
    const span = Math.max(1, last - first);
    const peak = Math.max(...samples.map((s) => s.speedKmh), averageKmh);
    // Kopffreiheit über der Spitze, damit die Kurve nicht am Rand klebt.
    const scale = peak > 0 ? peak * 1.15 : 1;

    const x = (timestamp: number) => ((timestamp - first) / span) * WIDTH;
    const y = (speedKmh: number) => HEIGHT - (speedKmh / scale) * HEIGHT;

    const line = samples
      .map((sample, i) => `${i === 0 ? 'M' : 'L'}${x(sample.timestamp).toFixed(1)} ${y(sample.speedKmh).toFixed(1)}`)
      .join(' ');

    return {
      line,
      area: `${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`,
      averageY: y(averageKmh),
      peak,
      first,
      last
    };
  }, [samples, averageKmh]);

  if (!chart) return null;

  const unit = speedUnitLabel(unitSystem);
  const peakLabel = `${toDisplaySpeed(chart.peak, unitSystem).toFixed(1)} ${unit}`;
  const clock = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="speed-chart">
      <div className="speed-chart-plot">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={t('stats.speedChartAria', {
            peak: peakLabel,
            average: `${toDisplaySpeed(averageKmh, unitSystem).toFixed(1)} ${unit}`
          })}
        >
          <path className="speed-chart-area" d={chart.area} />
          <path className="speed-chart-line" d={chart.line} vectorEffect="non-scaling-stroke" />
          {averageKmh > 0 && (
            <line
              className="speed-chart-average"
              x1={0}
              x2={WIDTH}
              y1={chart.averageY}
              y2={chart.averageY}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <span className="speed-chart-peak label mono-num">{peakLabel}</span>
      </div>
      <div className="speed-chart-axis helper-text mono-num">
        <span>{clock(chart.first)}</span>
        <span>{clock(chart.last)}</span>
      </div>
    </div>
  );
}
