const API_BASE = "";

let fitProfiles = [];
let accuracyChart = null;

let profileSelectedFile = null;
let profileImageUrl = null;
let profileClickCount = 0;
let profilePointA = null;
let profilePointB = null;

let selectedSizeChartFile = null;
let sizeChartImageUrl = null;
let pendingProfileMeasurement = null;

const byId = (id) => document.getElementById(id);


function setStatus(element, message, type = "") {
  if (!element) return;

  element.hidden = false;
  element.className = type ? `status ${type}` : "status";
  element.textContent = message;
}


function clearStatus(element) {
  if (!element) return;

  element.hidden = true;
  element.textContent = "";
}


// ============================================================
// NAVIGATION
// ============================================================

const pages = {
  home: byId("page-home"),
  customer: byId("page-customer"),
  dashboard: byId("page-dashboard"),
  about: byId("page-about"),
};


const nav = byId("nav-links");
const menuToggle = byId("menu-toggle");


function showPage(name, options = {}) {

  Object.entries(pages).forEach(([key, element]) => {

    if (element) {
      element.classList.toggle(
        "active",
        key === name
      );
    }

  });


  document
    .querySelectorAll("[data-nav]")
    .forEach((link) => {

      link.classList.toggle(
        "active",
        link.dataset.nav === name
      );

    });


  nav?.classList.remove("open");


  if (options.scrollTo) {

    setTimeout(() => {

      byId(options.scrollTo)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

    }, 30);

  } else {

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }


  if (
    name === "home" ||
    name === "customer"
  ) {

    loadFitProfiles();

  }


  if (name === "dashboard") {

    loadDashboard();

  }

}


function pageFromHash() {

  const hash =
    (location.hash || "#home")
      .replace("#", "");


  if (hash === "find-size") {

    return {
      name: "home",
      scrollTo: "find-size"
    };

  }


  return {
    name:
      pages[hash]
        ? hash
        : "home"
  };

}


window.addEventListener(
  "hashchange",
  () => {

    const next =
      pageFromHash();


    showPage(
      next.name,
      {
        scrollTo:
          next.scrollTo
      }
    );

  }
);


document
  .querySelectorAll("[data-nav]")
  .forEach((link) => {

    link.addEventListener(
      "click",
      (event) => {

        const target =
          event.currentTarget.dataset.nav;


        if (!target) {
          return;
        }


        event.preventDefault();

        location.hash =
          target;

        showPage(target);

      }
    );

  });


menuToggle?.addEventListener(
  "click",
  () => {

    nav?.classList.toggle("open");

  }
);


// ============================================================
// API
// ============================================================

async function api(
  path,
  options = undefined
) {

  const response =
    await fetch(
      `${API_BASE}${path}`,
      options
    );


  const data =
    await response
      .json()
      .catch(() => ({}));


  if (!response.ok) {

    const detail =
      data.detail;


    const message =
      typeof detail === "string"

        ? detail

        : detail

          ? JSON.stringify(detail)

          : "Request failed";


    throw new Error(message);

  }


  return data;

}


// ============================================================
// FIT PROFILES
// ============================================================

function currentFitProfile() {

  const select =
    byId("fit-profile-select");


  if (!select) {
    return null;
  }


  return (
    fitProfiles.find(
      (profile) =>
        String(profile.id) ===
        select.value
    ) || null
  );

}


function populateFitProfileSelect() {

  const select =
    byId("fit-profile-select");


  if (!select) {
    return;
  }


  const previous =
    select.value;


  if (!fitProfiles.length) {

    select.innerHTML = `
      <option value="">
        No fit profiles yet — create one first
      </option>
    `;


    updateSelectedProfile();

    return;

  }


  select.innerHTML =
    fitProfiles
      .map(
        (profile) => `
          <option value="${profile.id}">
            ${escapeHtml(profile.profile_name)}
            — ${escapeHtml(
              profile.reference_garment_name ||
              "Reference garment"
            )}
          </option>
        `
      )
      .join("");


  if (
    previous &&
    fitProfiles.some(
      (profile) =>
        String(profile.id) ===
        previous
    )
  ) {

    select.value =
      previous;

  }


  updateSelectedProfile();

}


function profileRowsHtml() {

  if (!fitProfiles.length) {

    return `
      <tr>
        <td colspan="5">
          No fit profiles created yet.
        </td>
      </tr>
    `;

  }


  return fitProfiles
    .map(
      (profile) => `
        <tr>

          <td>
            ${escapeHtml(profile.profile_name)}
          </td>

          <td>
            ${escapeHtml(
              profile.reference_garment_name ||
              "—"
            )}
          </td>

          <td>
            ${Number(
              profile.preferred_chest_cm
            ).toFixed(2)} cm
          </td>

          <td>
            ${Number(
              profile.preferred_length_cm
            ).toFixed(2)} cm
          </td>

          <td>
            ${escapeHtml(
              capitalize(
                profile.fit_preference
              )
            )}
          </td>

        </tr>
      `
    )
    .join("");

}


function renderProfileTables() {

  const rows =
    profileRowsHtml();


  const profileTable =
    byId("fit-profiles-table");


  const dashboardTable =
    byId("dashboard-profile-table");


  if (profileTable) {

    profileTable.innerHTML =
      rows;

  }


  if (dashboardTable) {

    dashboardTable.innerHTML =
      rows;

  }

}


function updateSelectedProfile() {

  const profile =
    currentFitProfile();


  const chest =
    byId("find-profile-chest");


  const length =
    byId("find-profile-length");


  const preference =
    byId("find-profile-preference");


  if (
    !chest ||
    !length ||
    !preference
  ) {

    return;

  }


  if (!profile) {

    chest.textContent = "—";
    length.textContent = "—";
    preference.textContent = "—";

    return;

  }


  chest.textContent =
    `${Number(
      profile.preferred_chest_cm
    ).toFixed(2)} cm`;


  length.textContent =
    `${Number(
      profile.preferred_length_cm
    ).toFixed(2)} cm`;


  preference.textContent =
    capitalize(
      profile.fit_preference
    );

}


async function loadFitProfiles() {

  try {

    fitProfiles =
      await api(
        "/api/fit-profiles"
      );


    populateFitProfileSelect();

    renderProfileTables();


  } catch (error) {

    console.error(
      "Could not load fit profiles:",
      error
    );


    const select =
      byId("fit-profile-select");


    if (select) {

      select.innerHTML = `
        <option value="">
          Could not load fit profiles
        </option>
      `;

    }


    const profileTable =
      byId("fit-profiles-table");


    const dashboardTable =
      byId(
        "dashboard-profile-table"
      );


    const row = `
      <tr>
        <td colspan="5">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;


    if (profileTable) {

      profileTable.innerHTML =
        row;

    }


    if (dashboardTable) {

      dashboardTable.innerHTML =
        row;

    }

  }

}


byId("fit-profile-select")
  ?.addEventListener(
    "change",
    updateSelectedProfile
  );


// ============================================================
// FIT PROFILE IMAGE + CALIBRATION
// ============================================================

const profileDropzone =
  byId("profile-dropzone");


const profileFileInput =
  byId("profile-file-input");


const profileRefWidthInput =
  byId("profile-ref-width");


const profileCalibrationWrap =
  byId(
    "profile-calibration-wrap"
  );


const profileCalibrationImg =
  byId(
    "profile-calibration-img"
  );


const profileCalibrationStage =
  byId(
    "profile-calibration-stage"
  );


const profilePinA =
  byId("profile-pin-a");


const profilePinB =
  byId("profile-pin-b");


function placeProfilePin(
  pin,
  x,
  y
) {

  if (!pin) {
    return;
  }


  pin.style.left =
    `${x}px`;


  pin.style.top =
    `${y}px`;


  pin.hidden =
    false;

}


function resetProfileCalibrationPoints() {

  profileClickCount = 0;

  profilePointA = null;

  profilePointB = null;


  if (profilePinA) {
    profilePinA.hidden = true;
  }


  if (profilePinB) {
    profilePinB.hidden = true;
  }


  const feedback =
    byId(
      "profile-calib-feedback"
    );


  if (feedback) {

    feedback.textContent =
      "Auto-detection will be used if you do not select manual points.";

  }

}


function setProfileDropPreview(file) {

  profileSelectedFile =
    file;


  if (profileImageUrl) {

    URL.revokeObjectURL(
      profileImageUrl
    );

  }


  profileImageUrl =
    URL.createObjectURL(file);


  if (profileDropzone) {

    profileDropzone
      .classList
      .add("has-file");


    profileDropzone.innerHTML =
      "";


    const preview =
      document.createElement(
        "img"
      );


    preview.src =
      profileImageUrl;


    preview.alt =
      "Reference garment";


    profileDropzone
      .appendChild(preview);

  }


  if (profileRefWidthInput) {

    profileRefWidthInput.value =
      "";

  }


  resetProfileCalibrationPoints();


  if (profileCalibrationImg) {

    profileCalibrationImg.onload =
      () => {

        if (
          profileCalibrationWrap
        ) {

          profileCalibrationWrap.hidden =
            false;

        }

      };


    profileCalibrationImg.src =
      profileImageUrl;

  }

}


profileDropzone
  ?.addEventListener(
    "dragover",
    (event) => {

      event.preventDefault();

    }
  );


profileDropzone
  ?.addEventListener(
    "drop",
    (event) => {

      event.preventDefault();


      const file =
        event.dataTransfer.files[0];


      if (file) {

        setProfileDropPreview(
          file
        );

      }

    }
  );


profileFileInput
  ?.addEventListener(
    "change",
    () => {

      const file =
        profileFileInput.files[0];


      if (file) {

        setProfileDropPreview(
          file
        );

      }

    }
  );


profileCalibrationStage
  ?.addEventListener(
    "click",
    (event) => {

      if (!profileCalibrationImg) {
        return;
      }


      const imgRect =
        profileCalibrationImg
          .getBoundingClientRect();


      if (
        event.clientX < imgRect.left ||
        event.clientX > imgRect.right ||
        event.clientY < imgRect.top ||
        event.clientY > imgRect.bottom
      ) {
        return;
      }


      const displayedX =
        event.clientX -
        imgRect.left;


      const displayedY =
        event.clientY -
        imgRect.top;


      const scaleX =
        profileCalibrationImg.naturalWidth /
        imgRect.width;


      const scaleY =
        profileCalibrationImg.naturalHeight /
        imgRect.height;


      const naturalX =
        displayedX *
        scaleX;


      const naturalY =
        displayedY *
        scaleY;


      const stageRect =
        profileCalibrationStage
          .getBoundingClientRect();


      const pinX =
        event.clientX -
        stageRect.left;


      const pinY =
        event.clientY -
        stageRect.top;


      if (
        profileClickCount === 0 ||
        profileClickCount >= 2
      ) {

        resetProfileCalibrationPoints();


        profilePointA = {

          naturalX,
          naturalY

        };


        placeProfilePin(
          profilePinA,
          pinX,
          pinY
        );


        profileClickCount =
          1;


        const feedback =
          byId(
            "profile-calib-feedback"
          );


        if (feedback) {

          feedback.textContent =
            "First point selected. Click the other end of the same 29.7 cm A4 edge.";

        }


        return;
      }


      profilePointB = {

        naturalX,
        naturalY

      };


      placeProfilePin(
        profilePinB,
        pinX,
        pinY
      );


      profileClickCount =
        2;


      const dx =
        profilePointB.naturalX -
        profilePointA.naturalX;


      const dy =
        profilePointB.naturalY -
        profilePointA.naturalY;


      const actualPixelDistance =
        Math.hypot(
          dx,
          dy
        );


      if (
        profileRefWidthInput
      ) {

        profileRefWidthInput.value =
          Math.round(
            actualPixelDistance
          );

      }


      const feedback =
        byId(
          "profile-calib-feedback"
        );


      if (feedback) {

        feedback.textContent =
          `✓ Manual A4 calibration set: ${Math.round(
            actualPixelDistance
          )} px.`;

      }

    }
  );


byId("profile-recalibrate-btn")
  ?.addEventListener(
    "click",
    () => {

      resetProfileCalibrationPoints();


      if (
        profileRefWidthInput
      ) {

        profileRefWidthInput.value =
          "";

      }

    }
  );


// ============================================================
// FIT PROFILE — MEASURE FIRST
// ============================================================

byId("fit-profile-form")
  ?.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();

    }
  );


byId("measure-profile-btn")
  ?.addEventListener(
    "click",
    async () => {

      const status =
        byId(
          "fit-profile-status"
        );


      const button =
        byId(
          "measure-profile-btn"
        );


      const preview =
        byId(
          "profile-measurement-preview"
        );


      const profileName =
        byId("profile-name")
          ?.value
          .trim() || "";


      const garmentName =
        byId(
          "reference-garment-name"
        )
          ?.value
          .trim() || "";


      const fitPreference =
        byId(
          "fit-preference"
        )
          ?.value ||
        "regular";


      const refRaw =
        profileRefWidthInput
          ?.value
          .trim() || "";


      const refWidth =
        refRaw === ""
          ? null
          : Number(refRaw);


      pendingProfileMeasurement =
        null;


      if (preview) {

        preview.hidden =
          true;

      }


      if (!profileName) {

        setStatus(
          status,
          "Enter a profile name.",
          "error"
        );

        return;

      }


      if (
        !profileSelectedFile
      ) {

        setStatus(
          status,
          "Upload your reference garment first.",
          "error"
        );

        return;

      }


      if (
        refWidth !== null &&
        (
          !Number.isFinite(
            refWidth
          ) ||
          refWidth <= 0
        )
      ) {

        setStatus(
          status,
          "Manual reference length must be a positive number.",
          "error"
        );

        return;

      }


      button.disabled =
        true;


      setStatus(
        status,
        refWidth
          ? "Measuring garment with manual calibration…"
          : "Measuring garment…"
      );


      try {

        const form =
          new FormData();


        form.append(
          "file",
          profileSelectedFile
        );


        if (
          refWidth !== null
        ) {

          form.append(
            "reference_object_width_px",
            String(refWidth)
          );

        }


        const measurement =
          await api(
            "/measure",
            {

              method:
                "POST",

              body:
                form

            }
          );


        pendingProfileMeasurement = {

          profileName,

          garmentName:
            garmentName ||
            profileSelectedFile.name,

          fitPreference,

          chest:
            Number(
              measurement.chest_cm
            ),

          length:
            Number(
              measurement.length_cm
            )

        };


        const chestPreview =
          byId(
            "preview-profile-chest"
          );


        const lengthPreview =
          byId(
            "preview-profile-length"
          );


        if (chestPreview) {

          chestPreview.textContent =
            `${pendingProfileMeasurement.chest.toFixed(2)} cm`;

        }


        if (lengthPreview) {

          lengthPreview.textContent =
            `${pendingProfileMeasurement.length.toFixed(2)} cm`;

        }


        if (preview) {

          preview.hidden =
            false;

        }


        setStatus(
          status,
          "Measurement complete. Check the result before saving.",
          "success"
        );


        preview
          ?.scrollIntoView({
            behavior:
              "smooth",
            block:
              "nearest"
          });


      } catch (error) {

        pendingProfileMeasurement =
          null;


        setStatus(
          status,
          error.message,
          "error"
        );


      } finally {

        button.disabled =
          false;

      }

    }
  );


// ============================================================
// SAVE CONFIRMED FIT PROFILE
// ============================================================

byId("save-profile-btn")
  ?.addEventListener(
    "click",
    async () => {

      const status =
        byId(
          "fit-profile-status"
        );


      const button =
        byId(
          "save-profile-btn"
        );


      if (
        !pendingProfileMeasurement
      ) {

        setStatus(
          status,
          "Measure the garment first.",
          "error"
        );

        return;

      }


      button.disabled =
        true;


      setStatus(
        status,
        "Saving Fit Profile…"
      );


      try {

        await api(
          "/api/fit-profiles",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json"

            },


            body:
              JSON.stringify({

                profile_name:
                  pendingProfileMeasurement
                    .profileName,

                reference_garment_name:
                  pendingProfileMeasurement
                    .garmentName,

                preferred_chest_cm:
                  pendingProfileMeasurement
                    .chest,

                preferred_length_cm:
                  pendingProfileMeasurement
                    .length,

                fit_preference:
                  pendingProfileMeasurement
                    .fitPreference

              })

          }
        );


        setStatus(
          status,
          `Fit profile saved — Chest: ${pendingProfileMeasurement.chest.toFixed(2)} cm, Length: ${pendingProfileMeasurement.length.toFixed(2)} cm.`,
          "success"
        );


        pendingProfileMeasurement =
          null;


        const preview =
          byId(
            "profile-measurement-preview"
          );


        if (preview) {

          preview.hidden =
            true;

        }


        await loadFitProfiles();


      } catch (error) {

        setStatus(
          status,
          error.message,
          "error"
        );


      } finally {

        button.disabled =
          false;

      }

    }
  );


// ============================================================
// RECALIBRATE / MEASURE AGAIN
// ============================================================

byId("remeasure-profile-btn")
  ?.addEventListener(
    "click",
    () => {

      pendingProfileMeasurement =
        null;


      const preview =
        byId(
          "profile-measurement-preview"
        );


      if (preview) {

        preview.hidden =
          true;

      }


      resetProfileCalibrationPoints();


      if (
        profileRefWidthInput
      ) {

        profileRefWidthInput.value =
          "";

      }


      clearStatus(
        byId(
          "fit-profile-status"
        )
      );


      profileCalibrationStage
        ?.scrollIntoView({
          behavior:
            "smooth",
          block:
            "center"
        });

    }
  );


// ============================================================
// SIZE CHART OCR
// ============================================================

const sizeChartFileInput =
  byId("size-chart-file");


const sizeChartDropzone =
  byId("size-chart-dropzone");


const extractSizeChartBtn =
  byId(
    "extract-size-chart-btn"
  );


const ocrStatus =
  byId("ocr-status");


const ocrPreviewWrap =
  byId("ocr-preview-wrap");


const ocrPreview =
  byId("ocr-preview");


const extractedSizesWrap =
  byId(
    "extracted-sizes-wrap"
  );


const productSizeBody =
  byId(
    "product-size-body"
  );


function setSizeChartPreview(
  file
) {

  selectedSizeChartFile =
    file;


  if (sizeChartImageUrl) {

    URL.revokeObjectURL(
      sizeChartImageUrl
    );

  }


  sizeChartImageUrl =
    URL.createObjectURL(
      file
    );


  if (sizeChartDropzone) {

    sizeChartDropzone
      .classList
      .add("has-file");


    sizeChartDropzone.innerHTML =
      "";


    const image =
      document.createElement(
        "img"
      );


    image.src =
      sizeChartImageUrl;


    image.alt =
      "Uploaded retailer size chart";


    sizeChartDropzone
      .appendChild(image);

  }


  clearStatus(
    ocrStatus
  );


  if (
    ocrPreviewWrap
  ) {

    ocrPreviewWrap.hidden =
      true;

  }


  if (
    extractedSizesWrap
  ) {

    extractedSizesWrap.hidden =
      true;

  }


  if (
    productSizeBody
  ) {

    productSizeBody.innerHTML =
      "";

  }


  resetSizeRecommendation();

}


sizeChartFileInput
  ?.addEventListener(
    "change",
    () => {

      const file =
        sizeChartFileInput
          .files[0];


      if (file) {

        setSizeChartPreview(
          file
        );

      }

    }
  );


sizeChartDropzone
  ?.addEventListener(
    "dragover",
    (event) => {

      event.preventDefault();

    }
  );


sizeChartDropzone
  ?.addEventListener(
    "drop",
    (event) => {

      event.preventDefault();


      const file =
        event
          .dataTransfer
          .files[0];


      if (file) {

        setSizeChartPreview(
          file
        );

      }

    }
  );


function normalizeOCRText(
  text
) {

  return String(
    text || ""
  )

    .replace(/\r/g, "")

    .replace(/[|]/g, " ")

    .replace(/\t/g, " ")

    .replace(
      /[ ]{2,}/g,
      " "
    )

    .trim();

}


function normalizeSizeLabel(
  value
) {

  return String(
    value || ""
  )

    .trim()

    .toUpperCase()

    .replace(
      /[^A-Z0-9]/g,
      ""
    );

}


function isValidSizeLabel(
  value
) {

  const normalized =
    normalizeSizeLabel(
      value
    );


  const knownSizes =
    new Set([
      "XXS",
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
      "XXXL",
      "2XL",
      "3XL",
      "4XL",
      "5XL"
    ]);


  return (
    knownSizes.has(
      normalized
    ) ||
    /^\d{1,3}$/.test(
      normalized
    )
  );

}


function extractNumbers(
  line
) {

  const matches =
    String(line)
      .match(
        /\d+(?:\.\d+)?/g
      );


  if (!matches) {

    return [];

  }


  return matches

    .map(Number)

    .filter(
      (number) =>
        Number.isFinite(
          number
        ) &&
        number > 0 &&
        number < 250
    );

}


function parseRowBasedSizeChart(
  lines
) {

  const results = [];


  lines.forEach(
    (line) => {

      const tokens =
        line
          .trim()
          .split(/\s+/);


      if (
        tokens.length < 3
      ) {

        return;

      }


      const possibleSize =
        normalizeSizeLabel(
          tokens[0]
        );


      if (
        !isValidSizeLabel(
          possibleSize
        )
      ) {

        return;

      }


      const numbers =
        extractNumbers(
          tokens
            .slice(1)
            .join(" ")
        );


      if (
        numbers.length < 2
      ) {

        return;

      }


      results.push({

        size:
          possibleSize,

        chest:
          numbers[0],

        length:
          numbers[1]

      });

    }
  );


  return results;

}


function parseColumnBasedSizeChart(
  lines
) {

  let sizeLabels = [];

  let chestValues = [];

  let lengthValues = [];


  lines.forEach(
    (line) => {

      const lower =
        line.toLowerCase();


      if (
        lower.includes(
          "size"
        )
      ) {

        const detected =
          line
            .split(/\s+/)

            .map(
              normalizeSizeLabel
            )

            .filter(
              isValidSizeLabel
            );


        if (
          detected.length >= 2
        ) {

          sizeLabels =
            detected;

        }

      }


      if (
        lower.includes(
          "chest"
        ) ||
        lower.includes(
          "bust"
        ) ||
        lower.includes(
          "width"
        )
      ) {

        chestValues =
          extractNumbers(
            line
          );

      }


      if (
        lower.includes(
          "length"
        ) ||
        lower.includes(
          "body length"
        )
      ) {

        lengthValues =
          extractNumbers(
            line
          );

      }

    }
  );


  if (
    !sizeLabels.length ||
    !chestValues.length ||
    !lengthValues.length
  ) {

    return [];

  }


  const count =
    Math.min(
      sizeLabels.length,
      chestValues.length,
      lengthValues.length
    );


  return Array.from(
    {
      length:
        count
    },

    (_, index) => ({

      size:
        sizeLabels[index],

      chest:
        chestValues[index],

      length:
        lengthValues[index]

    })
  );

}


function parseTokenSequence(
  text
) {

  const tokens =
    normalizeOCRText(
      text
    )
      .split(/\s+/);


  const results = [];


  for (
    let index = 0;
    index < tokens.length - 2;
    index += 1
  ) {

    const possibleSize =
      normalizeSizeLabel(
        tokens[index]
      );


    if (
      !isValidSizeLabel(
        possibleSize
      )
    ) {

      continue;

    }


    const first =
      Number(
        tokens[index + 1]
          .replace(
            /[^\d.]/g,
            ""
          )
      );


    const second =
      Number(
        tokens[index + 2]
          .replace(
            /[^\d.]/g,
            ""
          )
      );


    if (
      Number.isFinite(
        first
      ) &&
      Number.isFinite(
        second
      ) &&
      first > 0 &&
      second > 0 &&
      first < 250 &&
      second < 250
    ) {

      results.push({

        size:
          possibleSize,

        chest:
          first,

        length:
          second

      });


      index += 2;

    }

  }


  return results;

}


function correctAndSortSizes(
  sizes
) {

  const sizeOrder = [
    "XXS",
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
    "XXXL",
    "2XL",
    "3XL",
    "4XL",
    "5XL"
  ];


  let cleaned =
    sizes

      .map(
        (item) => ({

          size:
            normalizeSizeLabel(
              item.size
            ),

          chest:
            Number(
              item.chest
            ),

          length:
            Number(
              item.length
            )

        })
      )

      .filter(
        (item) =>
          item.size &&
          Number.isFinite(
            item.chest
          ) &&
          Number.isFinite(
            item.length
          ) &&
          item.chest > 0 &&
          item.length > 0
      );


  const labels =
    cleaned.map(
      (item) =>
        item.size
    );


  const hasLetterSizing =
    labels.some(
      (label) =>
        [
          "XS",
          "S",
          "M",
          "L",
          "XL",
          "XXL"
        ].includes(
          label
        )
    );


  const alreadyHasS =
    labels.includes(
      "S"
    );


  if (
    hasLetterSizing &&
    !alreadyHasS
  ) {

    cleaned =
      cleaned.map(
        (item) => {

          if (
            item.size === "3" ||
            item.size === "5"
          ) {

            return {
              ...item,
              size: "S"
            };

          }


          return item;

        }
      );

  }


  const deduped = [];


  cleaned.forEach(
    (item) => {

      if (
        !deduped.some(
          (existing) =>
            existing.size ===
            item.size
        )
      ) {

        deduped.push(
          item
        );

      }

    }
  );


  deduped.sort(
    (a, b) => {

      const aIndex =
        sizeOrder.indexOf(
          a.size
        );


      const bIndex =
        sizeOrder.indexOf(
          b.size
        );


      if (
        aIndex !== -1 &&
        bIndex !== -1
      ) {

        return (
          aIndex -
          bIndex
        );

      }


      if (
        aIndex !== -1
      ) {

        return -1;

      }


      if (
        bIndex !== -1
      ) {

        return 1;

      }


      const aNumber =
        Number(a.size);


      const bNumber =
        Number(b.size);


      if (
        Number.isFinite(
          aNumber
        ) &&
        Number.isFinite(
          bNumber
        )
      ) {

        return (
          aNumber -
          bNumber
        );

      }


      return a.size
        .localeCompare(
          b.size
        );

    }
  );


  return deduped;

}


// ============================================================
// VALIDATE RETAILER SIZE CHART
// ============================================================

function validateSizeChartText(text) {

  const normalized =
    String(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ");


  const hasChest =
    /\bchest\b/.test(normalized) ||
    /\bbust\b/.test(normalized) ||
    /chest width/.test(normalized) ||
    /half chest/.test(normalized) ||
    /1\/2 chest/.test(normalized) ||
    /pit to pit/.test(normalized) ||
    /pit-to-pit/.test(normalized);


  const hasLength =
    /\blength\b/.test(normalized) ||
    /body length/.test(normalized) ||
    /garment length/.test(normalized) ||
    /total length/.test(normalized);


  const looksLikeBodyChart =
    /body measurement/.test(normalized) ||
    /body measurements/.test(normalized) ||
    /body size/.test(normalized) ||
    /body sizing/.test(normalized);


  if (looksLikeBodyChart) {

    return {
      valid: false,
      message:
        "This appears to be a body-measurement size chart. TrueFit needs garment measurements such as chest width and garment length."
    };

  }


  if (!hasChest && !hasLength) {

    return {
      valid: false,
      message:
        "TrueFit could not find chest width or garment length in this chart. Upload a garment-measurement chart or enter the values manually."
    };

  }


  if (!hasChest) {

    return {
      valid: false,
      message:
        "Garment length was detected, but chest width was not found."
    };

  }


  if (!hasLength) {

    return {
      valid: false,
      message:
        "Chest width was detected, but garment length was not found."
    };

  }


  return {
    valid: true,
    message:
      "Required garment measurements detected."
  };

}


function parseSizeChartOCR(
  text
) {

  const normalized =
    normalizeOCRText(
      text
    );


  const lines =
    normalized

      .split("\n")

      .map(
        (line) =>
          line.trim()
      )

      .filter(Boolean);


  const candidates = [

    parseRowBasedSizeChart(
      lines
    ),

    parseColumnBasedSizeChart(
      lines
    ),

    parseTokenSequence(
      normalized
    )

  ];


  const best =
    candidates

      .sort(
        (a, b) =>
          b.length -
          a.length
      )[0] || [];


  return correctAndSortSizes(
    best
  );

}


function guessUnitFromSizes(
  sizes
) {

  if (!sizes.length) {

    return "cm";

  }


  const chests =
    sizes

      .map(
        (item) =>
          Number(
            item.chest
          )
      )

      .filter(
        Number.isFinite
      );


  const lengths =
    sizes

      .map(
        (item) =>
          Number(
            item.length
          )
      )

      .filter(
        Number.isFinite
      );


  if (
    !chests.length ||
    !lengths.length
  ) {

    return "cm";

  }


  const maxChest =
    Math.max(
      ...chests
    );


  const maxLength =
    Math.max(
      ...lengths
    );


  return (
    maxChest <= 35 &&
    maxLength <= 50
  )
    ? "in"
    : "cm";

}


function addSizeRow(
  size = "",
  chest = "",
  length = ""
) {

  if (
    !productSizeBody
  ) {

    return;

  }


  const row =
    document.createElement(
      "tr"
    );


  row.className =
    "product-size-row";


  row.innerHTML = `

    <td>

      <input
        class="size-name"
        type="text"
        value="${escapeAttribute(size)}"
        placeholder="M"
      >

    </td>


    <td>

      <input
        class="size-chest"
        type="number"
        step="0.1"
        min="0.1"
        value="${escapeAttribute(chest)}"
        placeholder="43"
      >

    </td>


    <td>

      <input
        class="size-length"
        type="number"
        step="0.1"
        min="0.1"
        value="${escapeAttribute(length)}"
        placeholder="64"
      >

    </td>


    <td class="row-action-cell">

      <button
        type="button"
        class="remove-size-row btn btn-ghost icon-btn"
        aria-label="Remove size row"
      >
        ×
      </button>

    </td>

  `;


  productSizeBody
    .appendChild(
      row
    );

}


function displayExtractedSizes(
  sizes
) {

  if (
    !productSizeBody ||
    !extractedSizesWrap
  ) {

    return;

  }


  const cleanedSizes =
    correctAndSortSizes(
      sizes
    );


  productSizeBody.innerHTML =
    "";


  cleanedSizes.forEach(
    (item) => {

      addSizeRow(
        item.size,
        item.chest,
        item.length
      );

    }
  );


  if (
    !cleanedSizes.length
  ) {

    addSizeRow();

  }


  const unitSelect =
    byId(
      "size-chart-unit"
    );


  if (
    unitSelect &&
    cleanedSizes.length
  ) {

    unitSelect.value =
      guessUnitFromSizes(
        cleanedSizes
      );

  }


  extractedSizesWrap.hidden =
    false;


  resetSizeRecommendation();

}


async function prepareImageForOCR(
  file
) {

  return new Promise(
    (resolve, reject) => {

      const image =
        new Image();


      const objectURL =
        URL.createObjectURL(
          file
        );


      image.onload =
        () => {

          try {

            const scale =
              3;


            const canvas =
              document.createElement(
                "canvas"
              );


            const context =
              canvas.getContext(
                "2d",
                {
                  willReadFrequently:
                    true
                }
              );


            canvas.width =
              image.naturalWidth *
              scale;


            canvas.height =
              image.naturalHeight *
              scale;


            context.imageSmoothingEnabled =
              true;


            context.imageSmoothingQuality =
              "high";


            context.drawImage(
              image,
              0,
              0,
              canvas.width,
              canvas.height
            );


            const imageData =
              context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
              );


            const pixels =
              imageData.data;


            for (
              let index = 0;
              index < pixels.length;
              index += 4
            ) {

              const gray =
                pixels[index] *
                  0.299 +

                pixels[index + 1] *
                  0.587 +

                pixels[index + 2] *
                  0.114;


              const contrasted =
                Math.max(
                  0,
                  Math.min(
                    255,
                    (
                      gray -
                      128
                    ) *
                      1.6 +
                      128
                  )
                );


              pixels[index] =
                contrasted;


              pixels[index + 1] =
                contrasted;


              pixels[index + 2] =
                contrasted;

            }


            context.putImageData(
              imageData,
              0,
              0
            );


            canvas.toBlob(
              (blob) => {

                URL.revokeObjectURL(
                  objectURL
                );


                if (!blob) {

                  reject(
                    new Error(
                      "Could not prepare size chart image."
                    )
                  );

                  return;

                }


                resolve(blob);

              },

              "image/png"
            );


          } catch (error) {

            URL.revokeObjectURL(
              objectURL
            );


            reject(
              error
            );

          }

        };


      image.onerror =
        () => {

          URL.revokeObjectURL(
            objectURL
          );


          reject(
            new Error(
              "Could not load size chart image."
            )
          );

        };


      image.src =
        objectURL;

    }
  );

}


extractSizeChartBtn
  ?.addEventListener(
    "click",
    async () => {

      if (
        !selectedSizeChartFile
      ) {

        setStatus(
          ocrStatus,
          "Upload a size-chart screenshot first.",
          "error"
        );

        return;

      }


      if (
        !window.Tesseract
      ) {

        setStatus(
          ocrStatus,
          "OCR library could not be loaded. Enter the size values manually instead.",
          "error"
        );


        if (
          extractedSizesWrap
        ) {

          extractedSizesWrap.hidden =
            false;

        }


        if (
          productSizeBody &&
          productSizeBody.children.length === 0
        ) {

          addSizeRow();

        }


        return;

      }


      extractSizeChartBtn.disabled =
        true;


      setStatus(
        ocrStatus,
        "Reading size chart…"
      );


      try {

        const preparedImage =
          await prepareImageForOCR(
            selectedSizeChartFile
          );


        const result =
          await Tesseract.recognize(
            preparedImage,
            "eng",
            {

              logger:
                (message) => {

                  if (
                    message.status ===
                    "recognizing text"
                  ) {

                    setStatus(
                      ocrStatus,
                      `Reading size chart… ${Math.round(
                        message.progress *
                        100
                      )}%`
                    );

                  }

                }

            }
          );


        const text =
          result?.data?.text ||
          "";


        if (ocrPreview) {

          ocrPreview.textContent =
            text;

        }


        if (
          ocrPreviewWrap
        ) {

          ocrPreviewWrap.hidden =
            false;

        }


        // ------------------------------------------------------------
        // CHECK THAT THIS IS A USABLE GARMENT SIZE CHART
        // ------------------------------------------------------------

        const chartValidation =
          validateSizeChartText(
            text
          );


        if (
          !chartValidation.valid
        ) {

          setStatus(
            ocrStatus,
            chartValidation.message,
            "error"
          );


          if (
            productSizeBody
          ) {

            productSizeBody.innerHTML =
              "";

          }


          if (
            extractedSizesWrap
          ) {

            extractedSizesWrap.hidden =
              false;

          }


          addSizeRow();

          return;

        }


        const sizes =
          parseSizeChartOCR(
            text
          );


        if (
          !sizes.length
        ) {

          setStatus(
            ocrStatus,
            "Text was detected, but size/chest/length rows could not be identified confidently. Add the values manually below.",
            "error"
          );


          if (
            extractedSizesWrap
          ) {

            extractedSizesWrap.hidden =
              false;

          }


          if (
            productSizeBody &&
            productSizeBody.children.length === 0
          ) {

            addSizeRow();

          }


          return;

        }


        displayExtractedSizes(
          sizes
        );


        setStatus(
          ocrStatus,
          `${sizes.length} sizes extracted. Review the measurements below before continuing.`,
          "success"
        );


      } catch (error) {

        console.error(
          "OCR error:",
          error
        );


        setStatus(
          ocrStatus,
          "Could not read this chart. Try a clearer screenshot or add the values manually.",
          "error"
        );


        if (
          extractedSizesWrap
        ) {

          extractedSizesWrap.hidden =
            false;

        }


        if (
          productSizeBody &&
          productSizeBody.children.length === 0
        ) {

          addSizeRow();

        }


      } finally {

        extractSizeChartBtn.disabled =
          false;

      }

    }
  );


byId("add-size-row-btn")
  ?.addEventListener(
    "click",
    () => {

      if (
        extractedSizesWrap
      ) {

        extractedSizesWrap.hidden =
          false;

      }


      addSizeRow();

    }
  );


productSizeBody
  ?.addEventListener(
    "click",
    (event) => {

      const button =
        event.target.closest(
          ".remove-size-row"
        );


      if (!button) {

        return;

      }


      button
        .closest("tr")
        ?.remove();


      resetSizeRecommendation();

    }
  );


// ============================================================
// SIZE COMPARISON
// ============================================================

function readProductSizes() {

  const rows =
    document.querySelectorAll(
      ".product-size-row"
    );


  const unit =
    byId("size-chart-unit")
      ?.value ||
    "cm";


  const sizes = [];


  rows.forEach(
    (row) => {

      const size =
        normalizeSizeLabel(
          row
            .querySelector(
              ".size-name"
            )
            ?.value
        );


      const originalChest =
        Number(
          row
            .querySelector(
              ".size-chest"
            )
            ?.value
        );


      const originalLength =
        Number(
          row
            .querySelector(
              ".size-length"
            )
            ?.value
        );


      if (
        !size ||
        !Number.isFinite(
          originalChest
        ) ||
        !Number.isFinite(
          originalLength
        ) ||
        originalChest <= 0 ||
        originalLength <= 0
      ) {

        return;

      }


      const factor =
        unit === "in"
          ? 2.54
          : 1;


      sizes.push({

        size,

        chest:
          originalChest *
          factor,

        length:
          originalLength *
          factor,

        originalChest,

        originalLength,

        originalUnit:
          unit

      });

    }
  );


  return correctAndSortSizes(
    sizes
  )
    .map(
      (item) => {

        const original =
          sizes.find(
            (size) =>
              size.size ===
              item.size
          );


        return {

          ...item,

          originalChest:
            original?.originalChest,

          originalLength:
            original?.originalLength,

          originalUnit:
            original?.originalUnit

        };

      }
    );

}


function compareProductSizes(
  profile,
  productSizes
) {

  const targetChest =
    Number(
      profile.preferred_chest_cm
    );


  const targetLength =
    Number(
      profile.preferred_length_cm
    );


  return productSizes

    .map(
      (item) => {

        const chestDiff =
          item.chest -
          targetChest;


        const lengthDiff =
          item.length -
          targetLength;


        const distance =
          Math.hypot(
            chestDiff,
            lengthDiff
          );


        return {

          ...item,

          chestDiff,

          lengthDiff,

          distance

        };

      }
    )

    .sort(
      (a, b) =>
        a.distance -
        b.distance
    );

}


function dimensionDescription(
  value,
  dimension
) {

  const absolute =
    Math.abs(value);


  if (
    absolute < 0.5
  ) {

    return (
      `${dimension} is almost identical`
    );

  }


  if (
    value > 0
  ) {

    return (
      `${absolute.toFixed(1)} cm ${dimension.toLowerCase()} larger`
    );

  }


  return (
    `${absolute.toFixed(1)} cm ${dimension.toLowerCase()} smaller`
  );

}


function evaluateMatchQuality(
  profile,
  result
) {

  const targetChest =
    Number(
      profile.preferred_chest_cm
    );


  const targetLength =
    Number(
      profile.preferred_length_cm
    );


  const chestErrorPercent =
    (
      Math.abs(
        result.chestDiff
      ) /
      targetChest
    ) * 100;


  const lengthErrorPercent =
    (
      Math.abs(
        result.lengthDiff
      ) /
      targetLength
    ) * 100;


  const weightedError =
    (
      chestErrorPercent * 0.65
    ) +
    (
      lengthErrorPercent * 0.35
    );


  const similarity =
    Math.max(
      0,
      Math.min(
        100,
        100 - weightedError
      )
    );


  if (
    similarity >= 95
  ) {

    return {

      score:
        similarity,

      label:
        "Excellent match",

      cls:
        "excellent",

      description:
        "This size is extremely close to your reference garment."

    };

  }


  if (
    similarity >= 90
  ) {

    return {

      score:
        similarity,

      label:
        "Good match",

      cls:
        "good",

      description:
        "This size is close to your preferred garment dimensions."

    };

  }


  if (
    similarity >= 82
  ) {

    return {

      score:
        similarity,

      label:
        "Moderate match",

      cls:
        "fair",

      description:
        "This is the closest available size, but some dimensional difference may be noticeable."

    };

  }


  return {

    score:
      similarity,

    label:
      "Distant match",

    cls:
      "low",

    description:
      "This is the closest available size, but its dimensions differ considerably from your reference garment."

  };

}


function resetSizeRecommendation() {

  const empty =
    byId(
      "size-result-empty"
    );


  const panel =
    byId(
      "size-result-panel"
    );


  if (empty) {

    empty.hidden =
      false;

  }


  if (panel) {

    panel.hidden =
      true;

  }


  const comparison =
    byId(
      "size-comparison-table"
    );


  if (comparison) {

    comparison.innerHTML =
      "";

  }


  const status =
    byId(
      "find-size-status"
    );


  clearStatus(
    status
  );

}


byId("find-size-btn")
  ?.addEventListener(
    "click",
    async () => {

      const status =
        byId(
          "find-size-status"
        );


      const profile =
        currentFitProfile();


      const productName =
        byId("product-name")
          ?.value
          .trim() || "";


      const productSizes =
        readProductSizes();


      clearStatus(
        status
      );


      if (!profile) {

        setStatus(
          status,
          "Create or select a Fit Profile first.",
          "error"
        );

        return;

      }


      if (
        !productSizes.length
      ) {

        setStatus(
          status,
          "Extract or enter measurements for at least one product size.",
          "error"
        );

        return;

      }


      const compared =
        compareProductSizes(
          profile,
          productSizes
        );


      const best =
        compared[0];


      const matchQuality =
        evaluateMatchQuality(
          profile,
          best
        );


      const similarityElement =
        byId(
          "similarity-score"
        );


      if (
        similarityElement
      ) {

        similarityElement.textContent =
          `${matchQuality.score.toFixed(0)}%`;

      }


      const recommendedSize =
        byId(
          "recommended-size"
        );


      const recommendedProduct =
        byId(
          "recommended-product"
        );


      const qualityElement =
        byId(
          "match-quality"
        );


      const chestDifference =
        byId(
          "recommended-chest-diff"
        );


      const lengthDifference =
        byId(
          "recommended-length-diff"
        );


      const summary =
        byId(
          "recommendation-summary"
        );


      if (
        recommendedSize
      ) {

        recommendedSize.textContent =
          best.size;

      }


      if (
        recommendedProduct
      ) {

        recommendedProduct.textContent =
          productName ||
          "Selected Product";

      }


      if (
        qualityElement
      ) {

        qualityElement.className =
          `match-quality ${matchQuality.cls}`;


        qualityElement.textContent =
          matchQuality.label;

      }


      if (
        chestDifference
      ) {

        chestDifference.textContent =
          `${formatSigned(
            best.chestDiff
          )} cm`;

      }


      if (
        lengthDifference
      ) {

        lengthDifference.textContent =
          `${formatSigned(
            best.lengthDiff
          )} cm`;

      }


      if (summary) {

        const chestDescription =
          dimensionDescription(
            best.chestDiff,
            "Chest"
          );


        const lengthDescription =
          dimensionDescription(
            best.lengthDiff,
            "Length"
          );


        summary.textContent =
          `${best.size} is the closest available size to your ` +
          `${profile.reference_garment_name || "reference garment"}. ` +
          `${chestDescription}; ${lengthDescription}. ` +
          `${matchQuality.description}`;

      }


      const comparisonBody =
        byId(
          "size-comparison-table"
        );


      if (
        comparisonBody
      ) {

        comparisonBody.innerHTML =
          compared
            .map(
              (item, index) => `

                <tr>

                  <td>

                    ${
                      index === 0

                        ? `<strong>${escapeHtml(item.size)} ✓</strong>`

                        : escapeHtml(
                            item.size
                          )
                    }

                  </td>

                  <td>
                    ${formatSigned(
                      item.chestDiff
                    )} cm
                  </td>

                  <td>
                    ${formatSigned(
                      item.lengthDiff
                    )} cm
                  </td>

                  <td>
                    ${item.distance.toFixed(2)} cm
                  </td>

                </tr>

              `
            )
            .join("");

      }


      const empty =
        byId(
          "size-result-empty"
        );


      const panel =
        byId(
          "size-result-panel"
        );


      if (empty) {

        empty.hidden =
          true;

      }


      if (panel) {

        panel.hidden =
          false;

      }


      try {

        await api(
          "/api/size-recommendations",
          {

            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                fit_profile_id:
                  profile.id,

                profile_name:
                  profile.profile_name,

                product_name:
                  productName ||
                  "Unnamed Product",

                recommended_size:
                  best.size,

                match_quality:
                  matchQuality.label,

                similarity_score:
                  Number(
                    matchQuality.score.toFixed(2)
                  ),

                chest_diff_cm:
                  Number(
                    best.chestDiff
                      .toFixed(2)
                  ),

                length_diff_cm:
                  Number(
                    best.lengthDiff
                      .toFixed(2)
                  ),

                comparison_data:
                  compared.map(
                    (item) => ({

                      size:
                        item.size,

                      chestDiff:
                        Number(
                          item.chestDiff
                            .toFixed(2)
                        ),

                      lengthDiff:
                        Number(
                          item.lengthDiff
                            .toFixed(2)
                        ),

                      distance:
                        Number(
                          item.distance
                            .toFixed(2)
                        )

                    })
                  )

              })

          }
        );


        setStatus(
          status,
          "Recommendation calculated and saved to history.",
          "success"
        );


      } catch (error) {

        console.error(
          "Could not save recommendation:",
          error
        );


        setStatus(
          status,
          "Recommendation calculated, but it could not be saved to history.",
          "error"
        );

      }

    }
  );


// ============================================================
// DASHBOARD
// ============================================================

function average(values) {

  const valid =
    values

      .map(Number)

      .filter(
        Number.isFinite
      );


  if (!valid.length) {

    return 0;

  }


  return (
    valid.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    valid.length
  );

}


function recommendationBadgeClass(
  label
) {

  const value =
    String(
      label || ""
    )
      .toLowerCase();


  if (
    value.includes(
      "excellent"
    )
  ) {

    return "excellent";

  }


  if (
    value.includes(
      "good"
    )
  ) {

    return "good";

  }


  if (
    value.includes(
      "fair"
    ) ||
    value.includes(
      "moderate"
    )
  ) {

    return "fair";

  }


  return "low";

}


function renderRecommendations(
  recommendations
) {

  const table =
    byId(
      "recommendations-table"
    );


  if (!table) {

    return;

  }


  if (
    !recommendations.length
  ) {

    table.innerHTML = `
      <tr>
        <td colspan="8">
          No size recommendations saved yet.
        </td>
      </tr>
    `;

    return;

  }


  table.innerHTML =
    recommendations

      .slice(
        0,
        20
      )

      .map(
        (item) => `

          <tr>

            <td>
              ${escapeHtml(
                item.profile_name
              )}
            </td>

            <td>
              ${escapeHtml(
                item.product_name
              )}
            </td>

            <td>
              <strong>
                ${escapeHtml(
                  item.recommended_size
                )}
              </strong>
            </td>

            <td>

              <span
                class="table-badge ${recommendationBadgeClass(
                  item.match_quality
                )}"
              >

                ${escapeHtml(
                  item.match_quality
                )}

              </span>

            </td>

            <td>

  <strong class="dashboard-similarity">

    ${
      Number.isFinite(
        Number(item.similarity_score)
      )

        ? `${Number(
            item.similarity_score
          ).toFixed(0)}%`

        : "—"
    }

  </strong>

</td>

            <td>
              ${formatSigned(
                Number(
                  item.chest_diff_cm
                )
              )} cm
            </td>

            <td>
              ${formatSigned(
                Number(
                  item.length_diff_cm
                )
              )} cm
            </td>

            <td>
              ${formatDate(
                item.created_at
              )}
            </td>

          </tr>

        `
      )

      .join("");

}


async function loadDashboard() {

  try {

    const [
      garments,
      profiles,
      recommendations
    ] =
      await Promise.all([

        api(
          "/api/garment-measurements"
        ),

        api(
          "/api/fit-profiles"
        ),

        api(
          "/api/size-recommendations"
        )

      ]);


    fitProfiles =
      profiles;


    populateFitProfileSelect();

    renderProfileTables();

    renderRecommendations(
      recommendations
    );


    const chestMetric =
      byId(
        "avg-chest-error"
      );


    const lengthMetric =
      byId(
        "avg-length-error"
      );


    const countMetric =
      byId(
        "garments-tested"
      );


    if (chestMetric) {

      chestMetric.textContent =
        garments.length

          ? `${average(
              garments.map(
                (garment) =>
                  garment.chest_error_cm
              )
            ).toFixed(2)} cm`

          : "—";

    }


    if (lengthMetric) {

      lengthMetric.textContent =
        garments.length

          ? `${average(
              garments.map(
                (garment) =>
                  garment.length_error_cm
              )
            ).toFixed(2)} cm`

          : "—";

    }


    if (countMetric) {

      countMetric.textContent =
        garments.length;

    }


    const canvas =
      byId(
        "accuracy-chart"
      );


    if (
      canvas &&
      window.Chart
    ) {

      if (
        accuracyChart
      ) {

        accuracyChart.destroy();

      }


      accuracyChart =
        new Chart(
          canvas,
          {

            type:
              "bar",


            data: {

              labels:
                garments.map(
                  (garment) =>
                    garment.shirt_name
                ),


              datasets: [

                {

                  label:
                    "Actual chest (cm)",

                  data:
                    garments.map(
                      (garment) =>
                        garment.actual_chest_cm
                    ),

                  backgroundColor:
                    "#1f2937",

                  borderRadius:
                    8

                },


                {

                  label:
                    "Estimated chest (cm)",

                  data:
                    garments.map(
                      (garment) =>
                        garment.estimated_chest_cm
                    ),

                  backgroundColor:
                    "#f97316",

                  borderRadius:
                    8

                }

              ]

            },


            options: {

              responsive:
                true,


              plugins: {

                legend: {

                  position:
                    "bottom"

                }

              },


              scales: {

                y: {

                  beginAtZero:
                    true

                }

              }

            }

          }
        );

    }


  } catch (error) {

    console.error(
      "Dashboard error:",
      error
    );


    const table =
      byId(
        "recommendations-table"
      );


    if (table) {

      table.innerHTML = `
        <tr>
          <td colspan="7">
            ${escapeHtml(
              error.message
            )}
          </td>
        </tr>
      `;

    }

  }

}


// ============================================================
// UTILITIES
// ============================================================

function capitalize(value) {

  const text =
    String(
      value || ""
    );


  if (!text) {

    return "—";

  }


  return (
    text
      .charAt(0)
      .toUpperCase() +

    text
      .slice(1)
  );

}


function formatSigned(value) {

  const number =
    Number(value);


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "—";

  }


  const rounded =
    number.toFixed(1);


  return number > 0

    ? `+${rounded}`

    : rounded;

}


function formatDate(value) {

  if (!value) {

    return "—";

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(value);

  }


  return date
    .toLocaleString(
      undefined,
      {

        year:
          "numeric",

        month:
          "short",

        day:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit"

      }
    );

}


function escapeHtml(value) {

  return String(
    value ?? ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


function escapeAttribute(
  value
) {

  return escapeHtml(
    value
  );

}


// ============================================================
// MEASURE ANOTHER OWN GARMENT
// ============================================================

byId("measure-another-garment-btn")
  ?.addEventListener(
    "click",
    () => {

      const form =
        byId("fit-profile-form");


      const profileName =
        byId("profile-name");

      const garmentName =
        byId("reference-garment-name");

      const preference =
        byId("fit-preference");

      const referenceWidth =
        byId("profile-ref-width");


      if (profileName) {
        profileName.value = "";
      }


      if (garmentName) {
        garmentName.value = "";
      }


      if (preference) {
        preference.value = "regular";
      }


      if (referenceWidth) {
        referenceWidth.value = "";
      }


      profileSelectedFile = null;


      if (profileFileInput) {
        profileFileInput.value = "";
      }


      if (profileImageUrl) {

        URL.revokeObjectURL(
          profileImageUrl
        );

        profileImageUrl = null;

      }


      if (profileDropzone) {

        profileDropzone.classList.remove(
          "has-file"
        );


        profileDropzone.innerHTML = `
          <div>
            <strong>
              Upload your well-fitting garment + A4
            </strong>

            <p>
              JPG or PNG
            </p>
          </div>
        `;

      }


      if (profileCalibrationWrap) {

        profileCalibrationWrap.hidden =
          true;

      }


      resetProfileCalibrationPoints();


      clearStatus(
        byId("fit-profile-status")
      );


      form?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });


      setTimeout(() => {

        profileName?.focus();

      }, 400);

    }
  );


// ============================================================
// INITIAL LOAD
// ============================================================

const initial =
  pageFromHash();


showPage(
  initial.name,
  {
    scrollTo:
      initial.scrollTo
  }
);


loadFitProfiles();