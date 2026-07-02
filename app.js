const FOOD_KEY = "km_html_foods";
const SHOPPING_KEY = "km_html_shopping";
const THEME_KEY = "km_html_dark";

const demoFoods = [
  {
    id: "1",
    name: "Milch",
    category: "Milchprodukte",
    amount: 1,
    unit: "l",
    minAmount: 1,
    expiry: todayOffset(0),
    location: "Kühlschrank",
    note: "Heute verbrauchen"
  },
  {
    id: "2",
    name: "Gouda",
    category: "Milchprodukte",
    amount: 250,
    unit: "g",
    minAmount: 150,
    expiry: todayOffset(1),
    location: "Kühlschrank",
    note: ""
  },
  {
    id: "3",
    name: "Salat",
    category: "Gemüse",
    amount: 1,
    unit: "Stück",
    minAmount: 1,
    expiry: todayOffset(2),
    location: "Kühlschrank",
    note: ""
  },
  {
    id: "4",
    name: "Eier",
    category: "Sonstiges",
    amount: 2,
    unit: "Stück",
    minAmount: 6,
    expiry: todayOffset(5),
    location: "Kühlschrank",
    note: "Fast leer"
  }
];

const demoShopping = [
  { id: "s1", name: "Milch", checked: true },
  { id: "s2", name: "Butter", checked: false },
  { id: "s3", name: "Tomaten", checked: false }
];

let foods = load(FOOD_KEY, demoFoods);
let shopping = load(SHOPPING_KEY, demoShopping);

function load(key, fallback) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : fallback;
}

function save() {
  localStorage.setItem(FOOD_KEY, JSON.stringify(foods));
  localStorage.setItem(SHOPPING_KEY, JSON.stringify(shopping));
}

function todayOffset(offset) {
  return new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
}

function daysUntil(dateString) {
  const today = new Date();
  const target = new Date(dateString);
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
          <strong>${item.name}</strong>
          <small>${item.location}</small>
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
      <span>${item.name}</span>
      <button class="delete-btn" onclick="deleteShopping('${item.id}')" type="button">×</button>
    </label>
  `).join("");
}

function renderFoods() {
  const search = document.getElementById("search").value.toLowerCase();
  const el = document.getElementById("foodList");
  const filtered = foods
    .filter(item => `${item.name} ${item.category} ${item.location}`.toLowerCase().includes(search))
    .sort((a,b) => daysUntil(a.expiry) - daysUntil(b.expiry));

  if (!filtered.length) {
    el.innerHTML = '<div class="empty">Keine Lebensmittel gefunden.</div>';
    return;
  }

  el.innerHTML = filtered.map(item => {
    const days = daysUntil(item.expiry);
    const pillClass = days <= 0 ? "red" : days <= 3 ? "orange" : "green";
    return `
      <article class="food-card">
        <div class="thumb">${iconFor(item.category)}</div>
        <div>
          <h3>${item.name}</h3>
          <p>${item.category} · ${item.location}</p>
          <small>${item.amount} ${item.unit} · Ablauf: ${expiryText(days)} ${item.note ? "· " + item.note : ""}</small>
        </div>
        <button class="delete-btn" onclick="deleteFood('${item.id}')" type="button">🗑</button>
      </article>
    `;
  }).join("");
}

document.getElementById("foodForm").addEventListener("submit", (event) => {
  event.preventDefault();

  foods.push({
    id: crypto.randomUUID(),
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value,
    amount: Number(document.getElementById("amount").value),
    unit: document.getElementById("unit").value.trim(),
    minAmount: Number(document.getElementById("minAmount").value),
    expiry: document.getElementById("expiry").value,
    location: document.getElementById("location").value,
    note: document.getElementById("note").value.trim()
  });

  event.target.reset();
  document.getElementById("amount").value = 1;
  document.getElementById("minAmount").value = 1;
  document.getElementById("unit").value = "Stück";

  save();
  render();
});

document.getElementById("shoppingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("shoppingName");
  const name = input.value.trim();
  if (!name) return;

  shopping.push({
    id: crypto.randomUUID(),
    name,
    checked: false
  });

  input.value = "";
  save();
  render();
});

document.getElementById("search").addEventListener("input", renderFoods);

document.getElementById("themeBtn").addEventListener("click", () => {
  document.getElementById("app").classList.toggle("dark");
  const isDark = document.getElementById("app").classList.contains("dark");
  localStorage.setItem(THEME_KEY, isDark ? "1" : "0");
  document.getElementById("themeBtn").textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
});

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

if (localStorage.getItem(THEME_KEY) === "1") {
  document.getElementById("app").classList.add("dark");
  document.getElementById("themeBtn").textContent = "☀️ Light Mode";
}

render();
