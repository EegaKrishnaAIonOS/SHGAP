const page = document.body.dataset.page;

// ---------------------------------------------------------------------------
// Shared product-catalog rendering (shg-dashboard + consumer-dashboard) —
// both pages render the same real AP SHG catalog, fetched at runtime from
// data/products.json (generated from datum/product_catalog/ap_shg_product_details.xlsx
// via interface/data/build-products.mjs; re-run that script if the xlsx changes).
// ---------------------------------------------------------------------------

async function loadProductCatalog() {
  const response = await fetch("data/products.json");
  if (!response.ok) throw new Error(`Failed to load product catalog (${response.status})`);
  return response.json();
}

function hashString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Picks a stable item from `pool` for a given `seed` string — the same
// seed always maps to the same pool entry, so names stay consistent across
// re-renders/reloads instead of re-randomizing every time.
function pickStable(pool, seed) {
  return pool[hashString(seed) % pool.length];
}

// The catalog's "Images (JSON)" column links to retailer listing pages, not
// direct image files, so real product photos are effectively never
// available — every card falls back to a generated color swatch keyed by
// category (stable across renders, distinct enough between categories).
const CATEGORY_PALETTE = [
  "#c2703d",
  "#8a6642",
  "#7c8a4a",
  "#b5651d",
  "#5f7a61",
  "#a8763e",
  "#3d6b91",
  "#7a4a8a",
  "#4a8a7c",
  "#8a4a4a",
  "#4a5f8a",
  "#8a7c4a",
];

function colorForCategory(category) {
  return CATEGORY_PALETTE[hashString(category) % CATEGORY_PALETTE.length];
}

// Neither retailer nor SHG identities exist in the xlsx catalog — these are
// synthetic, stably assigned per material/product (via pickStable) so the
// same material always shows the same retailer and the same product always
// shows the same SHG, rather than reshuffling on every render.
const RETAILER_NAMES = [
  "Sri Lakshmi Traders",
  "Kishan Traders",
  "Ganesh Wholesale Suppliers",
  "Annapurna Trading Co.",
  "Balaji Enterprises",
  "Sri Rama Suppliers",
  "Vijaya Distributors",
  "Mahalakshmi Traders",
  "Sai Raw Materials Depot",
  "Konaseema Agro Suppliers",
];

const SHG_NAMES = [
  "Jyothi Self Help Group",
  "Sri Durga SHG",
  "Lakshmi Mahila Sangham",
  "Indira Kranthi Patham SHG",
  "Sneha Mahila Sangham",
  "Vasavi Self Help Group",
  "Bhavani SHG",
  "Sai Mahila Sangham",
  "Tirumala Women’s SHG",
  "Godavari Self Help Group",
];

function retailerNameFor(material) {
  return pickStable(RETAILER_NAMES, material);
}

function shgNameFor(productId) {
  return pickStable(SHG_NAMES, productId);
}

// Raw material costs in the xlsx are ranges ("approx. ₹40-80/kg") — this
// collapses that to a single average price ("₹60/kg") for display. Falls
// back to the original text if it doesn't match the expected range format.
function averageCost(costText) {
  const match = /₹\s*([\d.]+)\s*-\s*([\d.]+)\s*\/\s*([a-zA-Z]+)/.exec(costText);
  if (!match) return costText;
  const [, low, high, unit] = match;
  const avg = Math.round((parseFloat(low) + parseFloat(high)) / 2);
  return `₹${avg}/${unit}`;
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapLabel(label) {
  if (label.length <= 16) return [label];
  const words = label.split(" ");
  let line1 = "";
  let line2 = "";
  words.forEach((word) => {
    if (!line2 && (line1 + " " + word).trim().length <= 16) {
      line1 = (line1 + " " + word).trim();
    } else {
      line2 = (line2 + " " + word).trim();
    }
  });
  return line2 ? [line1, line2] : [line1];
}

function svgPlaceholder(label, bgColor) {
  const lines = wrapLabel(label);
  const text = lines
    .map((line, index) => {
      const y = lines.length === 1 ? 50 : 42 + index * 16;
      return `<text x="50%" y="${y}%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.94)" font-family="Inter, Segoe UI, sans-serif" font-size="19" font-weight="700">${escapeXml(line)}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="${bgColor}"/>${text}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function productMainImage(product) {
  if (product.images.length > 0) return product.images[0];
  return svgPlaceholder(product.name, colorForCategory(product.category));
}

// onerror is a defensive fallback for the rare case a real image URL 404s —
// harmless for the generated data URIs above, which can never fail to load.
function imgWithFallback(src, alt, className, fallbackClassName, fallbackLabel) {
  return `
    <img
      src="${src}"
      alt="${alt}"
      class="${className}"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    />
    <div class="${fallbackClassName}" style="display: none;">${fallbackLabel}</div>
  `;
}

function renderProductCard(
  product,
  onBuy,
  buttonLabel = "Buy Now",
  showShgName = false,
  showBuyButton = true,
) {
  const card = document.createElement("article");
  card.className = "card shg-product-card";
  card.innerHTML = `
    <div class="shg-gallery-main">
      ${imgWithFallback(productMainImage(product), product.name, "shg-gallery-main-img", "shg-gallery-main-fallback", "Image unavailable")}
    </div>
    <p class="shg-product-name">${product.name}</p>
    ${showShgName ? `<p class="shg-product-shg">Sold by ${shgNameFor(product.id)}</p>` : ""}
    <p class="shg-product-desc">${product.description}</p>
    <div class="shg-product-meta">
      <span class="shg-product-price">₹${product.price} / unit</span>
      <span class="shg-product-units">${product.orders.toLocaleString()} units</span>
    </div>
    <p class="shg-product-category">
      <span>Category</span><span>:</span><span>${product.category}</span>
    </p>
    ${showBuyButton ? `<button type="button" class="primary-btn shg-buy-btn" style="width: 100%;">${buttonLabel}</button>` : ""}
  `;

  if (showBuyButton) {
    card.querySelector(".shg-buy-btn").addEventListener("click", () => onBuy(product));
  }

  return card;
}

function renderCatalogGrid(
  container,
  products,
  onBuy,
  buttonLabel = "Buy Now",
  showShgName = false,
  showBuyButton = true,
) {
  container.innerHTML = "";
  if (products.length === 0) return;
  products.forEach((product) =>
    container.appendChild(
      renderProductCard(product, onBuy, buttonLabel, showShgName, showBuyButton),
    ),
  );
}

if (page === "login") {
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  const rememberMeInput = document.getElementById("rememberMeInput");
  const passwordForm = document.getElementById("passwordForm");
  const submitBtn = passwordForm.querySelector('button[type="submit"]');

  // Where to land after login depends on the account's role — SHG/DISTRIBUTOR
  // ("Retailer" in the signup UI)/CONSUMER each have their own dashboard
  // mockup; ADMIN/officials don't have one here, so they just get a success
  // message instead.
  const ROLE_REDIRECTS = {
    SHG: "shg-dashboard.html",
    DISTRIBUTOR: "retailer-dashboard.html",
    CONSUMER: "consumer-dashboard.html",
  };

  // Test-only autofill for the seeded demo accounts (database/seed/demo-data.ts).
  const TEST_LOGINS = {
    fillRetailer: { email: "retailer.email@example.com", password: "retailer#0000" },
    fillShg: { email: "shg.email@example.com", password: "shg#4444" },
    fillConsumer: { email: "consumer.email@example.com", password: "consumer#8888" },
  };
  Object.entries(TEST_LOGINS).forEach(([buttonId, creds]) => {
    document.getElementById(buttonId)?.addEventListener("click", (event) => {
      event.preventDefault();
      emailInput.value = creds.email;
      passwordInput.value = creds.password;
    });
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email.includes("@") || password.length < 6) {
      alert("Please enter a valid email and password.");
      return;
    }

    submitBtn.disabled = true;
    try {
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe: rememberMeInput.checked }),
      });
      const loginData = await loginResponse.json().catch(() => ({}));
      if (!loginResponse.ok) {
        alert(
          Array.isArray(loginData.message)
            ? loginData.message.join(" ")
            : loginData.message || "Login failed.",
        );
        return;
      }

      const meResponse = await fetch("/api/users/me", {
        headers: { Authorization: `${loginData.tokenType} ${loginData.accessToken}` },
      });
      const me = await meResponse.json().catch(() => ({}));
      const role = me.userRoles?.[0]?.role?.name;
      const redirect = ROLE_REDIRECTS[role];

      if (redirect) {
        // Use window.top so a successful login inside the homepage's popup
        // iframe navigates the whole page to the dashboard, not just the
        // iframe itself. Equivalent to window.location when not framed.
        window.top.location.href = redirect;
      } else {
        alert(`Login successful (${role ?? "this role"} doesn't have a dashboard here yet).`);
      }
    } catch (err) {
      alert("Could not reach the server. Please try again.");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

if (page === "signup") {
  const form = document.getElementById("signupForm");
  const stepPanels = [...document.querySelectorAll(".step-panel")];
  const continueBtn = document.getElementById("continueBtn");
  const backBtn = document.getElementById("backBtn");
  const submitBtn = form.querySelector('button[type="submit"]');
  const userTypeSelect = document.getElementById("userType");
  const successModal = document.getElementById("successModal");
  const successGoBtn = document.getElementById("successGoBtn");

  successGoBtn.addEventListener("click", () => {
    window.location.href = "login.html";
  });

  // Maps the mockup's User Type dropdown values to the actual RoleName
  // values the backend's /auth/register accepts (see SELF_REGISTERABLE_ROLES
  // in apps/core-api/src/auth/dto/register.dto.ts) — "Retailer" here means
  // the wholesale DISTRIBUTOR role, "Consumer" the retail end-consumer role.
  const ROLE_MAP = { SHG: "SHG", RETAILER: "DISTRIBUTOR", CONSUMER: "CONSUMER" };
  const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  // All 26 districts of Andhra Pradesh (post the April 2022 reorganisation).
  const AP_DISTRICTS = [
    "Alluri Sitharama Raju",
    "Anakapalli",
    "Anantapur",
    "Annamayya",
    "Bapatla",
    "Chittoor",
    "Dr. B.R. Ambedkar Konaseema",
    "East Godavari",
    "Eluru",
    "Guntur",
    "Kakinada",
    "Krishna",
    "Kurnool",
    "Nandyal",
    "NTR",
    "Palnadu",
    "Parvathipuram Manyam",
    "Prakasam",
    "Sri Potti Sriramulu Nellore",
    "Sri Sathya Sai",
    "Srikakulam",
    "Tirupati",
    "Visakhapatnam",
    "Vizianagaram",
    "West Godavari",
    "YSR Kadapa",
  ];

  const roleFieldSets = {
    SHG: document.getElementById("fieldsSHG"),
    RETAILER: document.getElementById("fieldsRETAILER"),
    CONSUMER: document.getElementById("fieldsCONSUMER"),
  };

  function populateDistrictSelect(id) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML =
      '<option value="">Select district</option>' +
      AP_DISTRICTS.map((district) => `<option value="${district}">${district}</option>`).join("");
  }
  populateDistrictSelect("shgDistrict");
  populateDistrictSelect("retailDistrict");
  populateDistrictSelect("consumerDistrict");

  // Live password strength meter — same signals as the backend's password
  // policy (see PASSWORD_PATTERN above / RegisterDto): min length, upper,
  // lower, number, special character.
  const passwordInput = document.getElementById("password");
  const strengthBar = document.getElementById("passwordStrengthBar");
  const strengthLabel = document.getElementById("passwordStrengthLabel");
  const requirementItems = [...document.querySelectorAll("#passwordRequirements li")];

  // The missing-requirements list only appears once the user leaves the
  // field (blur) with an incomplete password — nothing shows while they're
  // still actively typing it for the first time. Once shown as an error,
  // it keeps updating live so they can watch it clear while fixing it.
  let requirementsRevealed = false;

  function getPasswordChecks(value) {
    return {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      lower: /[a-z]/.test(value),
      number: /\d/.test(value),
      special: /[^A-Za-z0-9]/.test(value),
    };
  }

  function updateStrengthBar(value, checks) {
    const score = Object.values(checks).filter(Boolean).length;
    const strength = !value ? "" : score <= 2 ? "weak" : score <= 4 ? "medium" : "strong";
    strengthBar.className = "strength-bar" + (strength ? ` ${strength}` : "");
    strengthBar.querySelector("span").style.width = value ? `${(score / 5) * 100}%` : "0%";
    strengthLabel.textContent = strength
      ? `Password strength: ${strength.charAt(0).toUpperCase()}${strength.slice(1)}`
      : "";
  }

  function updateRequirementsList(checks) {
    const allMet = Object.values(checks).every(Boolean);
    requirementItems.forEach((item) => {
      item.hidden = !requirementsRevealed || checks[item.dataset.rule];
    });
    if (allMet) requirementsRevealed = false;
  }

  passwordInput.addEventListener("input", () => {
    const checks = getPasswordChecks(passwordInput.value);
    updateStrengthBar(passwordInput.value, checks);
    updateRequirementsList(checks);
  });

  passwordInput.addEventListener("blur", () => {
    const checks = getPasswordChecks(passwordInput.value);
    if (!Object.values(checks).every(Boolean)) requirementsRevealed = true;
    updateRequirementsList(checks);
  });

  updateRequirementsList(getPasswordChecks(""));

  function goToStep(step) {
    stepPanels.forEach((panel) =>
      panel.classList.toggle("active", Number(panel.dataset.step) === step),
    );
  }

  function validateStepOne() {
    const role = userTypeSelect.value;
    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const mobile = document.getElementById("mobileNumber").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!fullName || !email.includes("@") || !/^[6-9]\d{9}$/.test(mobile)) {
      alert("Please fill in valid details.");
      return false;
    }
    if (!PASSWORD_PATTERN.test(password)) {
      alert(
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
      );
      return false;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return false;
    }
    if (!role) {
      alert("Please select a user type.");
      return false;
    }
    return true;
  }

  // Step 2 is itself broken into per-role categories shown one at a time —
  // e.g. SHG goes "SHG Fields" -> "Bank Account Details" -> "Address
  // Details" — rather than one long flat list of fields.
  const nextSubStepBtn = document.getElementById("nextSubStepBtn");
  const createAccountBtn = document.getElementById("createAccountBtn");
  const termsRow = document.getElementById("termsRow");
  let currentSubStep = 0;

  function getActiveFieldSet() {
    return roleFieldSets[userTypeSelect.value];
  }

  function getSubSteps(fieldSet) {
    return [...fieldSet.querySelectorAll(".sub-step")];
  }

  function showSubStep(index) {
    const subSteps = getSubSteps(getActiveFieldSet());
    subSteps.forEach((el) => el.classList.toggle("active", Number(el.dataset.substep) === index));

    const isLast = index === subSteps.length - 1;
    nextSubStepBtn.hidden = isLast;
    createAccountBtn.hidden = !isLast;
    termsRow.hidden = !isLast;
  }

  function validateSubStep(index) {
    const subSteps = getSubSteps(getActiveFieldSet());
    const fields = [...subSteps[index].querySelectorAll("input, select")];
    const allFilled = fields.every((field) => field.value.trim() !== "");
    if (!allFilled) alert("Please complete all the fields in this section.");
    return allFilled;
  }

  continueBtn.addEventListener("click", () => {
    if (!validateStepOne()) return;

    const role = userTypeSelect.value;
    Object.entries(roleFieldSets).forEach(([key, el]) => {
      el.hidden = key !== role;
    });
    currentSubStep = 0;
    showSubStep(currentSubStep);
    goToStep(2);
  });

  nextSubStepBtn.addEventListener("click", () => {
    if (!validateSubStep(currentSubStep)) return;
    currentSubStep += 1;
    showSubStep(currentSubStep);
  });

  backBtn.addEventListener("click", () => {
    if (currentSubStep > 0) {
      currentSubStep -= 1;
      showSubStep(currentSubStep);
      return;
    }
    goToStep(1);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Hitting Enter in any text field submits the form natively (browsers
    // pick createAccountBtn as the default submit target even while it's
    // hidden) — e.g. after using Back to revisit an earlier category. Only
    // actually create the account when Create Account is the visible,
    // reached action for the current category.
    if (createAccountBtn.hidden) return;

    if (!validateStepOne()) {
      goToStep(1);
      return;
    }

    const role = userTypeSelect.value;
    const activeFieldSet = roleFieldSets[role];
    const roleFieldsValid = [...activeFieldSet.querySelectorAll("input, select")].every(
      (field) => field.value.trim() !== "",
    );
    if (!roleFieldsValid) {
      alert("Please complete all the fields for your user type.");
      return;
    }

    const terms = document.getElementById("terms").checked;
    if (!terms) {
      alert("You must accept the terms.");
      return;
    }

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const mobile = document.getElementById("mobileNumber").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    submitBtn.disabled = true;
    try {
      // NOTE: the User Type-specific fields captured above (SHG group/bank
      // details, retailer GSTIN/PAN, consumer address, etc.) aren't sent
      // here — /auth/register's DTO (apps/core-api/src/auth/dto/register.dto.ts)
      // only accepts these base account fields today (its ValidationPipe has
      // forbidNonWhitelisted: true, so extra fields would 400 the request).
      // Collecting them here is UI-only until the backend grows a place to
      // store them.
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          mobileNumber: mobile,
          password,
          confirmPassword,
          role: ROLE_MAP[role] ?? role,
          termsAccepted: terms,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(
          Array.isArray(data.message)
            ? data.message.join(" ")
            : data.message || "Registration failed.",
        );
        return;
      }
      form.reset();
      successModal.hidden = false;
    } catch (err) {
      alert("Could not reach the server. Please try again.");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

if (page === "register") {
  const stepPanels = [...document.querySelectorAll(".step-panel")];
  const stepIndicators = [...document.querySelectorAll(".stepper span")];
  const form = document.getElementById("registrationForm");
  const nextBtn = document.getElementById("nextBtn");
  const backBtn = document.getElementById("backBtn");
  const submitBtn = document.getElementById("submitBtn");
  const stepLabel = document.getElementById("stepLabel");

  let currentStep = 0;

  const districtOptions = ["Anantapur", "Chittoor", "Guntur", "Kurnool", "Visakhapatnam"];
  const ulbOptions = ["Tirupati", "Kurnool", "Vijayawada", "Rajahmundry"];
  const mandalOptions = ["Madanapalle", "Puttur", "Amalapuram", "Kandukur"];

  function populateSelect(id, values) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML =
      '<option value="">Select</option>' +
      values.map((value) => `<option value="${value}">${value}</option>`).join("");
  }

  populateSelect("districtSelect", districtOptions);
  populateSelect("ulbSelect", ulbOptions);
  populateSelect("mandalSelect", mandalOptions);

  function updateStep() {
    stepPanels.forEach((panel, index) => panel.classList.toggle("active", index === currentStep));
    stepIndicators.forEach((dot, index) => dot.classList.toggle("active", index <= currentStep));
    stepLabel.textContent = `Step ${currentStep + 1} of ${stepPanels.length}`;
    backBtn.style.display = currentStep === 0 ? "none" : "inline-flex";
    if (currentStep === stepPanels.length - 1) {
      nextBtn.style.display = "none";
      submitBtn.style.display = "inline-flex";
    } else {
      nextBtn.style.display = "inline-flex";
      submitBtn.style.display = "none";
    }
  }

  function validateCurrentStep() {
    const currentPanel = stepPanels[currentStep];
    const requiredFields = [...currentPanel.querySelectorAll('[data-required="true"]')];

    for (const field of requiredFields) {
      const value = field.value ? field.value.trim() : "";
      if (!value) {
        alert("Please complete all required fields in this step.");
        field.focus();
        return false;
      }
    }

    if (currentStep === 1 && document.getElementById("districtSelect").value === "") {
      alert("Please select a district.");
      return false;
    }

    return true;
  }

  nextBtn.addEventListener("click", () => {
    if (!validateCurrentStep()) return;
    currentStep += 1;
    updateStep();
  });

  backBtn.addEventListener("click", () => {
    currentStep -= 1;
    updateStep();
  });

  submitBtn.addEventListener("click", () => {
    if (!validateCurrentStep()) return;
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value.trim();
    const confirmPassword = document.getElementById("regConfirmPassword").value.trim();

    if (!email.includes("@")) {
      alert("Please enter a valid email.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    const groupName = document.getElementById("groupName").value.trim();
    const type = document.getElementById("groupType").value;
    const summary = document.getElementById("summaryBox");
    summary.innerHTML = `
      <p><strong>Group:</strong> ${groupName}</p>
      <p><strong>Type:</strong> ${type || "N/A"}</p>
      <p><strong>District:</strong> ${document.getElementById("districtSelect").value || "Not selected"}</p>
    `;
    alert("SHG registration submitted successfully.");
  });

  document.getElementById("detectLocationBtn").addEventListener("click", () => {
    const locationStatus = document.getElementById("locationStatus");
    locationStatus.textContent = "Location suggested: Kurnool district";
  });

  updateStep();
}

if (page === "shg-dashboard") {
  const tabs = [...document.querySelectorAll(".shg-tab")];
  const panels = [...document.querySelectorAll(".shg-panel")];
  const rawMaterialsGrid = document.getElementById("rawMaterialsGrid");
  const itemsSearchInput = document.getElementById("itemsSearchInput");
  const itemsCategoryFilter = document.getElementById("itemsCategoryFilter");
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

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.classList.contains("shg-tab-disabled")) {
        showToast("Open Contributions — Coming Soon");
        return;
      }
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      panels.forEach((panel) =>
        panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab),
      );
    });
  });

  // Raw materials are per-product in the catalog data, so this dedupes them
  // by name across the whole xlsx catalog and renders each with the same
  // card template as the Product Catalog above — showing the raw material's
  // own name, not the product it came from. The xlsx has no retailer/stock
  // data, so retailerNameFor() (stable) and a random stock count fill that in.
  function dedupeMaterials(products) {
    const byName = new Map();
    products.forEach((product) => {
      // The xlsx's raw-material-image column occasionally resolves to the
      // exact same photo as the product's own gallery (a finished-product
      // shot, not a raw material) — drop those so a material never
      // displays as if it were the finished product.
      const productImages = new Set(product.images);
      const images = product.rawMaterialImages.filter((url) => !productImages.has(url));
      product.rawMaterials.forEach((m, index) => {
        const key = m.material.toLowerCase();
        if (byName.has(key)) return;
        // rawMaterialImages isn't one-per-material (often fewer images than
        // materials), so this cycles through by the material's own position
        // instead of always taking image [0] for every material in the
        // product — spreads distinct materials across distinct images
        // instead of collapsing them all onto the same photo.
        const image = images.length > 0 ? images[index % images.length] : null;
        // Some products' xlsx rows have no raw-material-specific photo at
        // all (the raw-material-image column just repeats the product
        // photo, already filtered out above) — skip rather than show a
        // material with no real photo; a later product with the same
        // material name may still supply one, so this isn't marked "seen".
        if (!image) return;
        byName.set(key, {
          material: m.material,
          cost: m.cost,
          category: product.category,
          retailer: retailerNameFor(m.material),
          image,
          stock: 20 + Math.floor(Math.random() * 480),
        });
      });
    });
    return [...byName.values()];
  }

  function renderRawMaterialCard(material) {
    const image =
      material.image ?? svgPlaceholder(material.material, colorForCategory(material.category));
    const card = document.createElement("article");
    card.className = "card shg-product-card";
    card.innerHTML = `
      <div class="shg-gallery-main">
        ${imgWithFallback(image, material.material, "shg-gallery-main-img", "shg-gallery-main-fallback", "Image unavailable")}
      </div>
      <p class="shg-product-name">${material.material}</p>
      <p class="shg-product-desc">Supplied by ${material.retailer}</p>
      <div class="shg-product-meta">
        <span class="shg-product-price">${averageCost(material.cost)}</span>
        <span class="shg-product-units">${material.stock} in stock</span>
      </div>
      <p class="shg-product-category">
        <span>Category</span><span>:</span><span>${material.category}</span>
      </p>
      <button type="button" class="primary-btn shg-buy-btn" style="width: 100%;">Buy Now</button>
    `;
    card
      .querySelector(".shg-buy-btn")
      .addEventListener("click", () => showToast(`Order placed for "${material.material}"`));
    return card;
  }

  // Search (by name) + category filter, since Items now spans every
  // category in the xlsx catalog rather than a single pinned one.
  function setupItemsFilters(materials) {
    const categories = [...new Set(materials.map((m) => m.category))].sort();
    itemsCategoryFilter.insertAdjacentHTML(
      "beforeend",
      categories.map((c) => `<option value="${c}">${c}</option>`).join(""),
    );

    function applyFilters() {
      const query = itemsSearchInput.value.trim().toLowerCase();
      const category = itemsCategoryFilter.value;
      const visible = materials.filter((material) => {
        const matchesQuery = !query || material.material.toLowerCase().includes(query);
        const matchesCategory = category === "all" || material.category === category;
        return matchesQuery && matchesCategory;
      });

      rawMaterialsGrid.innerHTML = "";
      visible.forEach((material) => rawMaterialsGrid.appendChild(renderRawMaterialCard(material)));
      itemsEmptyState.hidden = visible.length > 0;
    }

    itemsSearchInput.addEventListener("input", applyFilters);
    itemsCategoryFilter.addEventListener("change", applyFilters);
    applyFilters();
  }

  function renderRawMaterials(products) {
    setupItemsFilters(dedupeMaterials(products));
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

  loadProductCatalog()
    .then((products) => {
      const pickles = products
        .filter((p) => p.category === "Pickles (Andhra Style)")
        .sort((a, b) => a.id.localeCompare(b.id));
      // Raw Materials sources from the full xlsx catalog (all categories),
      // unlike the pickles-only Product Catalog below.
      renderRawMaterials(products);
      // Product Catalog shows a fixed sample of 8 from this SHG's one line
      // of products — pinned to pickles for now (this demo SHG only makes
      // pickles). Sorted by id (not shuffled) so the same 8 items show in
      // the same order on every reload instead of a fresh random pick.
      renderCatalogGrid(catalogGrid, pickles.slice(0, 8), null, undefined, false, false);
      // Insight picker lists every product in the full xlsx catalog (all
      // categories, not just pickles) — it's a separate exploration tool,
      // not tied to the storefront's pickles-only curated subset above.
      renderInsightSelect(products);
    })
    .catch((err) => {
      console.error(err);
      catalogGrid.innerHTML = "<p>Could not load the product catalog.</p>";
    });
}

if (page === "consumer-dashboard") {
  // Same real catalog the SHG dashboard's Product Catalog showcases — this
  // is the consumer-facing view of what SHGs have placed for sale.
  const catalogGrid = document.getElementById("catalogGrid");
  const itemsSearchInput = document.getElementById("itemsSearchInput");
  const itemsCategoryFilter = document.getElementById("itemsCategoryFilter");
  const itemsEmptyState = document.getElementById("itemsEmptyState");
  const toast = document.getElementById("consumerToast");
  let toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }

  loadProductCatalog()
    .then((products) => {
      const categories = [...new Set(products.map((p) => p.category))].sort();
      itemsCategoryFilter.insertAdjacentHTML(
        "beforeend",
        categories.map((c) => `<option value="${c}">${c}</option>`).join(""),
      );

      function applyFilters() {
        const query = itemsSearchInput.value.trim().toLowerCase();
        const category = itemsCategoryFilter.value;
        const visible = products.filter((product) => {
          const matchesQuery = !query || product.name.toLowerCase().includes(query);
          const matchesCategory = category === "all" || product.category === category;
          return matchesQuery && matchesCategory;
        });

        renderCatalogGrid(
          catalogGrid,
          visible,
          (product) => showToast(`Order placed for "${product.name}"`),
          "Buy Now",
          true,
        );
        itemsEmptyState.hidden = visible.length > 0;
      }

      itemsSearchInput.addEventListener("input", applyFilters);
      itemsCategoryFilter.addEventListener("change", applyFilters);
      applyFilters();
    })
    .catch((err) => {
      console.error(err);
      catalogGrid.innerHTML = "<p>Could not load the product catalog.</p>";
    });
}

if (page === "retailer-dashboard") {
  // Retailer is the top of this demo's supply chain — it only has a
  // Catalog (what it supplies to the SHG), no "items" tab, since there's no
  // layer above it to fetch from. Pinned to one category (Pickles) rather
  // than a random pick each reload, mirroring how the SHG dashboard is
  // pinned to the pickles it makes (these are the same goods the SHG's
  // "Items" tab shows on the other end of the supply chain). Stock counts
  // are synthetic — the xlsx has none — via a random count (not stable;
  // this is meant to look like live inventory, not a fixed catalog fact).
  const PICKLE_CATEGORY = "Pickles (Andhra Style)";
  const materialGrid = document.getElementById("materialGrid");

  function dedupeMaterials(products) {
    const byName = new Map();
    products
      .filter((product) => product.category === PICKLE_CATEGORY)
      .forEach((product) => {
        // Same overlap check as the SHG dashboard's raw materials — don't
        // show a finished-product photo mislabeled as a raw material.
        const productImages = new Set(product.images);
        const images = product.rawMaterialImages.filter((url) => !productImages.has(url));
        product.rawMaterials.forEach((m, index) => {
          const key = m.material.toLowerCase();
          if (byName.has(key)) return;
          const image = images.length > 0 ? images[index % images.length] : null;
          if (!image) return;
          byName.set(key, {
            material: m.material,
            cost: m.cost,
            category: product.category,
            image,
            stock: 20 + Math.floor(Math.random() * 480),
          });
        });
      });
    return [...byName.values()].sort((a, b) => a.material.localeCompare(b.material));
  }

  // Same card template as the SHG dashboard's Items/Catalog tabs — single
  // image (no badge overlay), name, price/stock — so a material card looks
  // the same whichever side of the supply chain it's rendered on. No
  // Category row for now — every card here is already pinned to Pickles,
  // so it was pure repetition.
  function renderMaterialCard(material) {
    const image =
      material.image ?? svgPlaceholder(material.material, colorForCategory(material.category));
    const card = document.createElement("article");
    card.className = "card shg-product-card";
    card.innerHTML = `
      <div class="shg-gallery-main">
        ${imgWithFallback(image, material.material, "shg-gallery-main-img", "shg-gallery-main-fallback", "Image unavailable")}
      </div>
      <p class="shg-product-name">${material.material}</p>
      <div class="shg-product-meta">
        <span class="shg-product-price">${averageCost(material.cost)}</span>
        <span class="shg-product-units">${material.stock} in stock</span>
      </div>
    `;
    return card;
  }

  // Capped at 8, same as the SHG dashboard's own pinned pickle catalog —
  // one simple grid, not a separate "featured" banner tier.
  function renderMaterials(products) {
    materialGrid.innerHTML = "";
    dedupeMaterials(products)
      .slice(0, 8)
      .forEach((material) => materialGrid.appendChild(renderMaterialCard(material)));
  }

  loadProductCatalog()
    .then((products) => renderMaterials(products))
    .catch((err) => {
      console.error(err);
      materialGrid.innerHTML = "<p>Could not load the catalog.</p>";
    });
}
