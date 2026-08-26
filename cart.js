/* =============================================================
   LUMEA BEAUTY — carrito compartido (localStorage) + WhatsApp
   Número de WhatsApp del negocio (formato internacional, sin +)
   ============================================================= */
const WHATSAPP_NUMBER = "19297812767";
const CART_KEY = "lumea_cart";

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}
function findProduct(id) {
  for (const cat in PRODUCTS) {
    const p = PRODUCTS[cat].find((p) => p.id === id);
    if (p) return p;
  }
  return null;
}
function addToCart(id, size = null, variant = null) {
  const cart = getCart();
  const lineId = [id, size, variant].filter(Boolean).join("__");
  const line = cart.find((l) => l.lineId === lineId);
  if (line) line.qty += 1;
  else cart.push({ id, size, variant, lineId, qty: 1 });
  saveCart(cart);
  flashAdded(id);
  openCart();
}
function changeQty(lineId, delta) {
  const cart = getCart();
  const line = cart.find((l) => (l.lineId || l.id) === lineId);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) return removeFromCart(lineId);
  saveCart(cart);
}
function removeFromCart(lineId) {
  saveCart(getCart().filter((l) => (l.lineId || l.id) !== lineId));
}
function clearCart() {
  if (getCart().length === 0) return;
  if (!confirm("¿Vaciar todo el carrito?")) return;
  saveCart([]);
}
function cartTotal(cart) {
  return cart.reduce((sum, l) => {
    const p = findProduct(l.id);
    return sum + (p ? p.price * l.qty : 0);
  }, 0);
}
function cartCount(cart) {
  // Solo cuenta líneas cuyo producto todavía existe en el catálogo,
  // para que el número del ícono siempre coincida con lo que se ve
  // en el drawer y con el total (evita conteos "fantasma" de
  // productos que fueron eliminados o desactivados en el Sheet).
  return cart.reduce((n, l) => {
    const p = findProduct(l.id);
    return p ? n + l.qty : n;
  }, 0);
}
function flashAdded(id) {
  const btn = document.querySelector(`.add-btn[data-id="${id}"]`);
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = "Agregado ✓";
  btn.classList.add("added");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("added");
  }, 1200);
}

/* ---------- drawer render ---------- */
function renderCart() {
  const cart = getCart();
  const itemsEl = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  const countEls = document.querySelectorAll(".cart-count");
  const sendBtn = document.getElementById("cartSendBtn");
  const clearBtn = document.getElementById("cartClearBtn");

  countEls.forEach((el) => {
    const n = cartCount(cart);
    el.textContent = n;
    el.style.display = n > 0 ? "flex" : "none";
  });

  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        <span class="glyph">Lumea</span>
        <p>Tu carrito está vacío.<br>Agrega tus productos favoritos.</p>
      </div>`;
    if (sendBtn) sendBtn.disabled = true;
    if (clearBtn) clearBtn.style.display = "none";
  } else {
    itemsEl.innerHTML = cart
      .map((l) => {
        const p = findProduct(l.id);
        if (!p) return "";
        const lineId = l.lineId || l.id;
        const safeName = escapeHtml(p.name);
        const variantImg =
          l.variant && p.variants
            ? (p.variants.find((s) => s.name === l.variant) || {}).img
            : null;
        const lineImg = variantImg || p.img;
        const variantLabel = [l.size, l.variant].filter(Boolean).join(" · ");
        return `
        <div class="cart-line">
          <div class="line-media">
          ${lineImg ? `<img src="${escapeHtml(lineImg)}" alt="${safeName}">` : `<span>${safeName.charAt(0)}</span>`}
        </div>
          <div class="line-info">
            <h5>${safeName}${variantLabel ? ` <span class="line-size">${escapeHtml(variantLabel)}</span>` : ""}</h5>
            <div class="line-qty">
              <button class="qty-btn" aria-label="Restar" onclick="changeQty('${lineId}',-1)">−</button>
              <span>${l.qty}</span>
              <button class="qty-btn" aria-label="Sumar" onclick="changeQty('${lineId}',1)">+</button>
            </div>
            <button class="line-remove" onclick="removeFromCart('${lineId}')">Quitar</button>
          </div>
          <div class="line-price">$${(p.price * l.qty).toFixed(2)}</div>
        </div>`;
      })
      .join("");
    if (sendBtn) sendBtn.disabled = false;
    if (clearBtn) clearBtn.style.display = "inline-flex";
  }

  if (totalEl) totalEl.textContent = `$${cartTotal(cart).toFixed(2)}`;
}

/* ---------- drawer open/close ---------- */
function openCart() {
  document.getElementById("cartDrawer").classList.add("open");
  document.getElementById("cartOverlay").classList.add("open");
}
function closeCart() {
  document.getElementById("cartDrawer").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("open");
}

/* ---------- send to WhatsApp ---------- */
function sendCartToWhatsApp() {
  const cart = getCart();
  if (cart.length === 0) return;

  let msg = "Hola Lumea Beauty ✨ quiero hacer este pedido:\n\n";
  cart.forEach((l) => {
    const p = findProduct(l.id);
    if (!p) return;
    const variantText = [l.size, l.variant].filter(Boolean).join(" · ");
    msg += `• ${p.name}${variantText ? ` (${variantText})` : ""} x${l.qty} — $${(p.price * l.qty).toFixed(2)}\n`;
  });
  msg += `\nTotal: $${cartTotal(cart).toFixed(2)}\n\n`;
  msg +=
    "Mi dirección de envío en EE. UU. es: \n\n¿Cómo puedo pagar (efectivo, Zelle o PayPal)?";

  window.open(
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,
    "_blank",
  );

  awaitingConfirmation = true;
}

/* muestra el aviso al volver a la pestaña, si se acaba de enviar un pedido */
let awaitingConfirmation = false;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && awaitingConfirmation) {
    awaitingConfirmation = false;
    if (getCart().length > 0) showSentConfirm();
  }
});

function showSentConfirm() {
  const foot = document.querySelector(".cart-foot");
  if (!foot) return;
  // Evita apilar un segundo aviso si el usuario vuelve a enviar el
  // pedido sin haber respondido el primero.
  const existing = foot.querySelector(".sent-confirm");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.className = "sent-confirm";
  banner.innerHTML = `
    <p>¿Ya enviaste tu pedido por WhatsApp?</p>
    <div class="sent-confirm-actions">
      <button class="btn btn-primary" id="sentYes">Sí, vaciar carrito</button>
      <button class="btn btn-outline" id="sentNo">No todavía</button>
    </div>`;
  foot.prepend(banner);
  document.getElementById("sentYes").onclick = () => {
    saveCart([]);
    banner.remove();
  };
  document.getElementById("sentNo").onclick = () => banner.remove();
  openCart();
}

/* ---------- inject drawer + floating buttons on load ---------- */
function injectCartUI() {
  const overlay = document.createElement("div");
  overlay.id = "cartOverlay";
  overlay.className = "cart-overlay";
  overlay.onclick = closeCart;

  const menuBtn = document.getElementById("menuToggle");
  const mainNav = document.querySelector(".main-nav");
  if (menuBtn && mainNav) {
    menuBtn.addEventListener("click", () => mainNav.classList.toggle("open"));
    mainNav
      .querySelectorAll("a")
      .forEach((a) =>
        a.addEventListener("click", () => mainNav.classList.remove("open")),
      );
  }

  const drawer = document.createElement("div");
  drawer.id = "cartDrawer";
  drawer.className = "cart-drawer";
  drawer.innerHTML = `
    <div class="cart-head">
      <h3>Tu carrito</h3>
      <button class="cart-close" aria-label="Cerrar carrito" onclick="closeCart()">&times;</button>
    </div>
    <div class="cart-items" id="cartItems"></div>
    <div class="cart-foot">
      <div class="cart-total-row"><span>Total</span><span id="cartTotal">$0.00</span></div>
      <button class="btn btn-wa btn-block" id="cartSendBtn" onclick="sendCartToWhatsApp()">Enviar pedido por WhatsApp</button>
      <button class="cart-clear-btn" id="cartClearBtn" onclick="clearCart()">Vaciar carrito</button>
      <p class="cart-note">Confirmamos disponibilidad y forma de pago (efectivo, Zelle o PayPal) por WhatsApp.</p>
    </div>`;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  const fab = document.createElement("a");
  fab.className = "fab-wa";
  fab.href = `https://wa.me/${WHATSAPP_NUMBER}`;
  fab.target = "_blank";
  fab.setAttribute("aria-label", "Escríbenos por WhatsApp");
  fab.innerHTML = `<svg width="34" height="34" viewBox="0 0 256 256"><path fill="#25D366" d="M128 0C57.3 0 0 57.3 0 128c0 22.6 5.9 44.8 17.1 64.3L0 256l65.4-17.1C84.2 249.4 105.8 255 128 255c70.7 0 128-57.3 128-128S198.7 0 128 0Zm0 234.7c-19.9 0-39.4-5.3-56.4-15.4l-4-2.4-38.8 10.2 10.3-38-2.6-4.1C25.6 167.9 20 148.2 20 128 20 68.4 68.4 20 128 20s108 48.4 108 108-48.4 106.7-108 106.7Z"/><path fill="#25D366" d="M186 148.5c-3.2-1.6-19-9.4-22-10.5-2.9-1.1-5.1-1.6-7.3 1.6-2.1 3.2-8.4 10.5-10.3 12.6-1.9 2.1-3.8 2.4-7 .8-3.2-1.6-13.6-5-25.9-16-9.6-8.6-16-19.1-17.9-22.4-1.9-3.2-.2-4.9 1.4-6.5 1.4-1.4 3.2-3.7 4.8-5.6 1.6-1.9 2.1-3.2 3.2-5.3 1.1-2.1.5-4-.3-5.6-.8-1.6-7.3-17.5-10-24-2.6-6.3-5.3-5.5-7.3-5.6-1.9-.1-4-.1-6.1-.1-2.1 0-5.6.8-8.5 4-2.9 3.2-11.1 10.9-11.1 26.5s11.4 30.7 13 32.8c1.6 2.1 22.4 34.2 54.3 48 7.6 3.3 13.5 5.3 18.1 6.7 7.6 2.4 14.6 2.1 20-1.3 6.1-3.8 19-11.7 21.7-23 2.6-11.3 2.6-21 1.8-23-.8-2.1-2.9-3.2-6.1-4.7Z"/></svg>`;
  document.body.appendChild(fab);

  document.body
    .querySelectorAll(".icon-btn[data-cart-toggle]")
    .forEach((btn) => {
      btn.onclick = openCart;
    });

  renderCart();
}
document.addEventListener("DOMContentLoaded", async () => {
  if (window.PRODUCTS_READY) await window.PRODUCTS_READY;
  injectCartUI();
});
