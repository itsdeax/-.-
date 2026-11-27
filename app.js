(() => {
  const STORAGE_KEY = "thaisell.listings.v1";

  const screens = {
    camera: document.getElementById("screen-camera"),
    review: document.getElementById("screen-review"),
    listings: document.getElementById("screen-listings"),
  };

  const video = document.getElementById("camera");
  const canvas = document.getElementById("capture-canvas");
  const hint = document.getElementById("camera-hint");
  const flash = document.getElementById("shutter-flash");
  const reviewPhoto = document.getElementById("review-photo");
  const sellForm = document.getElementById("sell-form");
  const listingsEl = document.getElementById("listings");
  const listingsEmpty = document.getElementById("listings-empty");
  const listingCount = document.getElementById("listing-count");
  const fileInput = document.getElementById("file-input");
  const shutterBtn = document.getElementById("btn-shutter");

  let stream = null;
  let facingMode = "environment";
  let pendingPhoto = null;
  let cameraReady = false;

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      const active = key === name;
      el.hidden = !active;
      el.classList.toggle("is-active", active);
    });
  }

  function setHint(text) {
    if (!text) {
      hint.classList.add("is-hidden");
      hint.textContent = "";
      return;
    }
    hint.textContent = text;
    hint.classList.remove("is-hidden");
  }

  function loadListings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveListings(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    listingCount.textContent = String(items.length);
  }

  function formatPrice(value) {
    return Number(value).toLocaleString("th-TH") + " บาท";
  }

  function renderListings() {
    const items = loadListings();
    listingCount.textContent = String(items.length);
    listingsEl.innerHTML = "";

    if (!items.length) {
      listingsEmpty.hidden = false;
      return;
    }

    listingsEmpty.hidden = true;

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "listing";
      li.style.animationDelay = `${index * 40}ms`;

      const img = document.createElement("img");
      img.src = item.photo;
      img.alt = item.title;

      const body = document.createElement("div");
      body.className = "listing-body";
      const title = document.createElement("h2");
      title.textContent = item.title;
      const note = document.createElement("p");
      note.textContent = item.note || "ไม่มีรายละเอียด";
      body.append(title, note);

      const price = document.createElement("div");
      price.className = "listing-price";
      price.textContent = formatPrice(item.price);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "listing-delete";
      del.textContent = "ลบ";
      del.addEventListener("click", () => {
        const next = loadListings().filter((row) => row.id !== item.id);
        saveListings(next);
        renderListings();
      });

      li.append(img, body, price, del);
      listingsEl.appendChild(li);
    });
  }

  async function startCamera() {
    cameraReady = false;
    shutterBtn.disabled = true;
    setHint("กำลังเปิดกล้อง…");

    if (!navigator.mediaDevices?.getUserMedia) {
      setHint("เครื่องนี้เปิดกล้องไม่ได้ — กดแกลเลอรีเพื่อเลือกรูป");
      return;
    }

    stopCamera();

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 1920 },
        },
      });
      video.srcObject = stream;
      video.classList.toggle("mirror", facingMode === "user");
      await video.play();
      cameraReady = true;
      shutterBtn.disabled = false;
      setHint("");
    } catch (err) {
      console.warn(err);
      setHint("ยังเปิดกล้องไม่ได้ — อนุญาตสิทธิ์กล้อง หรือกดแกลเลอรี");
      shutterBtn.disabled = true;
    }
  }

  function stopCamera() {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  }

  function captureFromVideo() {
    if (!cameraReady || !video.videoWidth) {
      setHint("กล้องยังไม่พร้อม");
      return null;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);

    flash.classList.remove("is-on");
    void flash.offsetWidth;
    flash.classList.add("is-on");

    return canvas.toDataURL("image/jpeg", 0.85);
  }

  function openReview(dataUrl) {
    pendingPhoto = dataUrl;
    reviewPhoto.src = dataUrl;
    sellForm.reset();
    stopCamera();
    showScreen("review");
    document.getElementById("item-title").focus();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  document.getElementById("btn-shutter").addEventListener("click", () => {
    const photo = captureFromVideo();
    if (photo) openReview(photo);
  });

  document.getElementById("btn-flip").addEventListener("click", async () => {
    facingMode = facingMode === "environment" ? "user" : "environment";
    await startCamera();
  });

  document.getElementById("btn-pick-file").addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    openReview(dataUrl);
  });

  document.getElementById("btn-retake").addEventListener("click", async () => {
    pendingPhoto = null;
    showScreen("camera");
    await startCamera();
  });

  document.getElementById("btn-open-listings").addEventListener("click", () => {
    stopCamera();
    renderListings();
    showScreen("listings");
  });

  document.getElementById("btn-back-camera").addEventListener("click", async () => {
    showScreen("camera");
    await startCamera();
  });

  document.getElementById("btn-empty-shoot").addEventListener("click", async () => {
    showScreen("camera");
    await startCamera();
  });

  sellForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!pendingPhoto) return;

    const title = document.getElementById("item-title").value.trim();
    const price = Number(document.getElementById("item-price").value);
    const note = document.getElementById("item-note").value.trim();

    if (!title || !price || price < 1) return;

    const items = loadListings();
    items.unshift({
      id: crypto.randomUUID(),
      title,
      price,
      note,
      photo: pendingPhoto,
      createdAt: new Date().toISOString(),
    });
    saveListings(items);
    pendingPhoto = null;
    renderListings();
    showScreen("listings");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopCamera();
    } else if (screens.camera.classList.contains("is-active")) {
      startCamera();
    }
  });

  renderListings();
  startCamera();
})();
