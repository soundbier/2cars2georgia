/**
 * Dateien an das Gerät übergeben. Auf einem Handy ist „Teilen“ der natürliche
 * Weg (AirDrop, Mail, Messenger); nur wenn die Web Share API die Datei nicht
 * annimmt, fällt es auf einen klassischen Download zurück.
 */

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

function triggerDownload(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Erst nach dem Klick freigeben – Safari bricht den Download sonst ab.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function shareOrDownload(
  fileName: string,
  mimeType: string,
  content: string
): Promise<ExportResult> {
  const file = new File([content], fileName, { type: mimeType });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      // Abbruch durch den Nutzer ist kein Fehler und darf nicht still in einem
      // Download enden – alles andere schon.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      console.error('Teilen fehlgeschlagen, weiche auf Download aus:', err);
    }
  }

  triggerDownload(file);
  return 'downloaded';
}

/**
 * Öffnet den Druckdialog für ein fertiges HTML-Dokument. Der Bericht landet in
 * einem versteckten iframe statt in einem neuen Fenster, weil Popup-Blocker
 * auf Mobilgeräten `window.open` regelmäßig verwerfen.
 */
export function printHtmlDocument(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.visibility = 'hidden';

  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) {
      frame.remove();
      return;
    }
    win.focus();
    win.print();
    // Der Druckdialog blockiert je nach Browser nicht, deshalb wird der Rahmen
    // verzögert entfernt statt direkt nach print().
    setTimeout(() => frame.remove(), 60_000);
  };

  document.body.appendChild(frame);
  frame.srcdoc = html;
}
