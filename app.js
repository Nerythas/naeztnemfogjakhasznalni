import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const login =
  document.getElementById("login");

const app =
  document.getElementById("app");

const msg =
  document.getElementById("loginMsg");

const recordsEl =
  document.getElementById("records");

const setPassword =
  document.getElementById("setPassword");

const passwordMsg =
  document.getElementById("passwordMsg");

let profile = null;

const IMAGE_BUCKET =
  "record-images";


// ==========================================
// BEJELENTKEZÉS
// ==========================================

document.getElementById("loginBtn").onclick =
  async () => {

    msg.textContent =
      "Bejelentkezés…";

    const email =
      document
        .getElementById("email")
        .value
        .trim();

    const password =
      document
        .getElementById("password")
        .value;

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

      msg.textContent =
        error.message;

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
// AUTH ÁLLAPOT FIGYELÉSE
// ==========================================

supabase.auth.onAuthStateChange(
  async (event, session) => {

    if (!session) {

      profile = null;

      app.classList.add("hidden");

      setPassword.classList.add(
        "hidden"
      );

      login.classList.remove(
        "hidden"
      );

      return;
    }


    // ======================================
    // MEGHÍVÓ / JELSZÓBEÁLLÍTÁS
    // ======================================

    if (
      event === "PASSWORD_RECOVERY" ||
      window.location.hash.includes(
        "type=recovery"
      )
    ) {

      login.classList.add(
        "hidden"
      );

      app.classList.add(
        "hidden"
      );

      setPassword.classList.remove(
        "hidden"
      );

      return;
    }


    await loadProfile(
      session.user
    );

  }
);


// ==========================================
// PROFIL BETÖLTÉSE
// ==========================================

async function loadProfile(user) {

  const {
    data,
    error
  } =
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
      .eq(
        "id",
        user.id
      )
      .maybeSingle();


  // ========================================
  // PROFIL HIBA
  // ========================================

  if (error) {

    profile = null;

    app.classList.add(
      "hidden"
    );

    setPassword.classList.add(
      "hidden"
    );

    login.classList.remove(
      "hidden"
    );

    msg.textContent =
      "A profil betöltése nem sikerült: " +
      error.message;

    return;
  }


  // ========================================
  // MÉG NINCS SZERVEZET
  // ========================================

  if (
    !data ||
    !data.organization_id ||
    !data.organizations
  ) {

    profile = null;

    app.classList.add(
      "hidden"
    );

    setPassword.classList.add(
      "hidden"
    );

    login.classList.remove(
      "hidden"
    );

    msg.textContent =
      "A fiókja aktiválva van, de még nincs szervezethez rendelve. Kérjük, várja meg, amíg a rendszergazda hozzárendeli a szervezetét.";

    return;
  }


  // ========================================
  // PROFIL RENDBEN
  // ========================================

  profile = data;

  login.classList.add(
    "hidden"
  );

  setPassword.classList.add(
    "hidden"
  );

  app.classList.remove(
    "hidden"
  );


  document.getElementById(
    "orgName"
  ).textContent =
    data.organizations.name;


  document.getElementById(
    "userInfo"
  ).textContent =
    (data.full_name || user.email) +
    " · " +
    data.organizations.name;


  document.getElementById(
    "permission"
  ).textContent =
    "A saját szervezeti mezők módosíthatók. Más szervezetek adatai csak olvashatók. A képek minden bejelentkezett felhasználó számára megtekinthetők és feltölthetők.";


  await loadRecords();
}


// ==========================================
// BEJEGYZÉSEK BETÖLTÉSE
// ==========================================

async function loadRecords() {

  const {
    data,
    error
  } =
    await supabase
      .from("records_view")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    recordsEl.innerHTML =
      `<div class="card error">
        ${esc(error.message)}
      </div>`;

    return;
  }


  if (
    !data ||
    data.length === 0
  ) {

    recordsEl.innerHTML =
      '<div class="card">Még nincs bejegyzés.</div>';

    return;
  }


  recordsEl.innerHTML =
    data
      .map(renderRecord)
      .join("");


  recordsEl
    .querySelectorAll(
      "[data-save]"
    )
    .forEach(el => {

      el.addEventListener(
        "change",
        saveField
      );

    });


  recordsEl
    .querySelectorAll(
      "[data-delete]"
    )
    .forEach(el => {

      el.addEventListener(
        "click",
        deleteRecord
      );

    });


  recordsEl
    .querySelectorAll(
      "[data-upload]"
    )
    .forEach(el => {

      el.addEventListener(
        "change",
        uploadImages
      );

    });


  const imageContainers =
    recordsEl.querySelectorAll(
      "[data-images-for]"
    );


  await Promise.all(
    Array.from(
      imageContainers
    ).map(el =>
      loadImages(
        Number(
          el.dataset.imagesFor
        )
      )
    )
  );
}


// ==========================================
// JOGOSULTSÁG
// ==========================================

function canEditField(
  record,
  field
) {

  if (
    profile.role === "admin"
  ) {

    return true;
  }


  const organization =
    profile.organizations.name;


  if (
    field === "refomix_note"
  ) {

    return (
      organization ===
      "ReFoMix"
    );

  }


  if (
    field === "kozterulet_note"
  ) {

    return (
      organization ===
      "Közterület"
    );

  }


  if (
    field === "rendorseg_note"
  ) {

    return (
      organization ===
      "Rendőrség"
    );

  }


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

function renderRecord(
  record
) {

  const canLocation =
    canEditField(
      record,
      "location"
    );


  const canStatus =
    canEditField(
      record,
      "status"
    );


  const canRefomix =
    canEditField(
      record,
      "refomix_note"
    );


  const canKozterulet =
    canEditField(
      record,
      "kozterulet_note"
    );


  const canRendorseg =
    canEditField(
      record,
      "rendorseg_note"
    );


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


      <!-- KÖZÖS INFORMÁCIÓ -->

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


      <!-- DÁTUM ÉS IDŐ -->

      <label>

        Dátum és idő

        <input
          type="text"
          value="${esc(
            formatDateTime(
              record.created_at
            )
          )}"
          disabled
        >

      </label>


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

function imageSection(
  recordId
) {

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
        data-images-for="${recordId}"
      >

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
    editable
      ? ""
      : "disabled";


  if (
    type === "textarea"
  ) {

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
              ${
                value === status
                  ? "selected"
                  : ""
              }
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

async function saveField(
  event
) {

  const id =
    Number(
      event.target.dataset.save
    );


  const field =
    event.target.dataset.field;


  const value =
    event.target.value;


  const {
    error
  } =
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

    return;
  }


  await loadRecords();
}


// ==========================================
// KÉPFELTÖLTÉS
// ==========================================

async function uploadImages(
  e
) {

  const input =
    e.currentTarget;


  const recordId =
    Number(
      input.dataset.upload
    );


  const files =
    Array.from(
      input.files || []
    );


  if (!files.length) {
    return;
  }


  for (
    const file of files
  ) {

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {

      alert(
        "Csak képfájl tölthető fel."
      );

      continue;
    }


    if (
      file.size >
      10 * 1024 * 1024
    ) {

      alert(
        `A(z) ${file.name} túl nagy. Maximum 10 MB lehet.`
      );

      continue;
    }


    const safeName =
      file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );


    const path =
      `${profile.id}/${recordId}/${crypto.randomUUID()}-${safeName}`;


    const {
      error: uploadError
    } =
      await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(
          path,
          file,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              file.type
          }
        );


    if (uploadError) {

      alert(
        "Képfeltöltési hiba: " +
        uploadError.message
      );

      continue;
    }


    const {
      error: dbError
    } =
      await supabase
        .from("record_images")
        .insert({
          record_id: recordId,
          uploader_id:
            profile.id,
          organization_id:
            profile.organization_id,
          storage_path:
            path,
          original_name:
            file.name,
          mime_type:
            file.type,
          size_bytes:
            file.size
        });


    if (dbError) {

      await supabase.storage
        .from(IMAGE_BUCKET)
        .remove([
          path
        ]);


      alert(
        "Képadat mentési hiba: " +
        dbError.message
      );
    }

  }


  input.value = "";

  await loadImages(
    recordId
  );
}


// ==========================================
// KÉPEK BETÖLTÉSE
// ==========================================

async function loadImages(
  recordId
) {

  const container =
    recordsEl.querySelector(
      `[data-images-for="${recordId}"]`
    );


  if (!container) {
    return;
  }


  const {
    data,
    error
  } =
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
      .eq(
        "record_id",
        recordId
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    container.innerHTML =
      `<div class="images-error">
        ${esc(error.message)}
      </div>`;

    return;
  }


  if (!data.length) {

    container.innerHTML =
      `<div class="images-empty">
        Még nincs csatolt kép.
      </div>`;

    return;
  }


  const paths =
    data.map(
      x => x.storage_path
    );


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
        ${esc(
          signedError.message
        )}
      </div>`;

    return;
  }


  const urlMap =
    new Map(
      (signed || []).map(
        x => [
          x.path,
          x.signedUrl
        ]
      )
    );


  container.innerHTML =
    data
      .map(img => {

        const url =
          urlMap.get(
            img.storage_path
          );


        const canRemove =
          profile.role === "admin" ||
          img.uploader_id ===
          profile.id;


        return `
          <figure
            class="image-card"
          >

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

      })
      .join("");


  container
    .querySelectorAll(
      "[data-delete-image]"
    )
    .forEach(el => {

      el.onclick =
        deleteImage;

    });
}


// ==========================================
// KÉP TÖRLÉSE
// ==========================================

async function deleteImage(
  e
) {

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


  const {
    error: dbError
  } =
    await supabase
      .from("record_images")
      .delete()
      .eq(
        "id",
        imageId
      );


  if (dbError) {

    alert(
      "Képtörlési hiba: " +
      dbError.message
    );

    return;
  }


  const {
    error: storageError
  } =
    await supabase.storage
      .from(IMAGE_BUCKET)
      .remove([
        path
      ]);


  if (storageError) {

    alert(
      "A kép adatbázisból törlődött, " +
      "de a fájl törlése nem sikerült: " +
      storageError.message
    );
  }


  await loadImages(
    recordId
  );
}


// ==========================================
// ÚJ BEJEGYZÉS
// ==========================================

document.getElementById(
  "addBtn"
).onclick =
  async () => {

    const {
      error
    } =
      await supabase
        .from("records")
        .insert({
          created_by:
            profile.id,

          organization_id:
            profile.organization_id,

          location:
            "",

          status:
            "Új"
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

async function deleteRecord(
  event
) {

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


  const {
    error
  } =
    await supabase
      .from("records")
      .delete()
      .eq(
        "id",
        id
      );


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
// DÁTUM ÉS IDŐ
// ==========================================

function formatDateTime(
  value
) {

  if (!value) {
    return "";
  }


  const date =
    new Date(value);


  if (
    isNaN(
      date.getTime()
    )
  ) {

    return "";
  }


  return date.toLocaleString(
    "hu-HU",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


// ==========================================
// BIZTONSÁGOS HTML
// ==========================================

function esc(
  value
) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    character => ({
      "&":
        "&amp;",
      "<":
        "&lt;",
      ">":
        "&gt;",
      '"':
        "&quot;",
      "'":
        "&#039;"
    }[character])
  );
}


// ==========================================
// JELSZÓ BEÁLLÍTÁSA
// ==========================================

document.getElementById(
  "setPasswordBtn"
).onclick =
  async () => {

    const password =
      document
        .getElementById(
          "newPassword"
        )
        .value;


    const password2 =
      document
        .getElementById(
          "newPassword2"
        )
        .value;


    if (
      !password ||
      !password2
    ) {

      passwordMsg.textContent =
        "Kérjük, töltse ki mindkét mezőt.";

      return;
    }


    if (
      password.length < 6
    ) {

      passwordMsg.textContent =
        "A jelszónak legalább 6 karakter hosszúnak kell lennie.";

      return;
    }


    if (
      password !== password2
    ) {

      passwordMsg.textContent =
        "A két jelszó nem egyezik.";

      return;
    }


    passwordMsg.textContent =
      "Jelszó mentése…";


    const {
      error
    } =
      await supabase.auth.updateUser({
        password:
          password
      });


    if (error) {

      passwordMsg.textContent =
        "Hiba: " +
        error.message;

      return;
    }


    passwordMsg.textContent =
      "A jelszó sikeresen beállítva.";


    // Jelszó beállítása után
    // betöltjük a profilt.

    const {
      data: userData
    } =
      await supabase.auth.getUser();


    if (
      userData &&
      userData.user
    ) {

      setTimeout(
        async () => {

          await loadProfile(
            userData.user
          );

        },
        800
      );

    }

  };
