const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyax36uGU2VwGRtgY-Cyv9yGivd7uvRWXfqFwBOR9s7ZIH_AIE04htWN6baYyTKSL7Z8A/exec";

let selectedSlot = null;

document.addEventListener("DOMContentLoaded", () => {
  setDateInfo();
  loadSlots();
  document.getElementById("live-indicator").style.display = "flex";
  setInterval(loadSlots, 30000);
});

function setDateInfo() {
  const now = new Date();
  const friendly = now.toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  document.getElementById("friendly-date-text").textContent = friendly;
  document.getElementById("tomorrow-date-badge").textContent = now.toISOString().split("T")[0];
}

function loadSlots() {
  const cbName = "cb_" + Math.random().toString(36).slice(2);
  const script = document.createElement("script");

  window[cbName] = function(data) {
    delete window[cbName];
    script.remove();

    if (!data || !data.slots) {
      document.getElementById("booking-container").style.display = "grid";
      document.getElementById("closed-container").style.display = "none";
      document.getElementById("slots-wrapper").innerHTML = "<p style='color:red'>No slots found. Check your sheet.</p>";
      return;
    }

    if (data.closed) {
      document.getElementById("booking-container").style.display = "none";
      document.getElementById("closed-container").style.display = "block";
      return;
    }

    renderSlots(data.slots);
    document.getElementById("booking-container").style.display = "grid";
    document.getElementById("closed-container").style.display = "none";
  };

  script.onerror = function() {
    delete window[cbName];
    script.remove();
    document.getElementById("booking-container").style.display = "grid";
    document.getElementById("slots-wrapper").innerHTML = "<p style='color:red'>Failed to load slots. Please refresh.</p>";
  };

  script.src = SCRIPT_URL + "?action=getSlots&callback=" + cbName;
  document.head.appendChild(script);
}

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

function selectSlot(time, btn) {
  document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("slot-selected"));
  btn.classList.add("slot-selected");
  selectedSlot = time;
  document.getElementById("selected-slot-time").value = time;
  updateSubmitButton();
}

function updateSubmitButton() {
  const filled =
    selectedSlot &&
    document.getElementById("candidate-name").value.trim() &&
    document.getElementById("candidate-email").value.trim() &&
    document.getElementById("candidate-phone").value.trim() &&
    document.getElementById("candidate-iim").value.trim() &&
    document.getElementById("candidate-intro").value.trim();
  document.getElementById("submit-btn").disabled = !filled;
}

["candidate-name","candidate-email","candidate-phone","candidate-iim","candidate-intro"]
  .forEach(id => document.getElementById(id)?.addEventListener("input", updateSubmitButton));

function handleBookingSubmit(e) {
  e.preventDefault();
  document.getElementById("error-alert").style.display = "none";

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

  const cbName = "cb_" + Math.random().toString(36).slice(2);
  const script = document.createElement("script");

  window[cbName] = function(data) {
    delete window[cbName];
    script.remove();
    if (data.success) {
      showSuccess(payload);
    } else {
      document.getElementById("error-message-text").textContent = data.message || "Booking failed.";
      document.getElementById("error-alert").style.display = "flex";
      btn.disabled = false;
      btn.textContent = "Confirm Booking";
    }
  };

  script.onerror = function() {
    delete window[cbName];
    script.remove();
    document.getElementById("error-message-text").textContent = "Network error. Please try again.";
    document.getElementById("error-alert").style.display = "flex";
    btn.disabled = false;
    btn.textContent = "Confirm Booking";
  };

  script.src = SCRIPT_URL + "?action=book&data=" + encodeURIComponent(JSON.stringify(payload)) + "&callback=" + cbName;
  document.head.appendChild(script);
}

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
  document.getElementById("submit-btn").disabled = true;
  document.getElementById("submit-btn").textContent = "Confirm Booking";
  loadSlots();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
