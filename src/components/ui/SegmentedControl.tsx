import './SegmentedControl.css';

interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Beschriftung der Gruppe für Screenreader. */
  label: string;
}

/**
 * Auswahl zwischen wenigen, kurzen Alternativen (z. B. Einheiten).
 * Bei mehr als drei Optionen ist ein Select die bessere Wahl.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={`segmented-option ${option.value === value ? 'segmented-option-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
