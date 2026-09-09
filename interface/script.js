const page = document.body.dataset.page;

// Same storage key/shape as apps/web's src/lib/auth/tokenStore.ts. Writing
// here on login (see `page === "login"` below) is what lets the outer React
// shell's AppShell header — a separate document wrapping this iframe, which
// now owns showing "hello, <name>" for every dashboard — notice the login:
// that module listens for the `storage` event, which fires on the parent
// window whenever this same-origin iframe writes to localStorage/sessionStorage.
const AUTH_STORAGE_KEY = "shgap.auth.v1";

function persistAuthTokens(tokens, persist) {
  try {
    const serialized = JSON.stringify({ ...tokens, obtainedAt: Date.now() });
    if (persist === "local") {
      localStorage.setItem(AUTH_STORAGE_KEY, serialized);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable (private browsing, quota) — the outer shell just
    // won't learn about this login; the dashboard itself still works.
  }
}

// Same storage key/shape as apps/web's src/lib/auth/guidanceSessionStore.ts.
// Written by the login page below on a successful guidance-api credential
// login, read back here (and by console/profile.html) so the dashboard's
// profile page can show it without another network round trip. Shared at
// top level (not scoped inside `page === "login"`) since more than one page
// needs it.
const GUIDANCE_SESSION_STORAGE_KEY = "shgap.guidanceSession.v1";

// Shared at top level (not scoped inside one `if (page === ...)` block)
// since every dashboard page, plus setupAddProductForm below, hits this
// same route proxy path (see apps/web/vite.config.ts's apiProxy).
const GUIDANCE_API_BASE = "/route";

// Bare filenames only (both login.html at interface/'s root and
// console/profile.html need this map, from two different relative depths —
// see each caller for how it prefixes/doesn't prefix "console/").
const ROLE_DASHBOARD_FILENAMES = {
  SHG: "dashboard-shg.html",
  RETAILER: "dashboard-retailer.html",
  CONSUMER: "dashboard-consumer.html",
  DISTRICT: "dashboard-district.html",
  STATE: "dashboard-state.html",
  AIONOS: "dashboard-aionos.html",
};

function persistGuidanceSession(email, passkey, info) {
  try {
    localStorage.setItem(GUIDANCE_SESSION_STORAGE_KEY, JSON.stringify({ email, passkey, info }));
  } catch {
    // Storage unavailable (private browsing, quota) — the outer shell just
    // won't learn about this login; the dashboard itself still works.
  }
}

function readGuidanceSession() {
  try {
    const raw = localStorage.getItem(GUIDANCE_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared product-catalog rendering (shg-dashboard + consumer-dashboard,
// retailer-dashboard's raw-materials view) — the static demo catalog this
// used to load from (data/products.json) has been removed. Not yet wired
// to a real backend endpoint; that's a follow-up step.
// ---------------------------------------------------------------------------

async function loadProductCatalog() {
  throw new Error("Product catalog is not yet connected to a backend.");
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Most recently touched commodity/catalog row first — every select route
// (inference/route.py) returns rows in whatever order the database gives
// them, not sorted, so every place that lists them (a member's own
// listing, a supervisory dashboard's approve/reject table) sorts by this
// same "modified" column itself. Mutates and returns `rows` in place, same
// as Array.prototype.sort, so callers can use it inline.
function sortByModifiedDesc(rows) {
  return rows.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
}

// The retailer's own commodity icon (an ingot silhouette) — mirrors
// CommodityIcon.tsx in apps/web and the placeholder shown in the
// add-product upload zone on dashboard-retailer.html.
const COMMODITY_PLACEHOLDER_ICON_PATH = "M7 5H13L16 8V15H4V8Z";

// The SHG's own catalog icon (a coin, its inner ring a fillRule="evenodd"
// cutout) — mirrors CatalogIcon.tsx in apps/web and the placeholder shown
// in the add-product upload zone on dashboard-shg.html.
const CATALOG_PLACEHOLDER_ICON_PATH =
  "M10 17a7 7 0 1 0 0-14a7 7 0 1 0 0 14ZM10 13.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z";

// Read-only "commodity/catalog" row card — same detailed field-grid layout
// buildFilledCard's own add-product form uses (name/category, mfg/exp date,
// MRP, units, min/max qty, description, photo), plus a hover quantity
// stepper clamped to that row's min/max qty and defaulting to its min. The
// commodity and catalog tables share this exact row shape (see
// inference/tools/database.py), so this one card template covers both
// sides of the supply chain a member only browses rather than owns: the
// SHG dashboard's Items tab (browsing a retailer's commodity rows) and the
// consumer dashboard's Catalog tab (browsing an SHG's catalog rows) — a
// listing looks the same whichever side it's viewed from, just with the
// matching placeholder icon for whichever table it's reading from.
function buildSupplyRowCard(
  row,
  { iconPath = COMMODITY_PLACEHOLDER_ICON_PATH, relevantUuids } = {},
) {
  const minQty = Math.max(1, Number(row.min_qty_per_order) || 1);
  const maxQty = Math.max(minQty, Number(row.max_qty_per_order) || minQty);
  let qty = minQty;
  // func__select_commodity's relavence=true mode (inference/tools/database.py)
  // returns a list of uuids matching the viewer's dominant catalog category —
  // those rows get a rainbow-gradient photo frame instead of the default one.
  const isRelevantMatch = Boolean(relevantUuids?.has(row.uuid));

  const card = document.createElement("article");
  card.className = "card filled-product-card commodity-card";
  card.innerHTML = `
    <div class="filled-product-fields">
      <div class="filled-product-columns">
        <div class="filled-product-col">
          <div class="filled-field"><span>Product Name</span><span>${row.product_name}</span></div>
          <div class="filled-field"><span>Product Category</span><span>${row.product_category}</span></div>
        </div>
        <div class="filled-product-col">
          <div class="filled-field"><span>Mfg. Date</span><span>${row.mfg_date}</span></div>
          <div class="filled-field"><span>Exp. Date</span><span>${row.exp_date}</span></div>
        </div>
        <div class="filled-product-col">
          <div class="filled-field"><span>MRP / Unit (₹)</span><span>${row.mrp_per_unit}</span></div>
          <div class="filled-field"><span>No. of Units</span><span>${row.n_units}</span></div>
        </div>
        <div class="filled-product-col">
          <div class="filled-field"><span>Min. Qty. / Order</span><span>${row.min_qty_per_order}</span></div>
          <div class="filled-field"><span>Max. Qty. / Order</span><span>${row.max_qty_per_order}</span></div>
        </div>
      </div>
      <div class="filled-field"><span>Product Description</span><span>${row.product_description}</span></div>
    </div>
    <div class="filled-product-photo${isRelevantMatch ? " is-relevant-match" : ""}">
      ${
        row.avatar
          ? `<img src="${row.avatar}" alt="${row.product_name}" />`
          : `
            <span class="add-product-upload-badge" aria-hidden="true">
              <!-- Falls back to this default per-table placeholder only when
                   the row itself has no uploaded avatar (see buildFilledCard/
                   supplyRowToFilledCardData, which read the same commodity/
                   catalog avatar column for a member's own products). -->
              <svg class="add-product-upload-icon" viewBox="0 0 20 20" aria-hidden="true">
                <path d="${iconPath}" fill="currentColor" fill-rule="evenodd" />
              </svg>
            </span>
          `
      }
      <div class="commodity-cart-overlay">
        <div class="commodity-cart-stepper">
          <button type="button" class="commodity-cart-btn minus" aria-label="Decrease order quantity">&minus;</button>
          <span class="commodity-cart-qty-wrap">
            <svg class="commodity-cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span class="commodity-cart-qty">${qty}</span>
          </span>
          <button type="button" class="commodity-cart-btn plus" aria-label="Increase order quantity">&plus;</button>
        </div>
      </div>
    </div>
  `;

  const qtyEl = card.querySelector(".commodity-cart-qty");
  const minusBtn = card.querySelector(".commodity-cart-btn.minus");
  const plusBtn = card.querySelector(".commodity-cart-btn.plus");

  function syncButtons() {
    minusBtn.disabled = qty <= minQty;
    plusBtn.disabled = qty >= maxQty;
  }
  minusBtn.addEventListener("click", () => {
    qty = Math.max(minQty, qty - 1);
    qtyEl.textContent = qty;
    syncButtons();
  });
  plusBtn.addEventListener("click", () => {
    qty = Math.min(maxQty, qty + 1);
    qtyEl.textContent = qty;
    syncButtons();
  });
  syncButtons();

  return card;
}

function renderSupplyRowGrid(container, rows, options) {
  container.innerHTML = "";
  rows.forEach((row) => container.appendChild(buildSupplyRowCard(row, options)));
}

if (page === "index") {
  // Wikipedia's own text on SHGs, scraped server-side (inference/tools/scrape.py)
  // rather than hardcoded here, so an edit to that page is reflected without a
  // frontend deploy. The route returns a list of paragraph strings to unpack.
  const ABOUT_SHG_SOURCE_URL = "https://en.wikipedia.org/wiki/Self-help_group_(finance)";

  async function loadAboutShg() {
    const container = document.getElementById("about-shg-content");
    if (!container) return;

    try {
      const response = await fetch(
        `${GUIDANCE_API_BASE}/scrape/url/${encodeURIComponent(ABOUT_SHG_SOURCE_URL)}`,
      );
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      const paragraphs = await response.json();

      container.innerHTML = "";
      if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
        container.innerHTML = '<p class="about-shg-status">No content available right now.</p>';
        return;
      }

      paragraphs.forEach((paragraph) => {
        const p = document.createElement("p");
        p.textContent = paragraph;
        container.appendChild(p);
      });
    } catch {
      container.innerHTML =
        '<p class="about-shg-status">Unable to load this content right now.</p>';
    }
  }

  loadAboutShg();

  const slides = document.querySelectorAll(".hero-slide");
  const dots = document.querySelectorAll(".hero-slider-dot");
  let activeSlide = 0;

  // Slides move right-to-left: the incoming slide is parked off-screen to
  // the right (transition disabled for that jump), then both it and the
  // outgoing slide are animated one step to the left — incoming goes from
  // the right edge to center, outgoing goes from center to the left edge —
  // so the whole strip appears to travel in one consistent direction.
  function showSlide(index) {
    const outgoing = slides[activeSlide];
    const incoming = slides[index];

    dots[activeSlide]?.classList.remove("is-active");
    dots[index]?.classList.add("is-active");

    if (incoming && incoming !== outgoing) {
      incoming.style.transition = "none";
      incoming.style.transform = "translateX(100%)";
      incoming.getBoundingClientRect(); // force reflow before re-enabling the transition
      incoming.style.transition = "";
      incoming.style.transform = "translateX(0)";
      incoming.classList.add("is-active");
    }
    if (outgoing && outgoing !== incoming) {
      outgoing.style.transform = "translateX(-100%)";
      outgoing.classList.remove("is-active");
    }

    activeSlide = index;
  }

  if (slides.length > 1) {
    let autoSlide = setInterval(() => showSlide((activeSlide + 1) % slides.length), 4500);

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        clearInterval(autoSlide);
        showSlide(index);
        autoSlide = setInterval(() => showSlide((activeSlide + 1) % slides.length), 4500);
      });
    });
  }
}

if (page === "login") {
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  const passwordForm = document.getElementById("passwordForm");
  const submitBtn = passwordForm.querySelector('button[type="submit"]');
  const stepPanels = [...document.querySelectorAll(".step-panel")];

  function goToStep(step) {
    stepPanels.forEach((panel) =>
      panel.classList.toggle("active", Number(panel.dataset.step) === step),
    );
  }

  const loginToast = document.getElementById("loginToast");
  let loginToastTimer = null;

  function showLoginToast(message, variant) {
    loginToast.textContent = message;
    loginToast.classList.toggle("login-toast--neutral", variant === "neutral");
    loginToast.classList.toggle("login-toast--dark", variant === "dark");
    loginToast.hidden = false;
    clearTimeout(loginToastTimer);
    loginToastTimer = setTimeout(() => {
      loginToast.hidden = true;
    }, 2000);
  }

  function titleCase(text) {
    return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  }

  // Which authority an unauthenticated account should be told to contact —
  // the state authority for retailer/consumer accounts, else the generic
  // message.
  function resolveAuthority(info) {
    const role = (info.role || "").toUpperCase();
    if (role === "RETAILER" || role === "CONSUMER") {
      return "Andhra Pradesh State Authority";
    }
    return "the respective authority";
  }

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const passkey = passwordInput.value;

    if (!email || !passkey) {
      showLoginToast("Kindly enter the credentials to login");
      return;
    }

    submitBtn.disabled = true;
    try {
      const response = await fetch(
        `${GUIDANCE_API_BASE}/select/credential/email/${encodeURIComponent(email)}/passkey/${encodeURIComponent(passkey)}`,
      );
      const records = await response.json().catch(() => []);

      if (!Array.isArray(records) || records.length === 0) {
        // Government portal addresses (see inference/tools/database.py's
        // func__init_credential, which seeds one per district plus this
        // state-level one) aren't real self-service sign-ups — an
        // unmatched one means its credentials haven't been provisioned
        // yet, not "go register", so this branches before the registration
        // fallback below.
        if (email === "sAP.037@ap.gov.in") {
          showLoginToast("Login Credentials are Missing. Kindly contact Support Authority", "dark");
          return;
        }
        if (email.endsWith("@ap.gov.in")) {
          showLoginToast(
            "Login Credentials are Missing. Kindly contact Andhra Pradesh State Authority",
            "neutral",
          );
          return;
        }

        // No matching account — straight to the registration step.
        goToStep(2);
        return;
      }

      const record = records[0];
      const info = Array.isArray(record.info) ? record.info[0] : (record.info ?? {});

      if (record.is_authenticated === 0) {
        const authority = resolveAuthority(info);
        showLoginToast(`Account yet to be authenticated. Kindly contact ${authority}.`, "neutral");
        return;
      }

      if (record.is_authenticated === -1) {
        const authority = resolveAuthority(info);
        showLoginToast(`Account yet to be authenticated. Kindly contact ${authority}.`, "dark");
        return;
      }

      persistGuidanceSession(email, passkey, info);

      // The AIONOS account (see inference/tools/database.py's
      // func__init_credential) carries no `role` at all, just an
      // `organisation` — it's identified that way instead rather than
      // adding a role to the seeded credential itself.
      const effectiveRole = info.role || (info.organisation === "AIONOS" ? "AIONOS" : "");
      const dashboardFilename = ROLE_DASHBOARD_FILENAMES[effectiveRole.toUpperCase()];
      if (dashboardFilename) {
        // The persistent app shell keeps its header/footer/nav mounted
        // outside this iframe — navigating this window (not window.top)
        // keeps the shell in place and moves only the iframe's own content.
        window.location.href = `console/${dashboardFilename}`;
      } else {
        showLoginToast(
          `Login successful (${effectiveRole || "this role"} doesn't have a dashboard here yet).`,
        );
      }
    } catch (err) {
      showLoginToast("Could not reach the server. Please try again.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Registration step's photo picker — clicking the placeholder avatar opens
  // the hidden file input next to it, and the chosen image replaces the
  // placeholder in place (same read-as-data-URL pattern as the "Add Product"
  // image upload further down this file).
  const avatarUploadBtn = document.getElementById("avatarUploadBtn");
  const avatarUploadInput = document.getElementById("avatarUploadInput");
  const avatarPreview = document.getElementById("avatarPreview");
  // Required at submit (see the checkValidity() || !registrationAvatarDataUrl
  // gate below) but, like the Add Product image, can't be enforced via a
  // native `required` on the file input since it's `hidden` (see markup).
  let registrationAvatarDataUrl = null;
  avatarUploadBtn.addEventListener("click", () => avatarUploadInput.click());
  avatarUploadInput.addEventListener("change", () => {
    const file = avatarUploadInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      avatarPreview.src = reader.result;
      registrationAvatarDataUrl = reader.result;
    };
    reader.readAsDataURL(file);
  });

  // Operation Mode has no default *checked* radio, but the fields below it
  // default to the Individual set until Community is explicitly chosen —
  // switching back to Individual afterwards reverts them.
  const operationModeInputs = [...document.querySelectorAll('input[name="operationMode"]')];
  const individualFields = document.getElementById("individualFields");
  const communityFields = document.getElementById("communityFields");
  const memberNameInput = document.getElementById("memberName");
  const entityNameInput = document.getElementById("entityName");
  const memberNamesInput = document.getElementById("memberNames");
  operationModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const isCommunity = input.value === "COMMUNITY";
      individualFields.hidden = isCommunity;
      communityFields.hidden = !isCommunity;
      // `required` has to follow `hidden` here, not just live in the static
      // markup — a required field left behind in a hidden section still
      // fails the form's checkValidity() even though it's invisible and
      // unreachable, so it would silently block every submit.
      memberNameInput.required = !isCommunity;
      entityNameInput.required = isCommunity;
      memberNamesInput.required = isCommunity;
    });
  });

  // "Redirects to the login page" — this step lives inside login.html
  // itself, so that's just switching back to step 1 rather than a full
  // navigation. `novalidate` on the form (see login.html) suppresses the
  // browser's own "please fill this out" bubble — checkValidity() (not
  // reportValidity()) still gates this on the required fields, it just does
  // it silently: an incomplete form leaves the click with no visible effect
  // at all, rather than surfacing which field is missing.
  const registrationForm = document.getElementById("registrationForm");
  const registrationSubmitBtn = registrationForm.querySelector('button[type="submit"]');
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!registrationForm.checkValidity() || !registrationAvatarDataUrl) return;

    const isCommunity = communityFields.hidden === false;
    const info = [
      {
        avatar: registrationAvatarDataUrl,
        role: registrationForm.registrationOperation.value,
        mode: titleCase(registrationForm.operationMode.value),
        name: isCommunity ? entityNameInput.value : memberNameInput.value,
        contact: document.getElementById("contactNumber").value,
        address: document.getElementById("addressInput").value,
        pincode: document.getElementById("pinCodeInput").value,
        nationality: document.getElementById("nationalityInput").value,
      },
    ];

    const email = emailInput.value.trim();
    const passkey = passwordInput.value;

    registrationSubmitBtn.disabled = true;
    try {
      const response = await fetch(`${GUIDANCE_API_BASE}/insert/credential`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, passkey, info: JSON.stringify(info) }),
      });
      await response.json().catch(() => []);
      goToStep(1);
    } catch (err) {
      showLoginToast("Could not reach the server. Please try again.");
    } finally {
      registrationSubmitBtn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Dashboard tab/panel switching (interface/console/*.html's `.shg-tab` /
// `.shg-panel` pairs) — shared by all three dashboards, since Retailer and
// Consumer now also carry a hidden "profile" tab/panel pair (see below)
// even though they only ever had one visible tab of their own before this.
// `.shg-tabs` itself is CSS-hidden (see styles.css) — apps/web's
// DashboardNav.tsx mirrors these same buttons in the outer shell's own nav
// and forwards clicks down to the real ones here (LandingPage.tsx's
// handleDashboardTabClick), so this stays the one place that actually
// switches panels.
// ---------------------------------------------------------------------------

function setupDashboardTabSwitching(onDisabledTabClick) {
  const tabs = [...document.querySelectorAll(".shg-tab")];
  const panels = [...document.querySelectorAll(".shg-panel")];

  function activate(tab) {
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    panels.forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab),
    );
    // The Catalog panel's "Add Product" card measures its own natural
    // position (see alignToNavIconSpan) to align itself with the outer
    // nav's icons — a measurement that only means anything once its panel
    // is actually visible (display:block), not display:none behind
    // whichever tab loaded active by default (now "profile", not
    // "catalog"). Reusing the existing resize listener re-runs that
    // measurement now that it can get a real answer, instead of adding a
    // second, separate "recompute on tab switch" path.
    window.dispatchEvent(new Event("resize"));
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.classList.contains("shg-tab-disabled")) {
        onDisabledTabClick?.(tab);
        return;
      }
      activate(tab);
    });
  });
}

// Profile panel (interface/console/*.html's own [data-panel="profile"]) — a
// plain panel switched to the same way Catalog/Items are, not a popup, so
// the dashboard's own outer nav (apps/web's DashboardNav.tsx) stays exactly
// as it is underneath. Same field order as the registration form (see
// login.html): avatar, then email/passkey, then role/mode/name/contact/
// address/pincode/nationality exactly as submitted.
function setupProfilePanel() {
  const session = readGuidanceSession();
  if (!session) return;

  const info = session.info || {};

  document.getElementById("profileAvatar").src = info.avatar || "/guest-avatar.svg";
  document.getElementById("profileEmail").value = session.email || "";
  document.getElementById("profilePasskey").value = session.passkey || "";
  document.getElementById("profileRole").value = info.role || "";
  document.getElementById("profileMode").value = info.mode || "";
  document.getElementById("profileName").value = info.name || "";
  document.getElementById("profileContact").value = info.contact || "";
  document.getElementById("profileAddress").value = info.address || "";
  document.getElementById("profilePincode").value = info.pincode || "";
  document.getElementById("profileNationality").value = info.nationality || "";
}

// ---------------------------------------------------------------------------
// "Add Product" card (SHG + Retailer dashboards' Catalog panel) — same
// markup/ids on both pages (see interface/console/*.html), and since
// they're never in the DOM together one function covers both instead of
// duplicating this per page. Neither dashboard has a real backend endpoint
// to create a product against yet, so submitting only validates the
// required fields and prepends a read-only "filled" card (see
// buildShowcaseCard below) straight into that page's own grid — nothing is
// actually persisted server-side.
// ---------------------------------------------------------------------------

// Sizes/positions the card so its own left/right edges sit exactly where
// the outer shell's nav bar starts and ends its icons (16px in from each
// side — px-3/sm:px-4 in apps/web/src/components/DashboardNav.tsx) —
// cancelling .page-shell's centered max-width column (see the CSS comment
// on .add-product-card). Deliberately done in JS with `clientWidth`
// rather than the usual `width: 100vw` CSS trick — that trick sizes
// against the *layout* viewport, which on a page with a reserved-space
// (non-overlay) scrollbar is wider than what's actually visible, throwing
// the inset off by the scrollbar's width. `clientWidth` always excludes
// the scrollbar.
const ADD_PRODUCT_NAV_ICON_INSET_PX = 16;

function alignToNavIconSpan(el) {
  if (!el) return;
  el.style.width = "";
  el.style.marginLeft = "";
  const naturalLeft = el.getBoundingClientRect().left;
  el.style.width = `${document.documentElement.clientWidth - ADD_PRODUCT_NAV_ICON_INSET_PX * 2}px`;
  el.style.marginLeft = `${ADD_PRODUCT_NAV_ICON_INSET_PX - naturalLeft}px`;
}

// Aligns the card, the divider below it (see interface/console/*.html's
// .add-product-divider), and every already-added .filled-product-card to
// the same span, so they all match the card's width exactly instead of
// following .page-shell's own (narrower, centered) content width — or, for
// the filled cards, #catalogGrid's per-tile column width.
function alignAddProductCardWidth() {
  alignToNavIconSpan(document.getElementById("addProductForm"));
  alignToNavIconSpan(document.querySelector(".add-product-divider"));
  document.querySelectorAll(".filled-product-card").forEach(alignToNavIconSpan);
}

// Once every required field is filled (the image is optional — a card
// with none falls back to the default placeholder, see buildFilledCard),
// wait exactly this long, then reveal the pale-teal blur and the +/-
// buttons together.
const ADD_PRODUCT_REVEAL_DELAY_MS = 2000;

// How long the confirm/cancel buttons stay in their dark "clicked" state
// before the actual add/discard runs — a brief confirmation flash, not an
// instant cut. The blur/icons are already showing by the time a click is
// even possible (the overlay only accepts pointer events once revealed),
// so this only needs to darken the button itself.
const ADD_PRODUCT_CONFIRM_FLASH_MS = 350;

function flashThenRun(button, action) {
  button.classList.add("is-clicked");
  window.setTimeout(() => {
    button.classList.remove("is-clicked");
    action();
  }, ADD_PRODUCT_CONFIRM_FLASH_MS);
}

// Read-only echo of the add-product form itself (see .filled-product-card
// in styles.css) — same label/value grid plus a circular photo, but with
// every field carrying the value the SHG member actually typed, rather
// than the original stacked shg-product-card look used elsewhere in the
// catalog grid. This is what actually shows up under the divider once +
// is clicked. Name/category/description/photo stay read-only, but
// mfg/exp date, MRP, units, and min/max qty are live inputs the member
// can edit any time — no separate "edit mode" needed for those. Hovering
// the card (see .filled-product-card:hover .add-product-confirm-overlay in
// styles.css) reveals Update (✕, just confirms/closes — the inputs above
// are already the live values) and Delete (−, calls the real DELETE route
// via data.uuid/data.entity when the card is backed by one) the same pair
// of buttons the top form itself uses for Add/Discard. Also used (via
// supplyRowToFilledCardData below) for a member's own already-persisted
// commodity/catalog rows fetched by email, so a product looks and behaves
// the same whether it was just added this session or loaded from the
// database.
function buildFilledCard(data) {
  const card = document.createElement("article");
  card.className = "card filled-product-card";
  card.innerHTML = `
    <div class="filled-product-fields">
      <div class="filled-product-columns">
        <div class="filled-product-col">
          <div class="filled-field"><span>Product Name</span><span>${data.name}</span></div>
          <div class="filled-field"><span>Product Category</span><span>${data.category}</span></div>
        </div>
        <div class="filled-product-col">
          <div class="filled-field">
            <span>Mfg. Date</span>
            <input type="text" placeholder="YYYY-MM-DD" data-field="mfgDate" value="${data.mfgDate}" />
          </div>
          <div class="filled-field">
            <span>Exp. Date</span>
            <input type="text" placeholder="YYYY-MM-DD" data-field="expDate" value="${data.expDate}" />
          </div>
        </div>
        <div class="filled-product-col">
          <div class="filled-field">
            <span>MRP / Unit (₹)</span>
            <input type="number" step="any" min="0" data-field="mrp" value="${data.mrp}" />
          </div>
          <div class="filled-field">
            <span>No. of Units</span>
            <input type="number" step="1" min="0" data-field="units" value="${data.units}" />
          </div>
        </div>
        <div class="filled-product-col">
          <div class="filled-field">
            <span>Min. Qty. / Order</span>
            <input type="number" step="1" min="1" data-field="minQty" value="${data.minQty}" />
          </div>
          <div class="filled-field">
            <span>Max. Qty. / Order</span>
            <input type="number" step="1" min="1" data-field="maxQty" value="${data.maxQty}" />
          </div>
        </div>
      </div>
      <div class="filled-field"><span>Product Description</span><span>${data.description}</span></div>
    </div>
    <div class="filled-product-photo${data.isAuthenticated === 0 ? " is-pending" : ""}">
      ${
        data.imageDataUrl
          ? `<img src="${data.imageDataUrl}" alt="${data.name}" />`
          : `
            <span class="add-product-upload-badge" aria-hidden="true">
              <svg class="add-product-upload-icon" viewBox="0 0 20 20" aria-hidden="true">
                <path d="${data.iconPath}" fill="currentColor" fill-rule="evenodd" />
              </svg>
            </span>
          `
      }
    </div>
    <div class="add-product-confirm-overlay">
      <button type="button" class="add-product-confirm-btn confirm" aria-label="Confirm edits">&times;</button>
      <button type="button" class="add-product-confirm-btn cancel" aria-label="Delete product">&minus;</button>
    </div>
  `;

  const updateBtn = card.querySelector(".add-product-confirm-btn.confirm");
  const deleteBtn = card.querySelector(".add-product-confirm-btn.cancel");

  // Unlike the add-product form's own overlay above (revealed once, timed,
  // by its own JS), this one shows purely on :hover (see
  // .filled-product-card:hover .add-product-confirm-overlay in styles.css)
  // — no press-and-hold, no explicit dismiss needed, since moving off the
  // card hides it again on its own.
  updateBtn.addEventListener("click", () => flashThenRun(updateBtn, () => {}));
  deleteBtn.addEventListener("click", () => {
    flashThenRun(deleteBtn, () => {
      // data.uuid is only set for a card backed by a real row (see
      // supplyRowToFilledCardData and addProduct's own post-insert
      // showCard) — falls back to a local-only removal otherwise, same as
      // before this card had any backend link at all.
      if (data.uuid) {
        fetch(`${GUIDANCE_API_BASE}/delete/${data.entity}/uuid/${encodeURIComponent(data.uuid)}`, {
          method: "POST",
        })
          .catch((err) => console.error(err))
          .finally(() => card.remove());
      } else {
        card.remove();
      }
    });
  });

  return card;
}

// Maps a commodity/catalog row (see inference/tools/database.py — both
// tables share this exact shape) to buildFilledCard's own data shape, for
// rendering a member's own already-persisted products with the same card
// used for ones just added this session. `imageDataUrl` comes straight off
// the row's own `avatar` column — null/undefined there (rows inserted
// before that column existed, or never given a photo) leaves it unset, so
// buildFilledCard falls back to the same commodity/catalog placeholder
// badge buildSupplyRowCard shows elsewhere rather than a generated
// per-product one. `entity` and the row's own `uuid` are what
// buildFilledCard's delete button needs to call the real DELETE route.
function supplyRowToFilledCardData(
  row,
  iconPath = COMMODITY_PLACEHOLDER_ICON_PATH,
  entity = "commodity",
) {
  return {
    name: row.product_name,
    category: row.product_category,
    mfgDate: row.mfg_date ?? "",
    expDate: row.exp_date ?? "",
    mrp: row.mrp_per_unit,
    units: row.n_units,
    minQty: row.min_qty_per_order,
    maxQty: row.max_qty_per_order,
    description: row.product_description,
    imageDataUrl: row.avatar || undefined,
    iconPath,
    isAuthenticated: row.is_authenticated,
    uuid: row.uuid,
    entity,
  };
}

function setupAddProductForm() {
  const form = document.getElementById("addProductForm");
  if (!form) return;

  const imageInput = document.getElementById("newProductImage");
  const uploadZone = document.getElementById("newProductUploadZone");
  const overlay = form.querySelector(".add-product-confirm-overlay");
  const confirmBtn = form.querySelector(".add-product-confirm-btn.confirm");
  const cancelBtn = form.querySelector(".add-product-confirm-btn.cancel");
  // Whichever grid this page has (#catalogGrid on SHG, #materialGrid on
  // Retailer) — the just-added product is prepended straight into it, just
  // under the divider (see interface/console/*.html), not persisted
  // anywhere real.
  const grid = document.getElementById("catalogGrid") || document.getElementById("materialGrid");
  // Which table (and matching default placeholder icon, see buildFilledCard)
  // this page's grid belongs to — consumer-dashboard also has a #catalogGrid,
  // but it has no #addProductForm, so reaching this line at all already
  // means SHG.
  const entity = grid && grid.id === "catalogGrid" ? "catalog" : "commodity";
  const iconPath =
    entity === "catalog" ? CATALOG_PLACEHOLDER_ICON_PATH : COMMODITY_PLACEHOLDER_ICON_PATH;
  let revealTimer = null;
  let lastImageDataUrl = null;

  function clearImagePreview() {
    uploadZone.querySelector("img")?.remove();
    uploadZone.classList.remove("has-image");
    lastImageDataUrl = null;
  }

  function cancelReveal() {
    window.clearTimeout(revealTimer);
    overlay.classList.remove("is-blurred", "show-icons");
  }

  function scheduleReveal() {
    revealTimer = window.setTimeout(() => {
      overlay.classList.add("is-blurred", "show-icons");
    }, ADD_PRODUCT_REVEAL_DELAY_MS);
  }

  // Drives the blur-then-icons reveal above and gates addProduct() below —
  // this is the form's real, live validity, recomputed on every field
  // change, not just at submit time. The image is required too, but checked
  // via lastImageDataUrl rather than a native `required` on the file input:
  // that input is `hidden` (see markup), and a hidden/display:none control is
  // barred from native constraint validation in most browsers, so
  // form.checkValidity() alone can't be trusted to enforce it.
  function updateValidityState() {
    const wasValid = form.classList.contains("is-valid");
    const nowValid = form.checkValidity() && Boolean(lastImageDataUrl);
    form.classList.toggle("is-valid", nowValid);
    if (nowValid && !wasValid) {
      scheduleReveal();
    } else if (!nowValid) {
      cancelReveal();
    }
  }

  function addProduct() {
    // checkValidity() (not reportValidity()) — still gates this on the
    // required fields, just without the native "Please fill out this
    // field" browser tooltip popping up. lastImageDataUrl is checked
    // alongside it for the same reason updateValidityState does — the file
    // input can't enforce this natively since it's hidden. In practice this
    // is only ever reachable already-valid (the confirm button only ever
    // shows once .is-valid is set, and the Enter-key path below checks it
    // too), but kept as the actual gate rather than trusting that indirectly.
    if (!form.checkValidity() || !lastImageDataUrl) return;
    if (grid) {
      const row = {
        product_name: document.getElementById("newProductName").value.trim(),
        product_category: document.getElementById("newProductCategory").value.trim(),
        product_description: document.getElementById("newProductDescription").value.trim(),
        mfg_date: document.getElementById("newProductMfgDate").value.trim(),
        exp_date: document.getElementById("newProductExpiry").value.trim(),
        mrp_per_unit: document.getElementById("newProductMrp").value,
        n_units: document.getElementById("newProductUnits").value,
        min_qty_per_order: document.getElementById("newProductMinQty").value,
        max_qty_per_order: document.getElementById("newProductMaxQty").value,
      };

      const avatar = lastImageDataUrl;

      function showCard(uuid) {
        const card = buildFilledCard({
          name: row.product_name,
          category: row.product_category,
          mfgDate: row.mfg_date,
          expDate: row.exp_date,
          mrp: row.mrp_per_unit,
          units: row.n_units,
          minQty: row.min_qty_per_order,
          maxQty: row.max_qty_per_order,
          description: row.product_description,
          imageDataUrl: avatar,
          iconPath,
          // The commodity/catalog insert always starts a new row at
          // is_authenticated: 0 (see func__insert_commodity/_catalog in
          // inference/tools/database.py) — pending a supervisory
          // dashboard's approve/reject, so the photo shows blurred until
          // then rather than waiting on a refetch to know that.
          isAuthenticated: 0,
          uuid,
          entity,
        });
        grid.prepend(card);
        // Needs the card in the DOM first — alignToNavIconSpan measures its
        // current getBoundingClientRect().left before overriding it.
        alignToNavIconSpan(card);
      }

      // Persists to the commodity/catalog table (see inference/route.py's
      // insert routes) before showing the card, scoped to whichever member
      // is logged in — sent as a JSON body (not a URL path) since `avatar`
      // is a base64 data URL, too large/unsafe for a path segment. Field
      // order (email, then avatar, then the row's own product_name/../
      // max_qty_per_order) matches cls__insert_commodity/cls__insert_catalog
      // in inference/route.py. Without a session (shouldn't happen in
      // practice, this page requires login) the card still shows locally
      // rather than silently doing nothing — just without a uuid, so its
      // own hover delete button falls back to a local-only removal (see
      // buildFilledCard).
      const email = readGuidanceSession()?.email;
      if (email) {
        fetch(`${GUIDANCE_API_BASE}/insert/${entity}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, avatar, ...row }),
        })
          .then((response) => response.json())
          .then((inserted) => showCard(Array.isArray(inserted) ? inserted[0]?.uuid : undefined))
          .catch((err) => {
            console.error(err);
            showCard();
          });
      } else {
        console.warn("No logged-in email — product shown locally only, not persisted.");
        showCard();
      }
    }
    form.reset();
    clearImagePreview();
    updateValidityState();
  }

  function discardProduct() {
    form.reset();
    clearImagePreview();
    updateValidityState();
  }

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      lastImageDataUrl = reader.result;
      // Same <img> markup/style buildFilledCard uses for a real photo post-
      // insert (.add-product-upload img, .filled-product-photo img in
      // styles.css) — so the preview here already looks like the card it's
      // about to become, not a different full-bleed treatment.
      let preview = uploadZone.querySelector("img");
      if (!preview) {
        preview = document.createElement("img");
        preview.alt = "";
        uploadZone.appendChild(preview);
      }
      preview.src = reader.result;
      uploadZone.classList.add("has-image");
      // The form-level "change" listener below also calls this, but it fires
      // synchronously on the input event — before this async FileReader
      // callback has set lastImageDataUrl — so validity would still read as
      // false at that point. Re-run it now that the image is actually ready.
      updateValidityState();
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener("input", updateValidityState);
  form.addEventListener("change", updateValidityState);

  confirmBtn.addEventListener("click", () => flashThenRun(confirmBtn, addProduct));
  cancelBtn.addEventListener("click", () => flashThenRun(cancelBtn, discardProduct));

  // Keyboard path (e.g. Enter in a text field) — same validity gate,
  // immediate rather than the buttons' own click flash since it doesn't
  // go through either button.
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addProduct();
  });

  updateValidityState();
  alignAddProductCardWidth();
  window.addEventListener("resize", alignAddProductCardWidth);
}

if (page === "shg-dashboard") {
  const rawMaterialsGrid = document.getElementById("rawMaterialsGrid");
  const itemsEmptyState = document.getElementById("itemsEmptyState");
  const catalogGrid = document.getElementById("catalogGrid");
  const insightToggle = document.getElementById("insightSelectToggle");
  const insightSummary = document.getElementById("insightSelectSummary");
  const insightOptionsPanel = document.getElementById("insightSelectOptions");
  const insightPanel = document.getElementById("insightPanel");
  const toast = document.getElementById("shgToast");
  let toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }

  setupAddProductForm();
  // Each disabled tab carries its own reason in its title attribute (see the
  // markup above) rather than one message hardcoded here, since there's now
  // more than one disabled tab with different reasons.
  setupDashboardTabSwitching((tab) => {
    if (tab.title) showToast(tab.title);
  });
  setupProfilePanel();

  // Items/raw-materials is what retailers list as commodities — the
  // "Retailer=Commodity / SHG=Catalog" split this dashboard's own add-product
  // upload icon comment refers to — so unlike Catalog/Insights below (still
  // on the un-migrated xlsx-derived loadProductCatalog() stub), this tab
  // fetches straight from the commodity table, scoped to this SHG's own
  // role. Rendered with buildSupplyRowCard/renderSupplyRowGrid (see above) —
  // the same detailed field-grid template + hover quantity stepper the
  // consumer dashboard's own Catalog tab uses for the catalog table's
  // identically-shaped rows, so a listing looks the same whichever side of
  // the supply chain it's browsed from. Uses that function's default
  // (commodity/ingot) placeholder icon, since these rows are commodities.

  function renderRawMaterials(rows, relevantUuids) {
    renderSupplyRowGrid(rawMaterialsGrid, rows, { relevantUuids });
    itemsEmptyState.hidden = rows.length > 0;
  }

  function loadRawMaterials() {
    const info = { role: "SHG" };
    const email = readGuidanceSession()?.email;
    fetch(
      `${GUIDANCE_API_BASE}/select/commodity/info/${encodeURIComponent(JSON.stringify(info))}?relavence=true${email ? `&email=${encodeURIComponent(email)}` : ""}`,
    )
      .then((response) => response.json())
      .then((payload) => {
        // relavence=true makes func__select_commodity (inference/tools/database.py)
        // reply as {reqres: [...rows], relavence: [...uuid]} instead of a bare row
        // array — the uuid list is what the SHG's dominant catalog category matches.
        // Rows are still returned bare (no relavence key) from any other branch of
        // that endpoint, so keep tolerating a plain array too.
        const isWrapped = payload && !Array.isArray(payload) && Array.isArray(payload.reqres);
        const rows = isWrapped ? payload.reqres : Array.isArray(payload) ? payload : [];
        const relevantUuids = new Set(isWrapped ? payload.relavence : []);
        const sorted = [...rows].sort(
          (a, b) => Number(relevantUuids.has(b.uuid)) - Number(relevantUuids.has(a.uuid)),
        );
        renderRawMaterials(sorted, relevantUuids);
      })
      .catch((err) => {
        console.error(err);
        renderRawMaterials([], new Set());
      });
  }

  // Renders one insight block per selected product (stacked), now that
  // Select Products allows more than one at a time — each video keeps its
  // own click-to-load handler via data attributes instead of a single
  // shared #insightVideoPlayer id.
  function renderInsightPanel(products) {
    if (products.length === 0) {
      insightPanel.innerHTML =
        '<p class="helper-text">Select at least one product to see its insights.</p>';
      return;
    }

    insightPanel.innerHTML = products
      .map(
        (product) => `
          <div class="shg-insight-block">
            <div>
              <div class="shg-insight-field">
                <p class="shg-insight-label">Product</p>
                <p class="shg-insight-value">${product.name}</p>
              </div>
              <div class="shg-insight-field">
                <p class="shg-insight-label">Category</p>
                <p class="shg-insight-value">${product.category}</p>
              </div>
              <div class="shg-insight-field">
                <p class="shg-insight-label">Description</p>
                <p class="shg-insight-value">${product.description}</p>
              </div>
              <div class="shg-insight-field">
                <p class="shg-insight-label">Insight</p>
                <p class="shg-insight-value">${product.insight}</p>
              </div>
              <div class="shg-insight-field">
                <p class="shg-insight-label">Peak Season</p>
                <p class="shg-insight-value">${product.season}</p>
              </div>
            </div>
            <div class="shg-video-wrap">
              <p class="shg-insight-label">Making Video</p>
              ${
                product.videoId
                  ? `
                    <div class="shg-video-player" data-video-id="${product.videoId}" data-product-name="${product.name}">
                      <img
                        src="https://img.youtube.com/vi/${product.videoId}/hqdefault.jpg"
                        alt="How ${product.name} is made — video thumbnail"
                        class="shg-video-thumb"
                      />
                      <div class="shg-video-play">&#9658;</div>
                      <span class="shg-video-caption">How ${product.name} is made</span>
                    </div>
                  `
                  : `<p class="shg-insight-value">No video available for this product.</p>`
              }
            </div>
          </div>
        `,
      )
      .join("");

    // Click-to-load: the real YouTube embed only loads once the user asks
    // for it, instead of loading a hidden iframe for every product upfront.
    // { once: true } and the shg-video-playing class (see styles.css) matter
    // here — without them, a click on the iframe's own pause/seek controls
    // re-triggers this handler and replaces the iframe with a fresh
    // autoplaying one, making the video impossible to pause.
    insightPanel.querySelectorAll(".shg-video-player").forEach((player) => {
      player.addEventListener(
        "click",
        (event) => {
          const target = event.currentTarget;
          target.classList.add("shg-video-playing");
          target.innerHTML = `
            <iframe
              src="https://www.youtube.com/embed/${target.dataset.videoId}?autoplay=1"
              title="How ${target.dataset.productName} is made"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          `;
        },
        { once: true },
      );
    });
  }

  // Custom checkbox dropdown (native <select multiple> would force an
  // always-open listbox instead of the closed dropdown this page uses) —
  // click the toggle to open/close, check any number of products, and the
  // insight panel re-renders with one block per checked product.
  function renderInsightSelect(products) {
    const productsById = new Map(products.map((product) => [product.id, product]));

    function selectedIds() {
      return [...insightOptionsPanel.querySelectorAll('input[type="checkbox"]:checked')].map(
        (checkbox) => checkbox.value,
      );
    }

    function updateSummary(ids) {
      if (ids.length === 0) {
        insightSummary.textContent = "Select products";
      } else if (ids.length <= 2) {
        insightSummary.textContent = ids.map((id) => productsById.get(id).name).join(", ");
      } else {
        insightSummary.textContent = `${ids.length} products selected`;
      }
    }

    function refresh() {
      const ids = selectedIds();
      updateSummary(ids);
      renderInsightPanel(ids.map((id) => productsById.get(id)));
    }

    insightOptionsPanel.innerHTML = products
      .map(
        (product, index) => `
          <label class="shg-multiselect-option">
            <input type="checkbox" value="${product.id}" ${index === 0 ? "checked" : ""} />
            <span>${product.name}</span>
          </label>
        `,
      )
      .join("");

    insightOptionsPanel
      .querySelectorAll('input[type="checkbox"]')
      .forEach((checkbox) => checkbox.addEventListener("change", refresh));

    insightToggle.addEventListener("click", () => {
      const willOpen = insightOptionsPanel.hidden;
      insightOptionsPanel.hidden = !willOpen;
      insightToggle.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("click", (event) => {
      if (!insightToggle.parentElement.contains(event.target)) {
        insightOptionsPanel.hidden = true;
        insightToggle.setAttribute("aria-expanded", "false");
      }
    });

    refresh();
  }

  loadRawMaterials();

  // The SHG's own Catalog tab — this member's own already-added products,
  // fetched by their own email (unlike the Items tab above, which browses
  // a retailer's rows by role) so the listing survives a reload instead of
  // only ever showing whatever the add-product form added this session.
  // Rendered with buildFilledCard/supplyRowToFilledCardData (see above), the
  // same template addProduct() itself uses for a just-added product, so a
  // product looks and behaves the same whether it's fresh this session or
  // loaded from the database.
  function loadOwnCatalog() {
    const session = readGuidanceSession();
    if (!session?.email) return;
    fetch(`${GUIDANCE_API_BASE}/select/catalog/email/${encodeURIComponent(session.email)}`)
      .then((response) => response.json())
      .then((rows) => {
        sortByModifiedDesc(Array.isArray(rows) ? rows : []).forEach((row) => {
          const card = buildFilledCard(
            supplyRowToFilledCardData(row, CATALOG_PLACEHOLDER_ICON_PATH, "catalog"),
          );
          catalogGrid.appendChild(card);
          alignToNavIconSpan(card);
        });
      })
      .catch((err) => console.error(err));
  }
  loadOwnCatalog();

  // Insight picker lists every product in the full xlsx catalog (all
  // categories, not just pickles) — it's a separate exploration tool,
  // unrelated to the storefront catalog above.
  loadProductCatalog()
    .then((products) => renderInsightSelect(products))
    .catch((err) => {
      console.error(err);
    });
}

if (page === "consumer-dashboard") {
  // This is the consumer-facing view of what SHGs have placed for sale —
  // fetched straight from the catalog table, scoped to the "consumer" role
  // (func__select_catalog's own consumer branch), not the xlsx-derived
  // loadProductCatalog() stub the SHG dashboard's own Catalog tab still
  // uses. Rendered with buildSupplyRowCard/renderSupplyRowGrid (see above) —
  // the same detailed field-grid template + hover quantity stepper the SHG
  // dashboard's own Items tab uses for the commodity table's identically-
  // shaped rows, so a listing looks the same whichever side of the supply
  // chain it's browsed from — but with the catalog (coin) placeholder icon
  // instead of the commodity (ingot) one, since these rows come from the
  // catalog table, not commodity.
  const catalogGrid = document.getElementById("catalogGrid");
  const itemsEmptyState = document.getElementById("itemsEmptyState");

  setupDashboardTabSwitching();
  setupProfilePanel();

  const info = { role: "consumer" };
  fetch(`${GUIDANCE_API_BASE}/select/catalog/info/${encodeURIComponent(JSON.stringify(info))}`)
    .then((response) => response.json())
    .then((rows) => {
      const products = Array.isArray(rows) ? rows : [];
      renderSupplyRowGrid(catalogGrid, products, { iconPath: CATALOG_PLACEHOLDER_ICON_PATH });
      itemsEmptyState.hidden = products.length > 0;
    })
    .catch((err) => {
      console.error(err);
    });
}

if (page === "retailer-dashboard") {
  // Retailer is the top of this demo's supply chain — it only has a
  // Catalog (what it supplies to the SHG), no "items" tab, since there's no
  // layer above it to fetch from.
  const materialGrid = document.getElementById("materialGrid");

  setupAddProductForm();
  setupDashboardTabSwitching();
  setupProfilePanel();

  // This retailer's own already-added commodities, fetched by their own
  // email (there's only ever one retailer viewing this page, so email — not
  // role — is what scopes "mine") so the listing survives a reload instead
  // of only ever showing whatever the add-product form added this session.
  // Rendered with buildFilledCard/supplyRowToFilledCardData (see above), the
  // same template addProduct() itself uses for a just-added product, so a
  // product looks and behaves the same whether it's fresh this session or
  // loaded from the database.
  function loadOwnCommodities() {
    const session = readGuidanceSession();
    if (!session?.email) return;
    fetch(`${GUIDANCE_API_BASE}/select/commodity/email/${encodeURIComponent(session.email)}`)
      .then((response) => response.json())
      .then((rows) => {
        sortByModifiedDesc(Array.isArray(rows) ? rows : []).forEach((row) => {
          const card = buildFilledCard(supplyRowToFilledCardData(row));
          materialGrid.appendChild(card);
          alignToNavIconSpan(card);
        });
      })
      .catch((err) => console.error(err));
  }
  loadOwnCommodities();
}

if (page === "district-dashboard" || page === "state-dashboard" || page === "aionos-dashboard") {
  // Supervisory dashboards — apps/web's DashboardRoleNav renders each
  // role's own credential/commodity/catalog items as a colored avatar's
  // dropdown instead of a flat tab row, but every item is still just
  // another .shg-tab/.shg-panel pair underneath (see
  // interface/console/dashboard-{district,state,aionos}.html), so the same
  // tab-switching + toast machinery every other dashboard uses covers them
  // too. Configuration/Cart are marked shg-tab-disabled and just toast,
  // same "Coming Soon" convention as any other not-yet-built tab.
  const toast = document.getElementById("roleNavToast");
  let toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }

  setupDashboardTabSwitching((tab) => {
    if (tab.title) showToast(tab.title);
  });

  // Each avatar's own "Credential" tab queries guidance-api's info-only
  // credential route (inference/route.py — no email/passkey needed, since
  // this is a supervisory lookup by role, not a login) and tabulates
  // whatever comes back. Fetched once per role and cached via the panel's
  // own dataset flag so re-clicking a tab doesn't re-hit the API.
  const ROLE_QUERY_BY_AVATAR_ROLE = { shg: "SHG" };

  // A district authority only administers its own district's SHGs, so its
  // SHG-avatar credential lookup is scoped to it — same {role, district_name}
  // shape inference/tools/database.py's func__select_credential expects for
  // a district-scoped query. State/AIONOS dashboards see every district, so
  // this stays null there.
  const currentDistrictName =
    page === "district-dashboard" ? readGuidanceSession()?.info?.district_name : null;

  // Raw as the API returned it — one row per record, `info` shown as its
  // own column (not broken down into one column per field), no relabeling,
  // no "—" placeholders, no field-level filtering. Admin-only dashboards,
  // so every column (passkey included) is shown as-is.
  function credentialCellValue(value) {
    if (typeof value === "object" && value !== null) return JSON.stringify(value);
    return String(value);
  }

  // Shared by the credential/commodity/catalog panels below — same table
  // markup and same floating approve/reject hover control, just pointed at
  // a different update route and refresh callback per entity. `avatarRole`
  // drives the same district-dashboard view-only rule credential always
  // had: a district authority only administers its own district's SHGs, so
  // only the SHG-avatar panel gets the hover control there — state/aionos
  // see every avatar's panel and keep it everywhere.
  function renderApprovableTable(panel, records, { avatarRole, entity, onRefresh }) {
    const rows = sortByModifiedDesc(Array.isArray(records) ? records : []);

    if (rows.length === 0) {
      panel.innerHTML = "";
      return;
    }

    const columns = [];
    const seen = new Set();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (seen.has(key)) return;
        seen.add(key);
        columns.push(key);
      });
    });

    panel.innerHTML = `
      <div class="news-table-wrap">
        <table class="news-table shg-credential-table">
          <thead>
            <tr>
              ${columns.map((key) => `<th>${escapeXml(key)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
              <tr data-uuid="${escapeXml(credentialCellValue(row.uuid))}">
                ${columns.map((key) => `<td${key === "is_authenticated" ? ' data-col="is_authenticated"' : ""}>${escapeXml(credentialCellValue(row[key]))}</td>`).join("")}
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    // District dashboards restrict the hover approve/reject control to the
    // SHG-avatar panel; every other avatar's panel there is view-only.
    // State/AIONOS oversee multiple avatars, so they get the hover control
    // on all of them.
    if (avatarRole !== "SHG" && page === "district-dashboard") return;

    // One floating +/- pair, repositioned over whichever row is hovered,
    // rather than a permanently-reserved actions column that would sit
    // there (visibly) even when nothing is hovered.
    const wrap = panel.querySelector(".news-table-wrap");
    const rowActions = document.createElement("div");
    rowActions.className = "shg-credential-row-actions";
    rowActions.innerHTML = `
      <button type="button" class="shg-credential-action-btn confirm" aria-label="Approve"></button>
      <button type="button" class="shg-credential-action-btn cancel" aria-label="Reject"></button>
    `;
    wrap.appendChild(rowActions);

    // Delegated rather than one mouseenter/mouseleave pair per cell: since
    // rowActions is centered directly over whichever cell it's showing for,
    // it (or its buttons) can end up the topmost element under the cursor,
    // which would make a plain per-cell mouseleave fire the instant the
    // buttons themselves are hovered — hiding them right as you try to
    // click. Checking event.target instead only ever hides/moves it when
    // the pointer is genuinely over a *different* cell (or none), and never
    // reacts to the pointer moving onto rowActions itself. The blur is
    // driven off this same tracked cell (an `.is-cell-active` class) rather
    // than plain CSS td:hover, for the same reason: hovering the buttons
    // — a sibling of the cell, not a descendant — wouldn't otherwise keep
    // the cell itself matching :hover, and the blur would drop right as
    // the cursor reached them.
    let activeCell = null;

    function setActiveCell(cell) {
      if (cell === activeCell) return;
      if (activeCell) activeCell.classList.remove("is-cell-active");
      activeCell = cell;
      if (activeCell) activeCell.classList.add("is-cell-active");
    }

    wrap.addEventListener("mouseover", (event) => {
      if (event.target.closest(".shg-credential-row-actions")) return;
      const cell = event.target.closest('td[data-col="is_authenticated"]');
      if (!cell) {
        setActiveCell(null);
        rowActions.classList.remove("is-visible");
        return;
      }
      setActiveCell(cell);
      const cellRect = cell.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      rowActions.style.top = `${cellRect.top - wrapRect.top + wrap.scrollTop + cellRect.height / 2}px`;
      rowActions.style.left = `${cellRect.left - wrapRect.left + wrap.scrollLeft + cellRect.width / 2}px`;
      rowActions.classList.add("is-visible");
    });
    wrap.addEventListener("mouseleave", () => {
      setActiveCell(null);
      rowActions.classList.remove("is-visible");
    });

    // Approve/reject call the update route and then re-run the same
    // select query, so the table always reflects what the database
    // actually holds rather than an optimistic local edit.
    function updateAuthentication(isAuthenticated) {
      if (!activeCell) return;
      const uuid = activeCell.closest("tr").dataset.uuid;
      rowActions.classList.remove("is-visible");
      fetch(
        `${GUIDANCE_API_BASE}/update/${entity}/uuid/${encodeURIComponent(uuid)}/is_authenticated/${encodeURIComponent(isAuthenticated)}`,
        { method: "POST" },
      )
        .catch(() => {})
        .finally(onRefresh);
    }

    rowActions.querySelector(".confirm").addEventListener("click", () => updateAuthentication(1));
    rowActions.querySelector(".cancel").addEventListener("click", () => updateAuthentication(-1));
  }

  function renderCredentialTable(panel, records, role) {
    renderApprovableTable(panel, records, {
      avatarRole: role,
      entity: "credential",
      onRefresh: () => fetchAndRenderCredentials(panel, role),
    });
  }

  function fetchAndRenderCredentials(panel, role) {
    panel.innerHTML = `
      <div class="shg-credential-loading">
        <div class="shg-credential-spinner" aria-hidden="true"></div>
        <p class="subtext">Loading credential details…</p>
      </div>
    `;
    const info =
      role === "SHG" && currentDistrictName
        ? { role, district_name: currentDistrictName }
        : { role };
    fetch(`${GUIDANCE_API_BASE}/select/credential/info/${encodeURIComponent(JSON.stringify(info))}`)
      .then((response) => response.json())
      .then((records) => renderCredentialTable(panel, records, role))
      .catch(() => {
        panel.innerHTML = `<p class="subtext">Could not load credential details. Please try again.</p>`;
        delete panel.dataset.credentialsLoaded;
      });
  }

  function loadCredentialsForAvatar(avatar) {
    const panel = document.querySelector(
      `.shg-panel[data-panel="${avatar.dataset.role}-credential"]`,
    );
    if (!panel || panel.dataset.credentialsLoaded) return;
    panel.dataset.credentialsLoaded = "true";
    const role = ROLE_QUERY_BY_AVATAR_ROLE[avatar.dataset.role] || avatar.dataset.role;
    fetchAndRenderCredentials(panel, role);
  }

  document.querySelectorAll(".shg-role-avatar").forEach((avatar) => {
    const credentialTab = avatar.querySelector('.shg-tab[data-tab$="-credential"]');
    if (!credentialTab) return;
    credentialTab.addEventListener("click", () => loadCredentialsForAvatar(avatar));
    if (credentialTab.classList.contains("active")) loadCredentialsForAvatar(avatar);
  });

  // The retailer-commodity tab only ever shows one avatar (there's no
  // per-retailer view here), so what it returns depends on which
  // supervisory dashboard is doing the viewing, not on any single
  // retailer's email — state/aionos see every retailer's commodities,
  // district gets its own district's retailers scoped by pincode (same
  // {role, district_name} shape the credential query above uses). The
  // info-only commodity route this calls (inference/route.py) mirrors the
  // credential one already used above.
  const CURRENT_DASHBOARD_ROLE = {
    "district-dashboard": "district",
    "state-dashboard": "state",
    "aionos-dashboard": "AIONOS",
  }[page];

  function fetchAndRenderCommodities(panel) {
    panel.innerHTML = `
      <div class="shg-credential-loading">
        <div class="shg-credential-spinner" aria-hidden="true"></div>
        <p class="subtext">Loading commodity details…</p>
      </div>
    `;
    const info =
      CURRENT_DASHBOARD_ROLE === "district"
        ? { role: CURRENT_DASHBOARD_ROLE, district_name: currentDistrictName }
        : { role: CURRENT_DASHBOARD_ROLE };
    fetch(`${GUIDANCE_API_BASE}/select/commodity/info/${encodeURIComponent(JSON.stringify(info))}`)
      .then((response) => response.json())
      .then((records) =>
        renderApprovableTable(panel, records, {
          avatarRole: "retailer",
          entity: "commodity",
          onRefresh: () => fetchAndRenderCommodities(panel),
        }),
      )
      .catch(() => {
        panel.innerHTML = `<p class="subtext">Could not load commodity details. Please try again.</p>`;
        delete panel.dataset.commoditiesLoaded;
      });
  }

  function loadCommodityForAvatar(avatar) {
    const panel = document.querySelector(
      `.shg-panel[data-panel="${avatar.dataset.role}-commodity"]`,
    );
    if (!panel || panel.dataset.commoditiesLoaded) return;
    panel.dataset.commoditiesLoaded = "true";
    fetchAndRenderCommodities(panel);
  }

  document.querySelectorAll(".shg-role-avatar").forEach((avatar) => {
    const commodityTab = avatar.querySelector('.shg-tab[data-tab$="-commodity"]');
    if (!commodityTab) return;
    commodityTab.addEventListener("click", () => loadCommodityForAvatar(avatar));
    if (commodityTab.classList.contains("active")) loadCommodityForAvatar(avatar);
  });

  // shg-catalog tab — same per-dashboard role dispatch as retailer-commodity
  // above (there's one SHG avatar here too, not one per SHG), against
  // func__select_catalog's matching {role}/{role, district_name} branches.
  function fetchAndRenderCatalog(panel) {
    panel.innerHTML = `
      <div class="shg-credential-loading">
        <div class="shg-credential-spinner" aria-hidden="true"></div>
        <p class="subtext">Loading catalog details…</p>
      </div>
    `;
    const info =
      CURRENT_DASHBOARD_ROLE === "district"
        ? { role: CURRENT_DASHBOARD_ROLE, district_name: currentDistrictName }
        : { role: CURRENT_DASHBOARD_ROLE };
    fetch(`${GUIDANCE_API_BASE}/select/catalog/info/${encodeURIComponent(JSON.stringify(info))}`)
      .then((response) => response.json())
      .then((records) =>
        renderApprovableTable(panel, records, {
          avatarRole: "SHG",
          entity: "catalog",
          onRefresh: () => fetchAndRenderCatalog(panel),
        }),
      )
      .catch(() => {
        panel.innerHTML = `<p class="subtext">Could not load catalog details. Please try again.</p>`;
        delete panel.dataset.catalogLoaded;
      });
  }

  function loadCatalogForAvatar(avatar) {
    const panel = document.querySelector(`.shg-panel[data-panel="${avatar.dataset.role}-catalog"]`);
    if (!panel || panel.dataset.catalogLoaded) return;
    panel.dataset.catalogLoaded = "true";
    fetchAndRenderCatalog(panel);
  }

  document.querySelectorAll(".shg-role-avatar").forEach((avatar) => {
    const catalogTab = avatar.querySelector('.shg-tab[data-tab$="-catalog"]');
    if (!catalogTab) return;
    catalogTab.addEventListener("click", () => loadCatalogForAvatar(avatar));
    if (catalogTab.classList.contains("active")) loadCatalogForAvatar(avatar);
  });
}
