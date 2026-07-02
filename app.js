const FOOD_KEY = "smart_fridge_v2_foods";
const SHOPPING_KEY = "smart_fridge_v2_shopping";

const zones = {
  A: { title: "Tür oben", hint: "Butter, Käse, Saucen, Eier", color: "#1463ff" },
  B: { title: "Tür unten", hint: "Getränke, Milch, Säfte", color: "#10b981" },
  C: { title: "Oberes Fach", hint: "Joghurt, Aufschnitt, Desserts", color: "#f59e0b" },
  D: { title: "Mittleres Fach", hint: "Reste, gekochte Speisen, Dosen", color: "#8b5cf6" },
  E: { title: "Gemüsefach", hint: "Gemüse, Salat, Obst", color: "#65a844" },
  F: { title: "Gefrierfach", hint: "Tiefkühlprodukte, Eis", color: "#60a5fa" }
};

const demoFoods = [
  { id: "1", barcode: "54491472", name: "Coca Cola Original", brand: "Coca-Cola", category: "Getränke", amount: 1, unit: "Stück", minAmount: 1, expiry: todayOffset(7), location: "Kühlschrank", zone: "B", note: "Inhalt: 330 ml", imageUrl: "", source: "OpenFoodFacts" },
  { id: "2", barcode: "", name: "Gouda Käse", brand: "", category: "Milchprodukte", amount: 1, unit: "Stück", minAmount: 1, expiry: todayOffset(5), location: "Kühlschrank", zone: "A", note: "", imageUrl: "" },
  { id: "3", barcode: "", name: "Salat", brand: "", category: "Gemüse", amount: 1, unit: "Stück", minAmount: 1, expiry: todayOffset(2), location: "Kühlschrank", zone: "E", note: "", imageUrl: "" }
];

const demoShopping = [
  { id: "s1", name: "Milch", amount: "1 l", checked: false },
  { id: "s2", name: "Butter", amount: "250 g", checked: false },
  { id: "s3", name: "Tomaten", amount: "500 g", checked: false }
];

let foods = load(FOOD_KEY, demoFoods);
let shopping = load(SHOPPING_KEY, demoShopping);
let stream = null;
let scanTimer = null;
let lastBarcode = "";

function load(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function save() {
  localStorage.setItem(FOOD_KEY, JSON.stringify(foods));
  localStorage.setItem(SHOPPING_KEY, JSON.stringify(shopping));
}

function todayOffset(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function normalizeDate(value) {
  if (!value) return todayOffset(7);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? todayOffset(7) : parsed.toISOString().slice(0, 10);
}

function daysUntil(dateString) {
  const today = new Date();
  const target = new Date(normalizeDate(dateString));
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function expiryText(days) {
  if (days < 0) return "abgelaufen";
  if (days === 0) return "Heute";
  if (days === 1) return "1 Tag";
  return `${days} Tage`;
}

function suggestZone(category, name = "") {
  const text = `${category} ${name}`.toLowerCase();
  if (text.includes("gemüse") || text.includes("obst") || text.includes("salat")) return "E";
  if (text.includes("getränk") || text.includes("milch") || text.includes("wasser") || text.includes("saft") || text.includes("cola")) return "B";
  if (text.includes("butter") || text.includes("käse") || text.includes("sauce") || text.includes("ei")) return "A";
  if (text.includes("fleisch") || text.includes("wurst") || text.includes("aufschnitt")) return "C";
  if (text.includes("gefrier") || text.includes("tk") || text.includes("tiefkühl")) return "F";
  return "D";
}

function zoneLabel(zone) {
  return zones[zone] ? `Zone ${zone} – ${zones[zone].title}` : "Ohne Zone";
}

function iconFor(category) {
  return {
    "Milchprodukte": "🧀",
    "Fleisch / Wurst": "🥩",
    "Gemüse": "🥬",
    "Obst": "🍎",
    "Getränke": "🥤",
    "Vorrat": "🥫",
    "Sonstiges": "📦"
  }[category] || "📦";
}

function render() {
  document.getElementById("today").textContent = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  foods = foods.map(item => ({
    ...item,
    zone: item.zone || suggestZone(item.category, item.name)
  }));
  save();

  const expiring = foods.filter(item => daysUntil(item.expiry) <= 3);
  const low = foods.filter(item => Number(item.amount) <= Number(item.minAmount));
  const expired = foods.filter(item => daysUntil(item.expiry) < 0);

  set("kpiExpiring", expiring.length);
  set("kpiLow", low.length);
  set("kpiTotal", foods.length);
  set("kpiShopping", shopping.length);
  set("statTotal", foods.length);
  set("statExpired", expired.length);
  set("statLow", low.length);
  set("statShopping", shopping.length);
  set("donutTotal", foods.length);

  renderInventory();
  renderShopping();
  renderZones();
  renderSidebar(expiring);
}

function set(id, value) {
  document.getElementById(id).textContent = value;
}

function renderSidebar(expiring) {
  const el = document.getElementById("sidebarExpiring");
  el.innerHTML = expiring.slice(0, 4).map(item => `
    <div class="shopping-row">
      <span>${escapeHtml(item.name)}</span>
      <small>${expiryText(daysUntil(item.expiry))}</small>
    </div>
  `).join("") || `<div class="empty">Keine kritischen Artikel.</div>`;
}

function renderInventory() {
  const query = document.getElementById("search")?.value.toLowerCase() || "";
  const zone = document.getElementById("zoneFilter")?.value || "";

  const list = foods
    .filter(item => `${item.name} ${item.brand} ${item.category} ${item.barcode} ${zoneLabel(item.zone)}`.toLowerCase().includes(query))
    .filter(item => !zone || item.zone === zone)
    .sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));

  document.getElementById("inventoryList").innerHTML = list.map(item => `
    <article class="food-card">
      ${item.imageUrl ? `<img class="product-img" src="${escapeHtml(item.imageUrl)}" alt="">` : `<div class="thumb">${iconFor(item.category)}</div>`}
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.brand || "")}${item.brand ? " · " : ""}${escapeHtml(item.category)} · ${escapeHtml(item.location || "Kühlschrank")}</p>
        <small>${item.amount} ${escapeHtml(item.unit)} · Ablauf: ${expiryText(daysUntil(item.expiry))}${item.note ? " · " + escapeHtml(item.note) : ""}${item.barcode ? " · Barcode: " + escapeHtml(item.barcode) : ""}</small>
        <span class="badge">${escapeHtml(zoneLabel(item.zone))}</span>
        ${item.source ? `<span class="badge off">${escapeHtml(item.source)}</span>` : ""}
      </div>
      <div class="food-actions">
        <button class="amount" onclick="changeAmount('${item.id}', -1)">−</button>
        <button class="amount" onclick="changeAmount('${item.id}', 1)">+</button>
        <button class="consume" onclick="consumeFood('${item.id}')">Entnehmen</button>
        <button class="delete" onclick="deleteFood('${item.id}')">🗑</button>
      </div>
    </article>
  `).join("") || `<div class="empty">Keine Lebensmittel gefunden.</div>`;
}

function renderShopping() {
  document.getElementById("shoppingList").innerHTML = shopping.map(item => `
    <label class="shopping-row">
      <input type="checkbox" ${item.checked ? "checked" : ""} onchange="toggleShopping('${item.id}')">
      <span>${escapeHtml(item.name)}</span>
      <small>${escapeHtml(item.amount || "")}</small>
      <button class="delete" type="button" onclick="deleteShopping('${item.id}')">×</button>
    </label>
  `).join("") || `<div class="empty">Einkaufsliste leer.</div>`;
}

function renderZones() {
  const counts = {};
  Object.keys(zones).forEach(zone => {
    counts[zone] = foods.filter(item => item.zone === zone).length;
    const zoneItems = document.getElementById(`zoneItems${zone}`);
    if (zoneItems) {
      zoneItems.className = "zone-items";
      zoneItems.innerHTML = foods
        .filter(item => item.zone === zone)
        .slice(0, 5)
        .map(item => `<span class="mini-item">${escapeHtml(item.name)}</span>`)
        .join("");
    }
  });

  document.getElementById("zoneCards").innerHTML = Object.entries(zones).map(([key, zone]) => `
    <article class="zone-card">
      <div class="zone-letter" style="background:${zone.color}">${key}</div>
      <div>
        <b>${zone.title}</b>
        <small>${zone.hint}</small>
      </div>
      <span class="zone-count">${counts[key]} Artikel</span>
    </article>
  `).join("");

  document.getElementById("legend").innerHTML = Object.entries(zones).map(([key, zone]) => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${zone.color}"></span>
      <b>${zone.title}</b>
      <span>${counts[key]}</span>
    </div>
  `).join("");

  const total = Math.max(foods.length, 1);
  let start = 0;
  const parts = Object.entries(zones).map(([key, zone]) => {
    const deg = counts[key] / total * 360;
    const part = `${zone.color} ${start}deg ${start + deg}deg`;
    start += deg;
    return part;
  }).join(", ");

  document.getElementById("donut").style.background = `conic-gradient(${parts || "#e2e8f0 0deg 360deg"})`;
}

document.getElementById("foodForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = val("name");
  if (!name) return;

  const category = val("category");
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    barcode: val("barcodeField") || val("barcodeInput"),
    brand: val("brand"),
    name,
    category,
    amount: Number(val("amount")) || 1,
    unit: val("unit") || "Stück",
    minAmount: Number(val("minAmount")) || 1,
    expiry: normalizeDate(val("expiry")),
    location: "Kühlschrank",
    zone: val("zone") || suggestZone(category, name),
    imageUrl: val("imageUrl"),
    note: val("note"),
    source: val("imageUrl") ? "OpenFoodFacts" : ""
  };

  foods.push(item);
  save();
  event.target.reset();
  document.getElementById("amount").value = 1;
  document.getElementById("unit").value = "Stück";
  document.getElementById("minAmount").value = 1;
  document.getElementById("scanStatus").textContent = `Gespeichert: ${item.name}`;
  render();
  scrollToSection("inventory");
});

document.getElementById("shoppingForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = val("shoppingName");
  if (!name) return;
  shopping.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, amount: "", checked: false });
  document.getElementById("shoppingName").value = "";
  save();
  render();
});

document.getElementById("barcodeButton").addEventListener("click", () => {
  const barcode = val("barcodeInput");
  if (barcode) applyBarcode(barcode);
});

document.getElementById("search").addEventListener("input", renderInventory);
document.getElementById("zoneFilter").addEventListener("change", renderInventory);

document.getElementById("mobileScan").addEventListener("click", () => {
  document.getElementById("mobileImage").click();
});

document.getElementById("mobileImage").addEventListener("change", handleMobileImage);
document.getElementById("liveScan").addEventListener("click", startLiveScanner);
document.getElementById("stopScan").addEventListener("click", stopLiveScanner);

async function handleMobileImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!("BarcodeDetector" in window)) {
    status("Dieser Browser kann aus Fotos keinen Barcode lesen. Bitte Nummer manuell eingeben.");
    return;
  }

  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();

    const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"] });
    const codes = await detector.detect(img);
    URL.revokeObjectURL(url);

    if (codes.length) applyBarcode(codes[0].rawValue);
    else status("Kein Barcode erkannt.");
  } catch {
    status("Barcode konnte nicht gelesen werden.");
  } finally {
    event.target.value = "";
  }
}

async function startLiveScanner() {
  const video = document.getElementById("video");

  if (!navigator.mediaDevices) {
    status("Live-Kamera wird nicht unterstützt.");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream;
    video.style.display = "block";
    await video.play();

    if ("BarcodeDetector" in window) {
      const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"] });
      scanTimer = setInterval(async () => {
        const codes = await detector.detect(video);
        if (codes.length && codes[0].rawValue !== lastBarcode) {
          lastBarcode = codes[0].rawValue;
          applyBarcode(lastBarcode);
          stopLiveScanner();
        }
      }, 700);
    } else {
      status("Live-Erkennung nicht möglich. Bitte Handy-Scan oder Eingabe nutzen.");
    }
  } catch {
    status("Kamera konnte nicht gestartet werden.");
  }
}

function stopLiveScanner() {
  const video = document.getElementById("video");
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = null;

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  video.pause();
  video.srcObject = null;
  video.style.display = "none";
}

async function applyBarcode(barcode) {
  document.getElementById("barcodeInput").value = barcode;
  document.getElementById("barcodeField").value = barcode;
  status("Suche bei OpenFoodFacts...");

  const product = await lookupOpenFoodFacts(barcode);

  if (product) {
    fillProduct(product);
    status(`Gefunden: ${product.name}. Ablaufdatum prüfen und speichern.`);
  } else {
    status("Nicht gefunden. Barcode übernommen, Artikel bitte manuell ergänzen.");
    document.getElementById("name").focus();
  }

  scrollToSection("add");
}

async function lookupOpenFoodFacts(barcode) {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=product_name,product_name_de,brands,categories_tags,categories,quantity,product_quantity,product_quantity_unit,image_front_small_url,image_front_url`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const name = p.product_name_de || p.product_name;
    if (!name) return null;

    const category = mapCategory(p.categories_tags || [], p.categories || "");
    const quantity = p.quantity || "";

    return {
      barcode,
      name,
      brand: p.brands || "",
      category,
      amount: 1,
      unit: "Stück",
      minAmount: 1,
      zone: suggestZone(category, name),
      imageUrl: p.image_front_small_url || p.image_front_url || "",
      note: quantity ? `Inhalt: ${quantity}` : "",
      source: "OpenFoodFacts"
    };
  } catch {
    return null;
  }
}

function fillProduct(product) {
  document.getElementById("barcodeField").value = product.barcode || "";
  document.getElementById("brand").value = product.brand || "";
  document.getElementById("name").value = product.name || "";
  document.getElementById("category").value = product.category || "Sonstiges";
  document.getElementById("amount").value = product.amount || 1;
  document.getElementById("unit").value = product.unit || "Stück";
  document.getElementById("minAmount").value = product.minAmount || 1;
  document.getElementById("zone").value = product.zone || "D";
  document.getElementById("imageUrl").value = product.imageUrl || "";
  document.getElementById("note").value = product.note || "";
  if (!val("expiry")) document.getElementById("expiry").value = todayOffset(7);
}

function mapCategory(tags, text) {
  const combined = `${Array.isArray(tags) ? tags.join(" ") : ""} ${text}`.toLowerCase();
  if (combined.includes("dair") || combined.includes("milch") || combined.includes("käse") || combined.includes("joghurt")) return "Milchprodukte";
  if (combined.includes("meat") || combined.includes("wurst") || combined.includes("fleisch")) return "Fleisch / Wurst";
  if (combined.includes("vegetable") || combined.includes("gemüse") || combined.includes("salat")) return "Gemüse";
  if (combined.includes("fruit") || combined.includes("obst")) return "Obst";
  if (combined.includes("beverage") || combined.includes("drink") || combined.includes("getränk") || combined.includes("cola") || combined.includes("wasser") || combined.includes("saft")) return "Getränke";
  if (combined.includes("canned") || combined.includes("konserve")) return "Vorrat";
  return "Sonstiges";
}

function changeAmount(id, delta) {
  foods = foods.map(item => item.id === id ? { ...item, amount: Math.max(0, Number(item.amount) + delta) } : item)
               .filter(item => Number(item.amount) > 0);
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

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;

  target.scrollIntoView({ behavior: "smooth", block: "start" });

  document.querySelectorAll(".nav").forEach(button => {
    button.classList.toggle("active", button.dataset.target === id);
  });

  target.classList.add("section-highlight");
  setTimeout(() => target.classList.remove("section-highlight"), 800);
}

document.querySelectorAll(".nav, .quick-actions button").forEach(button => {
  button.addEventListener("click", () => scrollToSection(button.dataset.target));
});

document.getElementById("themeToggle").addEventListener("click", () => {
  document.getElementById("app").classList.toggle("dark");
});

function val(id) {
  return document.getElementById(id).value.trim();
}

function status(text) {
  document.getElementById("scanStatus").textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

render();
