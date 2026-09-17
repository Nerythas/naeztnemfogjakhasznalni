import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const login = document.getElementById("login");
const app = document.getElementById("app");
const msg = document.getElementById("loginMsg");
const recordsEl = document.getElementById("records");

let profile = null;

// BEJELENTKEZÉS
document.getElementById("loginBtn").onclick = async () => {
  msg.textContent = "Bejelentkezés…";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    msg.textContent = "Kérjük, adja meg az e-mail címet és a jelszót.";
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg.textContent = error.message;
  } else {
    msg.textContent = "";
  }
};

// KILÉPÉS
document.getElementById("logoutBtn").onclick = async () => {
  await supabase.auth.signOut();
};

// BEJELENTKEZÉSI ÁLLAPOT FIGYELÉSE
supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session) {
    await loadProfile(session.user);
  } else {
    app.classList.add("hidden");
    login.classList.remove("hidden");
  }
});

// FELHASZNÁLÓ BETÖLTÉSE
async function loadProfile(user) {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      organization_id,
      role,
      organizations (
        id,
        name
      )
    `)
    .eq("id", user.id)
    .single();

  if (error) {
    msg.textContent = "Profilhiba: " + error.message;
    return;
  }

  profile = data;

  login.classList.add("hidden");
  app.classList.remove("hidden");

  document.getElementById("orgName").textContent =
    data.organizations.name;

  document.getElementById("userInfo").textContent =
    (data.full_name || user.email) +
    " · " +
    data.organizations.name;

  document.getElementById("permission").textContent =
    "A saját szervezeti mezők módosíthatók. Más szervezetek adatai csak olvashatók.";

  await loadRecords();
}

// BEJEGYZÉSEK BETÖLTÉSE
async function loadRecords() {
  const { data, error } = await supabase
    .from("records_view")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {
    recordsEl.innerHTML =
      `<div class="card error">${esc(error.message)}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    recordsEl.innerHTML =
      '<div class="card">Még nincs bejegyzés.</div>';
    return;
  }

  recordsEl.innerHTML =
    data.map(renderRecord).join("");

  // MEZŐK MENTÉSE
  recordsEl
    .querySelectorAll("[data-save]")
    .forEach(el => {
      el.addEventListener("change", saveField);
    });

  // TÖRLÉS
  recordsEl
    .querySelectorAll("[data-delete]")
    .forEach(el => {
      el.addEventListener("click", deleteRecord);
    });
}


// ==========================================
// JOGOSULTSÁG
// ==========================================

function canEditField(record, field) {

  // ADMIN MINDENT MÓDOSÍTHAT
  if (profile.role === "admin") {
    return true;
  }

  const organization =
    profile.organizations.name;

  // REFOmix
  if (field === "refomix_note") {
    return organization === "ReFoMix";
  }

  // KÖZTERÜLET
  if (field === "kozterulet_note") {
    return organization === "Közterület";
  }

  // RENDŐRSÉG
  if (field === "rendorseg_note") {
    return organization === "Rendőrség";
  }

  // KÖZÖS ALAPADATOK
  // Ezeket csak az a szervezet módosíthatja,
  // amelyik a rekordot létrehozta.
  if (
    field === "location" ||
    field === "record_date" ||
    field === "status"
  ) {
    return record.organization_id === profile.organization_id;
  }

  return false;
}


// ==========================================
// BEJEGYZÉS MEGJELENÍTÉSE
// ==========================================

function renderRecord(record) {

  const canLocation =
    canEditField(record, "location");

  const canDate =
    canEditField(record, "record_date");

  const canStatus =
    canEditField(record, "status");

  const canRefomix =
    canEditField(record, "refomix_note");

  const canKozterulet =
    canEditField(record, "kozterulet_note");

  const canRendorseg =
    canEditField(record, "rendorseg_note");

  const canDelete =
    profile.role === "admin" ||
    record.organization_id === profile.organization_id;

  return `
  <article class="card record">

    <div class="record-head">
      <strong>Bejegyzés #${record.id}</strong>

      ${
        canDelete
          ? `<button
               class="danger"
               data-delete="${record.id}">
               Törlés
             </button>`
          : ""
      }
    </div>


    <!-- KÖZÖS ADATOK -->

    <div class="section-title">
      Közös információ
    </div>

    ${fieldInput(
      "Helyszín",
      "location",
      record.id,
      record.location || "",
      canLocation,
      "text"
    )}

    ${fieldInput(
      "Dátum",
      "record_date",
      record.id,
      record.record_date || "",
      canDate,
      "date"
    )}

    ${fieldSelect(
      record.id,
      record.status || "Új",
      canStatus
    )}


    <!-- REFOmix -->

    <div class="organization-box refomix">
      <div class="organization-title">
        🔴 ReFoMix
      </div>

      ${fieldInput(
        "ReFoMix megjegyzés",
        "refomix_note",
        record.id,
        record.refomix_note || "",
        canRefomix,
        "textarea"
      )}
    </div>


    <!-- KÖZTERÜLET -->

    <div class="organization-box kozterulet">
      <div class="organization-title">
        🔵 Közterület
      </div>

      ${fieldInput(
        "Közterület megjegyzés",
        "kozterulet_note",
        record.id,
        record.kozterulet_note || "",
        canKozterulet,
        "textarea"
      )}
    </div>


    <!-- RENDŐRSÉG -->

    <div class="organization-box rendorseg">
      <div class="organization-title">
        🟢 Rendőrség
      </div>

      ${fieldInput(
        "Rendőrség megjegyzés",
        "rendorseg_note",
        record.id,
        record.rendorseg_note || "",
        canRendorseg,
        "textarea"
      )}
    </div>

  </article>
  `;
}


// ==========================================
// INPUT MEZŐ
// ==========================================

function fieldInput(
  label,
  field,
  id,
  value,
  editable,
  type
) {

  const disabled =
    editable ? "" : "disabled";

  if (type === "textarea") {

    return `
      <label>
        ${label}

        <textarea
          data-save="${id}"
          data-field="${field}"
          ${disabled}
        >${esc(value)}</textarea>

      </label>
    `;
  }

  return `
    <label>
      ${label}

      <input
        type="${type}"
        data-save="${id}"
        data-field="${field}"
        value="${esc(value)}"
        ${disabled}
      >

    </label>
  `;
}


// ==========================================
// STÁTUSZ
// ==========================================

function fieldSelect(
  id,
  value,
  editable
) {

  return `
    <label>
      Státusz

      <select
        data-save="${id}"
        data-field="status"
        ${editable ? "" : "disabled"}
      >

        ${[
          "Új",
          "Folyamatban",
          "Lezárt"
        ]
          .map(status => `
            <option
              ${value === status ? "selected" : ""}
            >
              ${status}
            </option>
          `)
          .join("")}

      </select>
    </label>
  `;
}


// ==========================================
// MENTÉS
// ==========================================

async function saveField(event) {

  const id =
    Number(event.target.dataset.save);

  const field =
    event.target.dataset.field;

  const value =
    event.target.value;

  const { error } =
    await supabase.rpc(
      "update_own_record_field",
      {
        p_record_id: id,
        p_field: field,
        p_value: value
      }
    );

  if (error) {

    alert(
      "Mentési hiba: " +
      error.message
    );

    await loadRecords();

  } else {

    await loadRecords();
  }
}


// ==========================================
// TÖRLÉS
// ==========================================

async function deleteRecord(event) {

  const id =
    Number(
      event.currentTarget.dataset.delete
    );

  if (
    !confirm(
      "Biztosan törli ezt a bejegyzést?"
    )
  ) {
    return;
  }

  const { error } =
    await supabase
      .from("records")
      .delete()
      .eq("id", id);

  if (error) {

    alert(
      "Törlési hiba: " +
      error.message
    );

  } else {

    await loadRecords();
  }
}


// ==========================================
// ÚJ BEJEGYZÉS
// ==========================================

document.getElementById("addBtn").onclick =
  async () => {

    const { error } =
      await supabase
        .from("records")
        .insert({
          created_by: profile.id,
          organization_id:
            profile.organization_id,
          location: "",
          record_date:
            new Date()
              .toISOString()
              .slice(0, 10),
          status: "Új"
        });

    if (error) {

      alert(
        "Nem sikerült létrehozni: " +
        error.message
      );

    } else {

      await loadRecords();
    }
  };


// ==========================================
// BIZTONSÁGOS HTML KIÍRÁS
// ==========================================

function esc(value) {

  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character])
    );
}
