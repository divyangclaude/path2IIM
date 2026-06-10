// ─────────────────────────────────────────────
// CONFIG — Replace with your actual values
// ─────────────────────────────────────────────

const CONFIG = {
  // Your Google Apps Script Web App URL
  // Deploy a Google Apps Script that reads/writes your sheet and paste the URL here
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_SCRIPT_ID_HERE/exec",

  // Set to true once your backend is live
  BACKEND_LIVE: false,
};

// ─────────────────────────────────────────────
// MOCK DATA — Used when BACKEND_LIVE is false
// ─────────────────────────────────────────────
const MOCK_SLOTS = [
  { time: "10:00 AM", available: true,  seats: 8  },
  { time: "10:30 AM", available: false, seats: 0  },
  { time: "11:00 AM", available: true,  seats: 12 },
  { time: "11:30 AM", available: true,  seats: 5  },
  { time: "12:00 PM", available: false, seats: 0  },
  { time: "12:30 PM", available: true,  seats: 15 },
];

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let selectedSlot = null;
let eventSource = null;

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setDateInfo();
  if (CONFIG.BACKEND_LIVE) {
    fetchSlotsFromSheet();
    setupSSE();
  } else {
    renderSlots(MOCK_SLOTS);
    showBookingUI();
    showLiveIndicator();
  }
});

function setDateInfo() {
  const now = new Date();
  const friendly = now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const badge = now.toISOString().split("T")[0];
  document.getElementById("friendly-date-text").textContent = friendly;
  document.getElementById("tomorrow-date-badge").textContent = badge;
}

// ─────────────────────────────────────────────
// FETCH SLOTS FROM GOOGLE SHEET
// ─────────────────────────────────────────────
async function fetchSlotsFromSheet() {
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=getSlots`);
    const data = await res.json();
    if (data.closed) {
      document.getElementById("closed-message").textContent = data.message || "Bookings are closed.";
      showClosedUI();
    } else {
      renderSlots(data.slots);
      showBookingUI();
    }
  } catch (err) {
    console.error("Failed to fetch slots:", err);
    renderSlots(MOCK_SLOTS);
    showBookingUI();
  }
}

// ─────────────────────────────────────────────
// RENDER SLOTS
// ─────────────────────────────────────────────
function renderSlots(slots) {
  const wrapper = document.getElementById("slots-wrapper");
  wrapper.innerHTML = "";

  slots.forEach(slot => {
    const displayTime = formatSlotTime(slot.time);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot-btn" + (!slot.available ? " slot-full slot-disabled" : "");
    btn.disabled = !slot.available;
    btn.dataset.time = displayTime;

    btn.innerHTML = `
      <span class="slot-time">${displayTime}</span>
      <span class="slot-count">${slot.available ? `${slot.seats} seats left` : "Full"}</span>
    `;

    if (slot.available) {
      btn.addEventListener("click", () => selectSlot(displayTime, btn));
    }

    wrapper.appendChild(btn);
  });
}

function formatSlotTime(value) {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();
  const timeOnlyMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (timeOnlyMatch) {
    return formatHoursAndMinutes(Number(timeOnlyMatch[1]), Number(timeOnlyMatch[2]));
  }

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }

  return text;
}

function formatHoursAndMinutes(hours, minutes) {
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
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
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = !(selectedSlot && name && email && phone && iim && intro);
}

["candidate-name","candidate-email","candidate-phone","candidate-iim","candidate-intro"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", updateSubmitButton);
});

// ─────────────────────────────────────────────
// FORM SUBMIT
// ─────────────────────────────────────────────
async function handleBookingSubmit(e) {
  e.preventDefault();
  hideError();

  const payload = {
    action:    "book",
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

  if (!CONFIG.BACKEND_LIVE) {
    // Simulate success in mock mode
    setTimeout(() => showSuccess(payload), 900);
    return;
  }

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      showSuccess(payload);
    } else {
      showError(data.message || "Booking failed. Please try again.");
      btn.disabled = false;
      btn.textContent = "Confirm Booking";
    }
  } catch (err) {
    showError("Network error. Please check your connection and try again.");
    btn.disabled = false;
    btn.textContent = "Confirm Booking";
  }
}

function showSuccess(payload) {
  document.getElementById("booking-container").style.display = "none";
  const s = document.getElementById("success-container");
  document.getElementById("success-candidate-name").textContent = payload.name;
  document.getElementById("success-booking-date").textContent   = payload.date;
  document.getElementById("success-booking-time").textContent   = payload.slot_time;
  document.getElementById("success-booking-email").textContent  = payload.email;
  document.getElementById("success-booking-iim").textContent    = payload.iim;
  s.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetBookingPortal() {
  document.getElementById("success-container").style.display = "none";
  document.getElementById("booking-form").reset();
  selectedSlot = null;
  document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("slot-selected"));
  document.getElementById("submit-btn").disabled = true;
  document.getElementById("submit-btn").textContent = "Confirm Booking";
  if (CONFIG.BACKEND_LIVE) fetchSlotsFromSheet();
  showBookingUI();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─────────────────────────────────────────────
// SSE (Server-Sent Events)
// ─────────────────────────────────────────────
function setupSSE() {
  if (!CONFIG.APPS_SCRIPT_URL.includes("YOUR_SCRIPT_ID")) {
    // SSE not natively supported in Apps Script — poll instead
    setInterval(fetchSlotsFromSheet, 30000);
    showLiveIndicator();
  }
}

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────
function showBookingUI() {
  document.getElementById("booking-container").style.display = "grid";
  document.getElementById("closed-container").style.display = "none";
}

function showClosedUI() {
  document.getElementById("booking-container").style.display = "none";
  document.getElementById("closed-container").style.display = "block";
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
