import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const login = document.getElementById("login");
const app = document.getElementById("app");
const msg = document.getElementById("loginMsg");
const recordsEl = document.getElementById("records");

let profile = null;

const IMAGE_BUCKET = "record-images";


// ==========================================
// BEJELENTKEZÉS
// ==========================================

document.getElementById("loginBtn").onclick = async () => {

  msg.textContent = "Bejelentkezés…";

  const email =
    document.getElementById("email").value.trim();

  const password =
    document.getElementById("password").value;

  if (!email || !password) {
    msg.textContent =
      "Kérjük, adja meg az e-mail címet és a jelszót.";
    return;
  }

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    msg.textContent = error.message;
  } else {
    msg.textContent = "";
  }
};


// ==========================================
// KILÉPÉS
// ==========================================

document.getElementById("logoutBtn").onclick =
  async () => {
    await supabase.auth.signOut();
  };


// ==========================================
// BEJELENTKEZÉSI ÁLLAPOT FIGYELÉSE
// ==========================================

supabase.auth.onAuthStateChange(
  async (_event, session) => {

    if (session) {

      await loadProfile(session.user);

    } else {

      app.classList.add("hidden");
      login.classList.remove("hidden");

    }

  }
);


// ==========================================
// FELHASZNÁLÓ BETÖLTÉSE
// ==========================================

async function loadProfile(user) {

  const { data, error } =
    await supabase
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

    msg.textContent =
      "Profilhiba: " + error.message;

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
    "A saját szervezeti mezők módosíthatók. Más szervezetek adatai csak olvashatók. A képek minden bejelentkezett felhasználó számára megtekinthetők és feltölthetők.";

  await loadRecords();
}


// ==========================================
// BEJEGYZÉSEK BETÖLTÉSE
// ==========================================

async function loadRecords() {

  const { data, error } =
    await supabase
      .from("records_view")
      .select("*")
      .order("created_at", {
        ascending: false
      });

  if (error) {

    recordsEl.innerHTML =
      `<div class="card error">
        ${esc(error.message)}
      </div>`;

    return;
  }

  if (!data || data.length === 0) {

    recordsEl.innerHTML =
      '<div class="card">Még nincs bejegyzés.</div>';

    return;
  }

  recordsEl.innerHTML =
    data.map(renderRecord).join("");


  // ========================================
  // MEZŐK MENTÉSE
  // ========================================

  recordsEl
    .querySelectorAll("[data-save]")
    .forEach(el => {

      el.addEventListener("change", saveField);

    });


  // ========================================
  // BEJEGYZÉS TÖRLÉSE
  // ========================================

  recordsEl
    .querySelectorAll("[data-delete]")
    .forEach(el => {

      el.addEventListener("click", deleteRecord);

    });


  // ========================================
  // KÉPFELTÖLTÉS
  // ========================================

  recordsEl
    .querySelectorAll("[data-upload]")
    .forEach(el => {

      el.addEventListener("change", uploadImages);

    });


  // ========================================
  // KÉPEK BETÖLTÉSE
  // ========================================

  const imageContainers =
    recordsEl.querySelectorAll("[data-images-for]");

  await Promise.all(
    Array.from(imageContainers).map(el =>
      loadImages(
        Number(el.dataset.imagesFor)
      )
    )
  );
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

    return (
      record.organization_id ===
      profile.organization_id
    );

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
    record.organization_id ===
    profile.organization_id;


  return `
    <article class="card record">

      <div class="record-head">

        <strong>
          Bejegyzés #${record.id}
        </strong>

        ${
          canDelete
            ? `
              <button
                class="danger"
                data-delete="${record.id}">
                Törlés
              </button>
            `
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


      <!-- SZERVEZETI INFORMÁCIÓK -->

      <div class="section-title">
        Szervezeti információk
      </div>


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


      <!-- KÉPEK -->

      ${imageSection(record.id)}


    </article>
  `;
}


// ==========================================
// KÉPEK SZEKCIÓ
// ==========================================

function imageSection(recordId) {

  return `
    <div class="images-section">

      <div class="images-head">

        <div>

          <div class="section-title">
            📷 Képek
          </div>

          <div class="images-help">
            Minden bejelentkezett szervezet tölthet fel képet ehhez a bejegyzéshez.
          </div>

        </div>


        <label class="upload-btn">

          📷 Kép hozzáadása

          <input
            type="file"
            accept="image/*"
            multiple
            data-upload="${recordId}"
            hidden
          >

        </label>

      </div>


      <div
        class="image-grid"
        data-images-for="${recordId}">

        <div class="images-loading">
          Képek betöltése…
        </div>

      </div>

    </div>
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

  }

  await loadRecords();
}


// ==========================================
// KÉPFELTÖLTÉS
// ==========================================

async function uploadImages(e) {

  const input =
    e.currentTarget;

  const recordId =
    Number(input.dataset.upload);

  const files =
    Array.from(input.files || []);


  if (!files.length) {
    return;
  }


  for (const file of files) {

    // Csak kép
    if (!file.type.startsWith("image/")) {

      alert(
        "Csak képfájl tölthető fel."
      );

      continue;
    }


    // Maximum 10 MB
    if (file.size > 10 * 1024 * 1024) {

      alert(
        `A(z) ${file.name} túl nagy. Maximum 10 MB lehet.`
      );

      continue;
    }


    // Biztonságos fájlnév
    const safeName =
      file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );


    // Egyedi storage útvonal
    const path =
      `${profile.id}/${recordId}/${crypto.randomUUID()}-${safeName}`;


    // FELTÖLTÉS SUPABASE STORAGE-BA

    const { error: uploadError } =
      await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(
          path,
          file,
          {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
          }
        );


    if (uploadError) {

      alert(
        "Képfeltöltési hiba: " +
        uploadError.message
      );

      continue;
    }


    // ADATBÁZISBA IS ELMENTJÜK

    const { error: dbError } =
      await supabase
        .from("record_images")
        .insert({
          record_id: recordId,
          uploader_id: profile.id,
          organization_id:
            profile.organization_id,
          storage_path: path,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size
        });


    // Ha az adatbázisba nem sikerült
    // menteni, töröljük a feltöltött fájlt is.

    if (dbError) {

      await supabase.storage
        .from(IMAGE_BUCKET)
        .remove([path]);


      alert(
        "Képadat mentési hiba: " +
        dbError.message
      );
    }

  }


  // Input ürítése

  input.value = "";


  // Képek frissítése

  await loadImages(recordId);
}


// ==========================================
// KÉPEK BETÖLTÉSE
// ==========================================

async function loadImages(recordId) {

  const container =
    recordsEl.querySelector(
      `[data-images-for="${recordId}"]`
    );


  if (!container) {
    return;
  }


  // KÉPEK ADATAINAK LEKÉRÉSE

  const { data, error } =
    await supabase
      .from("record_images")
      .select(`
        id,
        uploader_id,
        organization_id,
        storage_path,
        original_name,
        created_at,
        organizations(name)
      `)
      .eq("record_id", recordId)
      .order("created_at", {
        ascending: false
      });


  if (error) {

    container.innerHTML =
      `<div class="images-error">
        ${esc(error.message)}
      </div>`;

    return;
  }


  // NINCS KÉP

  if (!data.length) {

    container.innerHTML =
      `<div class="images-empty">
        Még nincs csatolt kép.
      </div>`;

    return;
  }


  // STORAGE ÚTVONALAK

  const paths =
    data.map(
      x => x.storage_path
    );


  // IDEIGLENES, BIZTONSÁGOS URL-EK

  const {
    data: signed,
    error: signedError
  } =
    await supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrls(
        paths,
        3600
      );


  if (signedError) {

    container.innerHTML =
      `<div class="images-error">
        A képek betöltése sikertelen:
        ${esc(signedError.message)}
      </div>`;

    return;
  }


  // URL-EK ÖSSZEKAPCSOLÁSA

  const urlMap =
    new Map(
      (signed || []).map(
        x => [
          x.path,
          x.signedUrl
        ]
      )
    );


  // KÉPEK MEGJELENÍTÉSE

  container.innerHTML =
    data.map(img => {

      const url =
        urlMap.get(
          img.storage_path
        );


      const canRemove =
        profile.role === "admin" ||
        img.uploader_id === profile.id;


      return `
        <figure class="image-card">

          ${
            url
              ? `
                <a
                  href="${esc(url)}"
                  target="_blank"
                  rel="noopener"
                >

                  <img
                    src="${esc(url)}"
                    alt="${esc(
                      img.original_name ||
                      "Csatolt kép"
                    )}"
                    loading="lazy"
                  >

                </a>
              `
              : ""
          }


          <figcaption>

            <span>
              ${esc(
                img.organizations?.name ||
                "Ismeretlen szervezet"
              )}
            </span>


            ${
              canRemove
                ? `
                  <button
                    class="image-delete"
                    data-delete-image="${img.id}"
                    data-path="${esc(
                      img.storage_path
                    )}"
                    data-record="${recordId}"
                  >
                    Törlés
                  </button>
                `
                : ""
            }

          </figcaption>

        </figure>
      `;

    }).join("");


  // KÉP TÖRLÉS GOMBOK

  container
    .querySelectorAll(
      "[data-delete-image]"
    )
    .forEach(
      el => {
        el.onclick = deleteImage;
      }
    );
}


// ==========================================
// KÉP TÖRLÉSE
// ==========================================

async function deleteImage(e) {

  const button =
    e.currentTarget;


  const imageId =
    Number(
      button.dataset.deleteImage
    );


  const path =
    button.dataset.path;


  const recordId =
    Number(
      button.dataset.record
    );


  if (
    !confirm(
      "Biztosan törlöd ezt a képet?"
    )
  ) {

    return;
  }


  // ADATBÁZISBÓL TÖRLÉS

  const { error: dbError } =
    await supabase
      .from("record_images")
      .delete()
      .eq("id", imageId);


  if (dbError) {

    alert(
      "Képtörlési hiba: " +
      dbError.message
    );

    return;
  }


  // STORAGE-BÓL TÖRLÉS

  const {
    error: storageError
  } =
    await supabase.storage
      .from(IMAGE_BUCKET)
      .remove([path]);


  if (storageError) {

    alert(
      "A kép adatbázisból törlődött, " +
      "de a fájl törlése nem sikerült: " +
      storageError.message
    );
  }


  await loadImages(recordId);
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
// BEJEGYZÉS TÖRLÉSE
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
