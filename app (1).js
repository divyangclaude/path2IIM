// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxd7ehlRiwuC_fFET1R3TvzB8aP0VajL6cmBB6eCPy3Gvje2wPCpJJwGAcbwrJCLkrFag/exec",
  BACKEND_LIVE: true,
};

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let selectedSlot = null;

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setDateInfo();
  fetchSlotsFromSheet();
  showLiveIndicator();
  setInterval(fetchSlotsFromSheet, 30000);
});

function setDateInfo() {
  const now = new Date();
  const friendly = now.toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const badge = now.toISOString().split("T")[0];
  document.getElementById("friendly-date-text").textContent = friendly;
  document.getElementById("tomorrow-date-badge").textContent = badge;
}

// ─────────────────────────────────────────────
// JSONP HELPER — bypasses CORS with Google
// ─────────────────────────────────────────────
function jsonp(url, callback) {
  const name = "cb_" + Math.random().toString(36).slice(2);
  window[name] = function(data) {
    callback(data);
    delete window[name];
    document.head.removeChild(script);
  };
  const script = document.createElement("script");
  script.src = url + "&callback=" + name;
  script.onerror = function() {
    showError("Could not connect to the booking server. Please try again.");
    delete window[name];
    document.head.removeChild(script);
  };
  document.head.appendChild(script);
}

// ─────────────────────────────────────────────
// FETCH SLOTS
// ─────────────────────────────────────────────
function fetchSlotsFromSheet() {
  jsonp(CONFIG.APPS_SCRIPT_URL + "?action=getSlots", function(data) {
    if (data.closed) {
      document.getElementById("closed-message").textContent =
        data.message || "Bookings are closed.";
      showClosedUI();
    } else {
      renderSlots(data.slots);
      showBookingUI();
    }
  });
}

// ─────────────────────────────────────────────
// RENDER SLOTS
// ─────────────────────────────────────────────
function renderSlots(slots) {
  const wrapper = document.getElementById("slots-wrapper");
  wrapper.innerHTML = "";

  slots.forEach(slot => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot-btn" + (!slot.available ? " slot-full slot-disabled" : "");
    btn.disabled = !slot.available;
    btn.dataset.time = slot.time;

    btn.innerHTML = `
      <span class="slot-time">${slot.time}</span>
      <span class="slot-count">${slot.available ? slot.seats + " seats left" : "Full"}</span>
    `;

    if (slot.available) {
      btn.addEventListener("click", () => selectSlot(slot.time, btn));
    }

    wrapper.appendChild(btn);
  });
}

// ─────────────────────────────────────────────
// SLOT SELECTION
// ─────────────────────────────────────────────
function selectSlot(time, btn) {
  document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("slot-selected"));
  btn.classList.add("slot-selected");
  selectedSlot = time;
  document.getElementById("selected-slot-time").value = time;
  updateSubmitButton();
}

function updateSubmitButton() {
  const name  = document.getElementById("candidate-name").value.trim();
  const email = document.getElementById("candidate-email").value.trim();
  const phone = document.getElementById("candidate-phone").value.trim();
  const iim   = document.getElementById("candidate-iim").value.trim();
  const intro = document.getElementById("candidate-intro").value.trim();
  document.getElementById("submit-btn").disabled =
    !(selectedSlot && name && email && phone && iim && intro);
}

["candidate-name","candidate-email","candidate-phone","candidate-iim","candidate-intro"]
  .forEach(id => {
    document.getElementById(id)?.addEventListener("input", updateSubmitButton);
  });

// ─────────────────────────────────────────────
// FORM SUBMIT
// ─────────────────────────────────────────────
function handleBookingSubmit(e) {
  e.preventDefault();
  hideError();

  const payload = {
    slot_time: document.getElementById("selected-slot-time").value,
    name:      document.getElementById("candidate-name").value.trim(),
    email:     document.getElementById("candidate-email").value.trim(),
    phone:     document.getElementById("candidate-phone").value.trim(),
    iim:       document.getElementById("candidate-iim").value.trim(),
    intro:     document.getElementById("candidate-intro").value.trim(),
    date:      document.getElementById("friendly-date-text").textContent,
  };

  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Booking...";

  const url = CONFIG.APPS_SCRIPT_URL
    + "?action=book"
    + "&data=" + encodeURIComponent(JSON.stringify(payload));

  jsonp(url, function(data) {
    if (data.success) {
      showSuccess(payload);
    } else {
      showError(data.message || "Booking failed. Please try again.");
      btn.disabled = false;
      btn.textContent = "Confirm Booking";
    }
  });
}

// ─────────────────────────────────────────────
// SUCCESS SCREEN
// ─────────────────────────────────────────────
function showSuccess(payload) {
  document.getElementById("booking-container").style.display = "none";
  document.getElementById("success-candidate-name").textContent = payload.name;
  document.getElementById("success-booking-date").textContent   = payload.date;
  document.getElementById("success-booking-time").textContent   = payload.slot_time;
  document.getElementById("success-booking-email").textContent  = payload.email;
  document.getElementById("success-booking-iim").textContent    = payload.iim;
  document.getElementById("success-container").style.display    = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetBookingPortal() {
  document.getElementById("success-container").style.display = "none";
  document.getElementById("booking-form").reset();
  selectedSlot = null;
  document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("slot-selected"));
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Confirm Booking";
  fetchSlotsFromSheet();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────
function showBookingUI() {
  document.getElementById("booking-container").style.display = "grid";
  document.getElementById("closed-container").style.display  = "none";
}

function showClosedUI() {
  document.getElementById("booking-container").style.display = "none";
  document.getElementById("closed-container").style.display  = "block";
}

function showLiveIndicator() {
  document.getElementById("live-indicator").style.display = "flex";
}

function showError(msg) {
  const el = document.getElementById("error-alert");
  document.getElementById("error-message-text").textContent = msg;
  el.style.display = "flex";
}

function hideError() {
  document.getElementById("error-alert").style.display = "none";
}
