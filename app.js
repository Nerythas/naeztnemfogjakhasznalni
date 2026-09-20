import {
  createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";


const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// ==========================================
// ALAP ELEMEK
// ==========================================

const login =
  document.getElementById("login");

const app =
  document.getElementById("app");

const setPassword =
  document.getElementById("setPassword");

const msg =
  document.getElementById("loginMsg");

const passwordMsg =
  document.getElementById("passwordMsg");

const recordsEl =
  document.getElementById("records");

const IMAGE_BUCKET =
  "record-images";


let profile = null;


// ==========================================
// JELSZÓCSERE ELEMEK
// ==========================================

const changePasswordBtn =
  document.getElementById("changePasswordBtn");

const passwordChangeModal =
  document.getElementById("passwordChangeModal");

const closePasswordModal =
  document.getElementById("closePasswordModal");

const changePassword1 =
  document.getElementById("changePassword1");

const changePassword2 =
  document.getElementById("changePassword2");

const savePasswordBtn =
  document.getElementById("savePasswordBtn");

const changePasswordMsg =
  document.getElementById("changePasswordMsg");


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


    const {
      error
    } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });


    if (error) {

      msg.textContent =
        error.message;

    } else {

      msg.textContent =
        "";

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
// AUTH ÁLLAPOT
// ==========================================

supabase.auth.onAuthStateChange(
  async (event, session) => {

    const hashParams =
      new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );

    const queryParams =
      new URLSearchParams(
        window.location.search
      );


    const authType =
      hashParams.get("type") ||
      queryParams.get("type");


    const isPasswordSetup =
      event === "PASSWORD_RECOVERY" ||
      authType === "recovery" ||
      authType === "invite";


    // --------------------------------------
    // JELSZÓ BEÁLLÍTÁS / VISSZAÁLLÍTÁS
    // --------------------------------------

    if (
      isPasswordSetup &&
      session
    ) {

      login.classList.add("hidden");

      app.classList.add("hidden");

      setPassword.classList.remove("hidden");

      if (passwordMsg) {
        passwordMsg.textContent = "";
      }

      return;
    }


    // --------------------------------------
    // NINCS SESSION
    // --------------------------------------

    if (!session) {

      app.classList.add("hidden");

      setPassword.classList.add("hidden");

      login.classList.remove("hidden");

      return;
    }


    // --------------------------------------
    // NORMÁL BEJELENTKEZÉS
    // --------------------------------------

    await loadProfile(
      session.user
    );

  }
);


// ==========================================
// FELHASZNÁLÓ / PROFIL
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
      .eq("id", user.id)
      .maybeSingle();


  // --------------------------------------
  // NINCS PROFIL
  // --------------------------------------

  if (error) {

    msg.textContent =
      "Profilhiba: " +
      error.message;

    return;
  }


  if (
    !data ||
    !data.organization_id ||
    !data.organizations
  ) {

    login.classList.remove("hidden");

    app.classList.add("hidden");

    setPassword.classList.add("hidden");

    msg.textContent =
      "A fiókja aktiválva van, de még nincs szervezethez rendelve. Kérjük, várja meg, amíg a rendszergazda hozzárendeli a szervezetét.";

    return;
  }


  profile = data;


  login.classList.add("hidden");

  setPassword.classList.add("hidden");

  app.classList.remove("hidden");


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
    "A saját szervezeti mezők módosíthatók. Más szervezetek adatai csak olvashatók.";


  await loadRecords();

}


// ==========================================
// BEJEGYZÉSEK
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
      `<div class="card">
        Még nincs bejegyzés.
      </div>`;

    return;
  }


  recordsEl.innerHTML =
    data
      .map(renderRecord)
      .join("");


  // --------------------------------------
  // MEZŐK MENTÉSE
  // --------------------------------------

  recordsEl
    .querySelectorAll("[data-save]")
    .forEach(el => {

      el.addEventListener(
        "change",
        saveField
      );

    });


  // --------------------------------------
  // TÖRLÉS
  // --------------------------------------

  recordsEl
    .querySelectorAll("[data-delete]")
    .forEach(el => {

      el.addEventListener(
        "click",
        deleteRecord
      );

    });


  // --------------------------------------
  // KÉPFELTÖLTÉS
  // --------------------------------------

  recordsEl
    .querySelectorAll("[data-upload]")
    .forEach(el => {

      el.addEventListener(
        "change",
        uploadImages
      );

    });


  // --------------------------------------
  // KÉPEK BETÖLTÉSE
  // --------------------------------------

  await Promise.all(
    data.map(
      record =>
        loadImages(record.id)
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

  // ADMIN
  if (
    profile.role === "admin"
  ) {

    return true;

  }


  const organization =
    profile.organizations.name;


  // REFOmix
  if (
    field === "refomix_note"
  ) {

    return organization ===
      "ReFoMix";

  }


  // KÖZTERÜLET
  if (
    field === "kozterulet_note"
  ) {

    return organization ===
      "Közterület";

  }


  // RENDŐRSÉG
  if (
    field === "rendorseg_note"
  ) {

    return organization ===
      "Rendőrség";

  }


  // KÖZÖS ADATOK
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
    Number.isNaN(
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
              data-delete="${record.id}"
            >
              Törlés
            </button>
          `
          : ""
      }

    </div>


    <!-- =================================
         KÖZÖS INFORMÁCIÓ
         ================================= -->

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


    <!-- =================================
         REFOmix
         ================================= -->

    <div
      class="organization-box refomix"
    >

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


    <!-- =================================
         KÖZTERÜLET
         ================================= -->

    <div
      class="organization-box kozterulet"
    >

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


    <!-- =================================
         RENDŐRSÉG
         ================================= -->

    <div
      class="organization-box rendorseg"
    >

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


    <!-- =================================
         KÉPEK
         ================================= -->

    <div class="images-section">

      <div class="section-title">
        📷 Képek
      </div>


      <label class="upload-label">

        📷 Kép csatolása

        <input
          type="file"
          accept="image/*"
          multiple
          data-upload="${record.id}"
        >

      </label>


      <div
        class="images-grid"
        data-images-for="${record.id}"
      >
        <div class="images-loading">
          Képek betöltése…
        </div>
      </div>

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
// MEZŐ MENTÉSE
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

    await loadRecords();

  } else {

    await loadRecords();

  }

}


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

document.getElementById(
  "addBtn"
).onclick = async () => {


  if (
    !profile ||
    !profile.organization_id
  ) {

    alert(
      "Nincs szervezethez rendelve."
    );

    return;

  }


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

        record_date:
          new Date()
            .toISOString()
            .slice(0, 10),

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
// KÉPFELTÖLTÉS
// ==========================================

async function uploadImages(
  event
) {

  const input =
    event.currentTarget;


  const recordId =
    Number(
      input.dataset.upload
    );


  const files =
    Array.from(
      input.files || []
    );


  if (
    !files.length
  ) {

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
            cacheControl:
              "3600",

            upsert:
              false,

            contentType:
              file.type
          }
        );


    if (
      uploadError
    ) {

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

          record_id:
            recordId,

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


    if (
      dbError
    ) {

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


  input.value =
    "";


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


  if (
    !data ||
    data.length === 0
  ) {

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


  if (
    signedError
  ) {

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
      .map(
        img => {

          const url =
            urlMap.get(
              img.storage_path
            );


          const canRemove =
            profile.role === "admin" ||
            img.uploader_id ===
              profile.id;


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

        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-delete-image]"
    )
    .forEach(
      el => {

        el.onclick =
          deleteImage;

      }
    );

}


// ==========================================
// KÉP TÖRLÉSE
// ==========================================

async function deleteImage(
  event
) {

  const button =
    event.currentTarget;


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


  if (
    dbError
  ) {

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


  if (
    storageError
  ) {

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
// JELSZÓ BEÁLLÍTÁSA
// ==========================================

document.getElementById(
  "setPasswordBtn"
).onclick = async () => {


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


  passwordMsg.textContent =
    "";


  if (
    !password ||
    !password2
  ) {

    passwordMsg.textContent =
      "Kérjük, töltse ki mindkét mezőt.";

    return;

  }


  if (
    password !== password2
  ) {

    passwordMsg.textContent =
      "A két jelszó nem egyezik.";

    return;

  }


  const {
    error
  } =
    await supabase.auth.updateUser({
      password
    });


  if (error) {

    passwordMsg.textContent =
      "Hiba: " +
      error.message;

    return;

  }


  passwordMsg.textContent =
    "✓ A jelszó sikeresen beállítva.";


  document.getElementById(
    "newPassword"
  ).value = "";


  document.getElementById(
    "newPassword2"
  ).value = "";


  setTimeout(
    async () => {

      setPassword.classList.add(
        "hidden"
      );

      const {
        data
      } =
        await supabase.auth.getSession();


      if (
        data?.session
      ) {

        await loadProfile(
          data.session.user
        );

      }

    },
    1200
  );

};


// ==========================================
// JELSZÓ CSERE ABLAK
// ==========================================

changePasswordBtn?.addEventListener(
  "click",
  () => {

    changePassword1.value =
      "";

    changePassword2.value =
      "";

    changePasswordMsg.textContent =
      "";

    passwordChangeModal.classList.remove(
      "hidden"
    );

  }
);


// ==========================================
// JELSZÓ CSERE BEZÁRÁSA
// ==========================================

closePasswordModal?.addEventListener(
  "click",
  () => {

    passwordChangeModal.classList.add(
      "hidden"
    );

  }
);


// ==========================================
// KATTINTÁS A HÁTTÉRRE
// ==========================================

passwordChangeModal?.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      passwordChangeModal
    ) {

      passwordChangeModal.classList.add(
        "hidden"
      );

    }

  }
);


// ==========================================
// JELSZÓ MÓDOSÍTÁSA
// ==========================================

savePasswordBtn?.addEventListener(
  "click",
  async () => {

    const password1 =
      changePassword1.value;

    const password2 =
      changePassword2.value;


    changePasswordMsg.textContent =
      "";


    if (
      !password1 ||
      !password2
    ) {

      changePasswordMsg.textContent =
        "Kérjük, adja meg mindkét mezőt.";

      return;

    }


    if (
      password1 !== password2
    ) {

      changePasswordMsg.textContent =
        "A két jelszó nem egyezik.";

      return;

    }


    savePasswordBtn.disabled =
      true;

    savePasswordBtn.textContent =
      "Módosítás…";


    const {
      error
    } =
      await supabase.auth.updateUser({
        password:
          password1
      });


    savePasswordBtn.disabled =
      false;

    savePasswordBtn.textContent =
      "Jelszó módosítása";


    if (error) {

      changePasswordMsg.textContent =
        "Hiba történt: " +
        error.message;

      return;

    }


    changePasswordMsg.textContent =
      "✓ A jelszó sikeresen megváltozott.";


    changePassword1.value =
      "";

    changePassword2.value =
      "";


    setTimeout(
      () => {

        passwordChangeModal.classList.add(
          "hidden"
        );

        changePasswordMsg.textContent =
          "";

      },
      1800
    );

  }
);


// ==========================================
// BIZTONSÁGOS HTML
// ==========================================

function esc(value) {

  return String(
    value ?? ""
  )
    .replace(
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
