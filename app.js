const FOOD_KEY = "km_html_foods_v15";
const SHOPPING_KEY = "km_html_shopping_v15";
const THEME_KEY = "km_html_dark_v15";

const demoFoods = [
  { id: "1", barcode: "4012345678901", name: "Milch", category: "Milchprodukte", amount: 1, unit: "l", minAmount: 1, expiry: todayOffset(0), location: "Kühlschrank", note: "Heute verbrauchen" },
  { id: "2", barcode: "4012345678902", name: "Joghurt", category: "Milchprodukte", amount: 2, unit: "Becher", minAmount: 2, expiry: todayOffset(1), location: "Kühlschrank", note: "" },
  { id: "3", barcode: "4012345678903", name: "Salat", category: "Gemüse", amount: 1, unit: "Stück", minAmount: 1, expiry: todayOffset(2), location: "Kühlschrank", note: "" },
  { id: "4", barcode: "4012345678904", name: "Käse", category: "Milchprodukte", amount: 250, unit: "g", minAmount: 150, expiry: todayOffset(3), location: "Kühlschrank", note: "" },
  { id: "5", barcode: "4012345678905", name: "Eier", category: "Sonstiges", amount: 2, unit: "Stück", minAmount: 6, expiry: todayOffset(5), location: "Kühlschrank", note: "Fast leer" }
];

const demoShopping = [
  { id: "s1", name: "Milch", amount: "1 l", checked: true },
  { id: "s2", name: "Butter", amount: "250 g", checked: false },
  { id: "s3", name: "Tomaten", amount: "500 g", checked: false }
];

const productDatabase = {
  "4012345678901": { name: "Milch", category: "Milchprodukte", unit: "l", amount: 1, minAmount: 1, location: "Kühlschrank" },
  "4012345678902": { name: "Joghurt", category: "Milchprodukte", unit: "Becher", amount: 1, minAmount: 2, location: "Kühlschrank" },
  "4012345678903": { name: "Salat", category: "Gemüse", unit: "Stück", amount: 1, minAmount: 1, location: "Kühlschrank" },
  "4012345678904": { name: "Käse", category: "Milchprodukte", unit: "g", amount: 250, minAmount: 150, location: "Kühlschrank" },
  "4012345678905": { name: "Eier", category: "Sonstiges", unit: "Stück", amount: 6, minAmount: 6, location: "Kühlschrank" }
};

let foods = load(FOOD_KEY, demoFoods);
let shopping = load(SHOPPING_KEY, demoShopping);
foods = foods.map(item => {
  if (item.source === "OpenFoodFacts" && item.unit !== "Stück") {
    return {...item, amount: 1, unit: "Stück", note: item.note || `Inhalt: ${item.amount} ${item.unit}`};
  }
  return item;
});
save();

let stream = null;
let scanTimer = null;
let lastBarcode = "";

function load(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function save() {
  localStorage.setItem(FOOD_KEY, JSON.stringify(foods));
  localStorage.setItem(SHOPPING_KEY, JSON.stringify(shopping));
}

function todayOffset(offset) {
  return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
}

function normalizeDate(value) {
  if (!value) return todayOffset(7);

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const german = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (german) {
    const [, d, m, y] = german;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return todayOffset(7);
}

function daysUntil(dateString) {
  const today = new Date();
  const target = new Date(normalizeDate(dateString));
  today.setHours(0,0,0,0);
  target.setHours(0,0,0,0);
  return Math.round((target - today) / 86400000);
}

function expiryText(days) {
  if (days < 0) return "abgelaufen";
  if (days === 0) return "Heute";
  if (days === 1) return "1 Tag";
  return days + " Tage";
}

function iconFor(category) {
  const icons = {
    "Milchprodukte": "🥛",
    "Fleisch / Wurst": "🥩",
    "Gemüse": "🥬",
    "Obst": "🍎",
    "Getränke": "🥤",
    "Vorrat": "🥫",
    "Sonstiges": "📦"
  };
  return icons[category] || "📦";
}

function render() {
  document.getElementById("today").textContent = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const soon = foods.filter(f => daysUntil(f.expiry) <= 3).sort((a,b) => daysUntil(a.expiry) - daysUntil(b.expiry));
  const low = foods.filter(f => Number(f.amount) <= Number(f.minAmount));
  const expired = foods.filter(f => daysUntil(f.expiry) < 0);

  document.getElementById("soonCount").textContent = soon.length;
  document.getElementById("lowCount").textContent = low.length;
  document.getElementById("totalCount").textContent = foods.length;
  document.getElementById("shoppingCount").textContent = shopping.length;

  document.getElementById("statTotal").textContent = foods.length;
  document.getElementById("statExpired").textContent = expired.length;
  document.getElementById("statLow").textContent = low.length;
  document.getElementById("statShopping").textContent = shopping.length;

  renderList("soonList", soon, "expiry");
  renderList("lowList", low, "stock");
  renderShopping();
  renderFoods();
}

function renderList(id, list, mode) {
  const el = document.getElementById(id);
  if (!list.length) {
    el.innerHTML = '<div class="empty">Keine Einträge vorhanden.</div>';
    return;
  }

  el.innerHTML = list.map(item => {
    const days = daysUntil(item.expiry);
    const pillClass = days <= 0 ? "red" : days <= 3 ? "orange" : "green";
    const right = mode === "stock" ? `${item.amount} ${item.unit}` : expiryText(days);

    return `
      <div class="row">
        <div class="thumb">${iconFor(item.category)}</div>
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.location)}</small>
        </div>
        <span class="pill ${pillClass}">${right}</span>
      </div>
    `;
  }).join("");
}

function renderShopping() {
  const el = document.getElementById("shoppingList");

  if (!shopping.length) {
    el.innerHTML = '<div class="empty">Einkaufsliste ist leer.</div>';
    return;
  }

  el.innerHTML = shopping.map(item => `
    <label class="shopping-row">
      <input type="checkbox" ${item.checked ? "checked" : ""} onchange="toggleShopping('${item.id}')">
      <span>${escapeHtml(item.name)}</span>
      <small>${escapeHtml(item.amount || "")}</small>
      <button class="delete-btn" onclick="deleteShopping('${item.id}')" type="button">×</button>
    </label>
  `).join("");
}

function renderFoods() {
  const search = document.getElementById("search").value.toLowerCase();
  const el = document.getElementById("foodList");
  const filtered = foods
    .filter(item => `${item.name} ${item.category} ${item.location} ${item.barcode || ""}`.toLowerCase().includes(search))
    .sort((a,b) => daysUntil(a.expiry) - daysUntil(b.expiry));

  if (!filtered.length) {
    el.innerHTML = '<div class="empty">Keine Lebensmittel gefunden.</div>';
    return;
  }

  el.innerHTML = filtered.map(item => {
    const days = daysUntil(item.expiry);
    return `
      <article class="food-card">
        ${item.imageUrl ? `<img class="product-img" src="${escapeHtml(item.imageUrl)}" alt="">` : `<div class="thumb">${iconFor(item.category)}</div>`}
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.brand || "")}${item.brand ? " · " : ""}${escapeHtml(item.category)} · ${escapeHtml(item.location)}</p>
          <small>${item.amount} ${escapeHtml(item.unit)} · Ablauf: ${expiryText(days)}${item.note ? " · " + escapeHtml(item.note) : ""}${item.barcode ? " · Barcode: " + escapeHtml(item.barcode) : ""}</small>
          ${item.source === "OpenFoodFacts" ? `<span class="off-badge">OpenFoodFacts</span>` : ""}
        </div>
        <div class="food-actions">
          <div class="qty-actions">
            <button class="action-btn" onclick="changeAmount('${item.id}', -1)" type="button">−</button>
            <button class="action-btn" onclick="changeAmount('${item.id}', 1)" type="button">+</button>
          </div>
          <button class="consume-btn" onclick="consumeFood('${item.id}')" type="button">Entnehmen</button>
          <button class="delete-btn" onclick="deleteFood('${item.id}')" type="button">🗑</button>
        </div>
      </article>
    `;
  }).join("");
}

document.getElementById("foodForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  if (!name) {
    document.getElementById("scanResult").textContent = "Bitte zuerst einen Artikelnamen eintragen.";
    return;
  }

  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    barcode: document.getElementById("barcodeField").value.trim() || document.getElementById("barcodeInput").value.trim(),
    name,
    brand: document.getElementById("brand").value.trim(),
    imageUrl: document.getElementById("imageUrl").value.trim(),
    source: document.getElementById("imageUrl").value.trim() ? "OpenFoodFacts" : "",
    category: document.getElementById("category").value,
    amount: Number(document.getElementById("amount").value || 1),
    unit: document.getElementById("unit").value.trim() || "Stück",
    minAmount: Number(document.getElementById("minAmount").value || 1),
    expiry: normalizeDate(document.getElementById("expiry").value),
    location: document.getElementById("location").value,
    note: document.getElementById("note").value.trim()
  };

  foods.push(item);
  save();

  event.target.reset();
  document.getElementById("amount").value = 1;
  document.getElementById("minAmount").value = 1;
  document.getElementById("unit").value = "Stück";
  document.getElementById("barcodeInput").value = "";
  document.getElementById("barcodeField").value = "";
  document.getElementById("brand").value = "";
  document.getElementById("imageUrl").value = "";
  document.getElementById("scanResult").textContent = `Gespeichert: ${item.name}`;

  render();
  document.getElementById("bestand").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("shoppingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("shoppingName");
  const name = input.value.trim();
  if (!name) return;

  shopping.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, amount: "", checked: false });
  input.value = "";
  save();
  render();
});

document.getElementById("barcodeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const barcode = document.getElementById("barcodeInput").value.trim();
  if (!barcode) return;
  applyBarcode(barcode);
});

document.getElementById("search").addEventListener("input", renderFoods);

document.getElementById("themeBtn").addEventListener("click", toggleTheme);
document.getElementById("jumpScannerBtn").addEventListener("click", () => {
  document.getElementById("scanner").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("mobileScanBtn").addEventListener("click", () => {
  document.getElementById("mobileImageInput").click();
});

document.getElementById("mobileImageInput").addEventListener("change", handleMobileImage);
document.getElementById("startScanBtn").addEventListener("click", startLiveScanner);
document.getElementById("stopScanBtn").addEventListener("click", stopLiveScanner);

function toggleTheme() {
  document.getElementById("app").classList.toggle("dark");
  const isDark = document.getElementById("app").classList.contains("dark");
  localStorage.setItem(THEME_KEY, isDark ? "1" : "0");
  document.getElementById("themeBtn").textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
}


function changeAmount(id, delta) {
  foods = foods.map(item => {
    if (item.id !== id) return item;
    const nextAmount = Math.max(0, Number(item.amount) + delta);
    return { ...item, amount: nextAmount };
  }).filter(item => Number(item.amount) > 0);

  save();
  render();
}

function consumeFood(id) {
  foods = foods.filter(item => item.id !== id);
  save();
  render();
}

function deleteFood(id) {
  foods = foods.filter(item => item.id !== id);
  save();
  render();
}

function toggleShopping(id) {
  shopping = shopping.map(item => item.id === id ? { ...item, checked: !item.checked } : item);
  save();
  render();
}

function deleteShopping(id) {
  shopping = shopping.filter(item => item.id !== id);
  save();
  render();
}

async function handleMobileImage(event) {
  const file = event.target.files[0];
  const result = document.getElementById("scanResult");

  if (!file) return;

  if (!("BarcodeDetector" in window)) {
    result.textContent = "Dieser Browser kann aus Fotos keinen Barcode lesen. Bitte Nummer manuell eingeben.";
    return;
  }

  try {
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = imageUrl;
    await img.decode();

    const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"] });
    const codes = await detector.detect(img);

    URL.revokeObjectURL(imageUrl);

    if (codes.length > 0) {
      const value = codes[0].rawValue;
      document.getElementById("barcodeInput").value = value;
      applyBarcode(value);
    } else {
      result.textContent = "Kein Barcode erkannt. Bitte Foto näher und schärfer aufnehmen oder Nummer manuell eingeben.";
    }
  } catch (error) {
    result.textContent = "Barcode konnte aus dem Foto nicht gelesen werden. Bitte manuell eingeben.";
  } finally {
    event.target.value = "";
  }
}

async function startLiveScanner() {
  const result = document.getElementById("scanResult");
  const video = document.getElementById("scannerVideo");
  const placeholder = document.getElementById("scannerPlaceholder");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    result.textContent = "Live-Kamera wird nicht unterstützt. Bitte „Mit Handy scannen“ oder manuelle Eingabe verwenden.";
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    video.style.display = "block";
    placeholder.style.display = "none";
    result.textContent = "Live-Scanner läuft. Barcode vor die Kamera halten.";

    if ("BarcodeDetector" in window) {
      const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"] });
      scanTimer = setInterval(async () => {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            const value = codes[0].rawValue;
            if (value && value !== lastBarcode) {
              lastBarcode = value;
              document.getElementById("barcodeInput").value = value;
              applyBarcode(value);
              stopLiveScanner();
            }
          }
        } catch {
          result.textContent = "Live-Erkennung nicht möglich. Bitte Handy-Scan oder manuelle Eingabe verwenden.";
        }
      }, 700);
    } else {
      result.textContent = "Kamera aktiv. Automatische Live-Erkennung wird von diesem Browser nicht unterstützt.";
    }
  } catch {
    result.textContent = "Kamera konnte nicht gestartet werden. Bitte Berechtigung prüfen oder Handy-Scan verwenden.";
  }
}

function stopLiveScanner() {
  const video = document.getElementById("scannerVideo");
  const placeholder = document.getElementById("scannerPlaceholder");

  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  video.pause();
  video.srcObject = null;
  video.style.display = "none";
  placeholder.style.display = "grid";
}

async function applyBarcode(barcode) {
  const result = document.getElementById("scanResult");

  document.getElementById("barcodeInput").value = barcode;
  document.getElementById("barcodeField").value = barcode;
  result.textContent = `Barcode erkannt: ${barcode}. Suche bei OpenFoodFacts läuft...`;

  const offProduct = await lookupOpenFoodFacts(barcode);

  if (offProduct) {
    document.getElementById("name").value = offProduct.name;
    document.getElementById("brand").value = offProduct.brand || "";
    document.getElementById("category").value = offProduct.category;
    document.getElementById("amount").value = offProduct.amount;
    document.getElementById("unit").value = offProduct.unit;
    document.getElementById("minAmount").value = offProduct.minAmount;
    document.getElementById("location").value = offProduct.location;
    document.getElementById("imageUrl").value = offProduct.imageUrl || "";
    document.getElementById("note").value = offProduct.productSize ? `Inhalt: ${offProduct.productSize}` : "";
    if (!document.getElementById("expiry").value) document.getElementById("expiry").value = todayOffset(7);
    result.textContent = `OpenFoodFacts gefunden: ${offProduct.name}. Bestand wird als 1 Stück angelegt. Ablaufdatum prüfen und speichern.`;
    document.getElementById("add").scrollIntoView({ behavior: "smooth" });
    return;
  }

  const product = productDatabase[barcode];

  if (product) {
    document.getElementById("name").value = product.name;
    document.getElementById("brand").value = product.brand || "";
    document.getElementById("category").value = product.category;
    document.getElementById("amount").value = product.amount;
    document.getElementById("unit").value = product.unit;
    document.getElementById("minAmount").value = product.minAmount;
    document.getElementById("location").value = product.location;
    if (!document.getElementById("expiry").value) document.getElementById("expiry").value = todayOffset(7);
    result.textContent = `Lokale Produktdaten gefunden: ${barcode} – ${product.name}. Jetzt speichern.`;
  } else {
    if (!document.getElementById("expiry").value) document.getElementById("expiry").value = todayOffset(7);
    result.textContent = `Kein Produkt bei OpenFoodFacts gefunden. Barcode wurde übernommen, Artikel bitte manuell ergänzen.`;
    document.getElementById("name").focus();
  }

  document.getElementById("add").scrollIntoView({ behavior: "smooth" });
}

async function lookupOpenFoodFacts(barcode) {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=product_name,product_name_de,brands,categories_tags,categories,quantity,product_quantity,product_quantity_unit,image_front_small_url,image_front_url`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const name = p.product_name_de || p.product_name;
    if (!name) return null;

    const quantity = parseQuantity(p.quantity, p.product_quantity, p.product_quantity_unit);

    return {
      name,
      brand: p.brands || "",
      category: mapOpenFoodFactsCategory(p.categories_tags || [], p.categories || ""),
      amount: 1,
      unit: "Stück",
      minAmount: 1,
      location: "Kühlschrank",
      imageUrl: p.image_front_small_url || p.image_front_url || "",
      source: "OpenFoodFacts",
      productSize: quantity.label
    };
  } catch {
    return null;
  }
}

function parseQuantity(quantityText, productQuantity, productQuantityUnit) {
  if (productQuantity && productQuantityUnit) {
    return { amount: Number(productQuantity) || 1, unit: productQuantityUnit };
  }

  const text = String(quantityText || "").replace(",", ".").trim();
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(ml|l|g|kg|stück|st|pcs|cl|becher|dose|flasche)/i);
  if (!match) return { amount: 1, unit: "Stück", label: quantityText || "" };

  let amount = Number(match[1]);
  let unit = match[2].toLowerCase();

  if (unit === "ml") { amount = amount / 1000; unit = "l"; }
  if (unit === "st" || unit === "pcs") unit = "Stück";

  return { amount, unit, label: quantityText || `${amount} ${unit}` };
}

function mapOpenFoodFactsCategory(tags, categoriesText) {
  const combined = `${Array.isArray(tags) ? tags.join(" ") : ""} ${categoriesText}`.toLowerCase();

  if (combined.includes("dair") || combined.includes("milch") || combined.includes("käse") || combined.includes("yogurt") || combined.includes("joghurt")) return "Milchprodukte";
  if (combined.includes("meat") || combined.includes("wurst") || combined.includes("fleisch") || combined.includes("sausage")) return "Fleisch / Wurst";
  if (combined.includes("vegetable") || combined.includes("gemüse") || combined.includes("salat")) return "Gemüse";
  if (combined.includes("fruit") || combined.includes("obst")) return "Obst";
  if (combined.includes("beverage") || combined.includes("drink") || combined.includes("getränk") || combined.includes("wasser") || combined.includes("saft")) return "Getränke";
  if (combined.includes("canned") || combined.includes("konserve") || combined.includes("vorrat")) return "Vorrat";

  return "Sonstiges";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}


function scrollToSection(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.target === targetId);
  });
  target.classList.add("section-highlight");
  setTimeout(() => target.classList.remove("section-highlight"), 900);
}

document.querySelectorAll(".nav-link, .quick-actions button").forEach(element => {
  element.addEventListener("click", (event) => {
    const targetId = element.dataset.target;
    if (!targetId) return;
    event.preventDefault();
    scrollToSection(targetId);
  });
});

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === "0") {
  document.getElementById("app").classList.remove("dark");
  document.getElementById("themeBtn").textContent = "🌙 Dark Mode";
} else {
  document.getElementById("app").classList.add("dark");
  document.getElementById("themeBtn").textContent = "☀️ Light Mode";
}

render();
