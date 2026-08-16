/* =============================================================
   LUMEA BEAUTY — catálogo de productos (desde Google Sheets)
   ============================================================= */

// 👉 Pega aquí el link de "Publicar en la web" en formato CSV
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTyY-cfIwnpbLeW6HPkx46N6HbI3dp627oD0zxFfIxFfJyHvOsz3_65mQ2H2uYSCEc-3V75yJcrO562/pub?output=csv";

let PRODUCTS = { capilares: [], perfumes: [], mascarillas: [], ropa: [] };
let currentFilter = "all";
let currentSearch = "";
let currentSort = "default";

const SUBCATEGORY_LABELS = {
  shampoo: "Shampoo",
  acondicionador: "Acondicionador",
  "termoprotector-tonico-capilar": "Termoprotector / Tónico",
  mascarilla: "Mascarillas",
  perfumes: "Perfumes",
};

/* Logo de cada marca. La clave debe escribirse igual (sin mayúsculas,
   sin tildes) que como la vas a escribir en la columna "brand" del
   Google Sheet — la comparación ya ignora mayúsculas y tildes. */
const BRAND_LOGOS = {
  anyeluz: "multimedia/marcas/anyeluz.png",
  "click hair": "multimedia/marcas/click-hair.png",
  "origen botanico": "multimedia/marcas/origen-botanico.png",
  milagros: "multimedia/marcas/milagros.png",
  bloomshell: "multimedia/marcas/bloomshell.png",
  kaba: "multimedia/marcas/kaba.png",
  "leche pal pelo": "multimedia/marcas/leche-pal-pelo.png",
  trendy: "multimedia/marcas/trendy.png",
};

function normalizeBrandKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes
}

function brandLogo(brandName) {
  return BRAND_LOGOS[normalizeBrandKey(brandName)] || null;
}

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* parser simple de CSV que respeta comas dentro de comillas */
function parseCSV(text) {
  const rows = [];
  let row = [],
    field = "",
    inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i],
      next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (field !== "" || row.length) {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
        }
      } else {
        field += c;
      }
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length && r.some((v) => v.trim() !== ""));
}

/* ---------- estado de carga (loading / error) ---------- */
function showLoading() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="state-msg">
      <span class="state-spinner"></span>
      <p>Cargando productos...</p>
    </div>`;
}

function showError() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="state-msg">
      <p>No pudimos cargar el catálogo. Revisa tu conexión e intenta de nuevo.</p>
      <button class="btn btn-outline" onclick="location.reload()">Reintentar</button>
    </div>`;
}

async function loadProducts() {
  showLoading();
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error("Respuesta no válida del servidor");
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const data = rows.slice(1);

    const grouped = { capilares: [], perfumes: [], mascarillas: [], ropa: [] };
    data.forEach((cols) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = (cols[i] || "").trim()));
      if (!obj.id || !obj.category) return;
      if (obj.active && obj.active.toLowerCase() === "no") return;

      const product = {
        id: obj.id,
        name: obj.name,
        desc: obj.desc,
        price: parseFloat(obj.price) || 0,
        img: obj.img || null,
        brand: obj.brand || null,
        subcategory: obj.subcategory || null,
        inStock: !(obj.stock && obj.stock.toLowerCase() === "no"),
        sizes: obj.sizes
          ? obj.sizes
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
      };
      const categories = obj.category
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      categories.forEach((cat) => {
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(product);
      });
    });
    PRODUCTS = grouped;
  } catch (e) {
    console.error("No se pudo cargar el catálogo desde Google Sheets:", e);
    PRODUCTS = null;
  }
}

window.PRODUCTS_READY = loadProducts();

/* ---------- lightbox (zoom de imagen) ---------- */
function injectLightbox() {
  if (document.getElementById("lightbox")) return;
  const box = document.createElement("div");
  box.id = "lightbox";
  box.className = "lightbox";
  box.innerHTML = `
    <button class="lightbox-close" aria-label="Cerrar">&times;</button>
    <img id="lightboxImg" src="" alt="" />
    <p id="lightboxName"></p>
  `;
  box.addEventListener("click", (e) => {
    if (e.target === box) closeLightbox();
  });
  box.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
  document.body.appendChild(box);
}
function openLightbox(src, name) {
  const box = document.getElementById("lightbox");
  if (!box) return;
  document.getElementById("lightboxImg").src = src;
  document.getElementById("lightboxImg").alt = name;
  document.getElementById("lightboxName").textContent = name;
  box.classList.add("open");
}
function closeLightbox() {
  const box = document.getElementById("lightbox");
  if (box) box.classList.remove("open");
}

/* ---------- compartir producto ---------- */
function shareProduct(id, name, event) {
  event.stopPropagation();
  const url = `${location.origin}${location.pathname}?p=${encodeURIComponent(id)}`;
  const btn = event.currentTarget;
  if (navigator.share) {
    navigator
      .share({ title: name, text: `Mira este producto: ${name}`, url })
      .catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      const original = btn.textContent;
      btn.textContent = "¡Copiado!";
      setTimeout(() => (btn.textContent = original), 1500);
    });
  }
}

/* ---------- resaltar producto compartido (?p=ID en la URL) ---------- */
function highlightSharedProduct() {
  const params = new URLSearchParams(location.search);
  const id = params.get("p");
  if (!id) return;

  let selector;
  try {
    selector = `.add-btn[data-id="${CSS.escape(id)}"]`;
  } catch (e) {
    return;
  }
  const addBtn = document.querySelector(selector);
  const card = addBtn ? addBtn.closest(".product-card") : null;
  if (!card) return;

  // Espera un frame extra para que las imágenes ya hayan reservado
  // su espacio y el scroll caiga en la posición final correcta.
  requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("shared-highlight");
    setTimeout(() => card.classList.remove("shared-highlight"), 2600);
  });
}

function renderCategory(category) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  if (PRODUCTS === null) {
    showError();
    return;
  }

  let items = PRODUCTS[category] || [];
  if (currentFilter !== "all")
    items = items.filter((p) => p.subcategory === currentFilter);
  if (currentSearch.trim() !== "") {
    const term = currentSearch.trim().toLowerCase();
    items = items.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(term) ||
        (p.desc || "").toLowerCase().includes(term),
    );
  }

  items = [...items];
  if (currentSort === "price-asc") items.sort((a, b) => a.price - b.price);
  else if (currentSort === "price-desc")
    items.sort((a, b) => b.price - a.price);

  if (items.length === 0) {
    grid.innerHTML =
      currentSearch.trim() !== ""
        ? '<p class="empty-msg">No encontramos productos que coincidan con tu búsqueda.</p>'
        : '<p class="empty-msg">Pronto agregaremos productos aquí. Vuelve pronto ✨</p>';
    return;
  }

  grid.innerHTML = items
    .map((p) => {
      const safeName = escapeHtml(p.name);
      const safeDesc = escapeHtml(p.desc);
      const safeImg = escapeHtml(p.img);
      const safeId = escapeHtml(p.id);
      const logo = brandLogo(p.brand);
      const safeBrand = escapeHtml(p.brand);

      return `
    <article class="product-card${p.inStock ? "" : " out-of-stock"}">
      <div class="product-media" ${p.img ? `onclick="openLightbox('${safeImg}','${safeName.replace(/'/g, "\\'")}')"` : ""}>
        ${
          p.img
            ? `<img src="${safeImg}" alt="${safeName}" loading="lazy">`
            : `<span class="initial">${safeName.charAt(0)}</span>`
        }
        ${!p.inStock ? `<span class="stock-badge">Agotado</span>` : ""}
        ${
          logo
            ? `<span class="brand-badge" title="${safeBrand}"><img src="${logo}" alt="${safeBrand}"></span>`
            : ""
        }
        <button class="share-btn" aria-label="Compartir producto" onclick="shareProduct('${safeId}','${safeName.replace(/'/g, "\\'")}', event)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="product-body">
        ${p.brand ? `<span class="brand-name">${safeBrand}</span>` : ""}
        <h3>${safeName}</h3>
        <p class="desc">${safeDesc}</p>
        ${
          p.sizes
            ? `
          <select class="size-select" id="size-${safeId}" ${!p.inStock ? "disabled" : ""}>
            ${p.sizes.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}
          </select>
        `
            : ""
        }
        <div class="product-foot">
          <span class="price">$${p.price.toFixed(2)}</span>
          <button class="add-btn" data-id="${safeId}" ${!p.inStock ? "disabled" : ""} onclick="addToCart('${safeId}', ${p.sizes ? `document.getElementById('size-${safeId}').value` : "null"})">
            ${p.inStock ? "Agregar" : "Agotado"}
          </button>
        </div>
      </div>
    </article>
  `;
    })
    .join("");
}

function renderSubcategoryFilters(category) {
  const wrap = document.getElementById("subcatFilters");
  if (!wrap || PRODUCTS === null) return;
  const items = PRODUCTS[category] || [];
  const present = [...new Set(items.map((p) => p.subcategory).filter(Boolean))];
  if (present.length === 0) {
    wrap.style.display = "none";
    return;
  }

  wrap.innerHTML = `
    <button class="filter-btn active" data-filter="all">Todos</button>
    ${present.map((s) => `<button class="filter-btn" data-filter="${s}">${SUBCATEGORY_LABELS[s] || s}</button>`).join("")}
  `;

  wrap.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      wrap
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderCategory(category);
    });
  });
}

function setupSearch(category) {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("input", () => {
    currentSearch = input.value;
    renderCategory(category);
  });
}

function setupSort(category) {
  const select = document.getElementById("sortSelect");
  if (!select) return;
  select.addEventListener("change", () => {
    currentSort = select.value;
    renderCategory(category);
  });
}

/* ---------- carrusel de marcas (home) ---------- */
function setupBrandStrip() {
  const track = document.getElementById("brandTrack");
  if (!track) return;
  const leftBtn = document.querySelector(".brand-scroll-left");
  const rightBtn = document.querySelector(".brand-scroll-right");
  const step = () => track.clientWidth * 0.7;
  if (leftBtn)
    leftBtn.addEventListener("click", () =>
      track.scrollBy({ left: -step(), behavior: "smooth" }),
    );
  if (rightBtn)
    rightBtn.addEventListener("click", () =>
      track.scrollBy({ left: step(), behavior: "smooth" }),
    );
}

document.addEventListener("DOMContentLoaded", async () => {
  injectLightbox();
  setupBrandStrip();
  await window.PRODUCTS_READY;
  const category = document.body.dataset.category;
  if (category) {
    renderSubcategoryFilters(category);
    setupSearch(category);
    setupSort(category);
    renderCategory(category);
    highlightSharedProduct();
  }
});