# Kühlschrank Manager v1.2.0

Reine HTML-/CSS-/JavaScript-App für GitHub Pages.

## Änderungen in v1.2.0

- Speichern neuer Artikel korrigiert und robuster gemacht
- Ablaufdatum ist nicht mehr zwingend erforderlich
- Wenn kein Ablaufdatum gesetzt ist, wird automatisch +7 Tage verwendet
- Handy-Scan ergänzt
- Button „Mit Handy scannen“ nutzt die interne Handykamera
- Live-Kamera bleibt optional
- Manuelle Barcode-Eingabe bleibt erhalten
- Dark Mode ist standardmäßig aktiv

## GitHub Pages

Einfach diese Dateien im Repository ersetzen:

- index.html
- style.css
- app.js
- README.md

## Scanner-Hinweis

Der Button „Mit Handy scannen“ öffnet auf Smartphones die Kamera-App über:

```html
<input type="file" accept="image/*" capture="environment">
```

Die automatische Barcode-Erkennung hängt vom Browser ab.  
Falls sie nicht unterstützt wird, kann der Barcode manuell eingegeben werden.
