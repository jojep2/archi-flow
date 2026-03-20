const API_URL = "https://archi-flow-api.jojep2.workers.dev";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_CENTER = [37.5665, 126.978];
const LIST_CONFIG = [
  { key: "useAreas", fallbackKey: "usageRegion" },
  { key: "useDistricts", fallbackKey: "usageDistrict" },
  { key: "useZones", fallbackKey: "usageArea" },
  { key: "urbanFacilities", fallbackKey: "urbanPlanningFacilities" },
  { key: "districtPlans", fallbackKey: "districtPlans" },
  { key: "otherRegulations", fallbackKey: "otherRegulations" },
];

const addressInput = document.getElementById("addressInput");
const lookupButton = document.getElementById("lookupButton");
const lookupError = document.getElementById("lookupError");
const resultSection = document.getElementById("lookup-results");
const sampleButtons = document.querySelectorAll("[data-sample-address]");
const mapAddressLabel = document.getElementById("mapAddressLabel");
const mapMetaText = document.getElementById("mapMetaText");
const countUseArea = document.getElementById("countUseArea");
const countUseDistrict = document.getElementById("countUseDistrict");
const countUseZone = document.getElementById("countUseZone");
const summaryInputAddress = document.getElementById("summaryInputAddress");
const summaryCoordinates = document.getElementById("summaryCoordinates");
const summarySource = document.getElementById("summarySource");
const lookupAiSummary = document.getElementById("lookupAiSummary");
const lookupRawJson = document.getElementById("lookupRawJson");

let map;
let marker;

function initFaq() {
  const faqButtons = document.querySelectorAll(".faq-question");
  faqButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const answer = button.nextElementSibling;
      const icon = button.querySelector("span");
      const isOpen = answer.style.maxHeight && answer.style.maxHeight !== "0px";

      document.querySelectorAll(".faq-answer").forEach((item) => {
        item.style.maxHeight = null;
      });

      document.querySelectorAll(".faq-question span").forEach((item) => {
        item.textContent = "＋";
      });

      if (!isOpen) {
        answer.style.maxHeight = `${answer.scrollHeight}px`;
        icon.textContent = "－";
      }
    });
  });
}

function initMap() {
  if (!window.L) {
    mapMetaText.textContent = "지도를 불러오지 못했습니다.";
    return;
  }

  map = window.L.map("lookupMap", {
    scrollWheelZoom: false,
  }).setView(DEFAULT_CENTER, 13);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  marker = window.L.marker(DEFAULT_CENTER).addTo(map);
  marker.bindPopup("검색 결과 위치가 여기에 표시됩니다.");

  setTimeout(() => map.invalidateSize(), 100);
}

function setLoading(isLoading) {
  lookupButton.disabled = isLoading || !addressInput.value.trim();
  lookupButton.textContent = isLoading ? "조회 중" : "조회";
}

function showError(message) {
  lookupError.hidden = false;
  lookupError.textContent = message;
}

function hideError() {
  lookupError.hidden = true;
  lookupError.textContent = "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeItems(result, key, fallbackKey) {
  const source = result?.landUse?.[key] ?? result?.landUse?.[fallbackKey] ?? [];
  if (!Array.isArray(source)) {
    return [];
  }

  return source.map((item) => {
    if (typeof item === "string") {
      return { name: item, notice: "" };
    }

    return {
      name: item?.name || item?.title || item?.label || item?.alias || item?.uname || "이름없음",
      notice:
        item?.notice ||
        item?.description ||
        item?.remark ||
        item?.announcedAt ||
        item?.ntfdate ||
        "",
    };
  });
}

function setMapPosition(lat, lng, label) {
  if (!map || !marker || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  map.setView([lat, lng], 16);
  marker.setLatLng([lat, lng]);
  marker.bindPopup(label).openPopup();
}

function resolveCoordinate(result) {
  const candidates = [
    result?.parsedAddress?.chosen,
    result?.parsedAddress?.point,
    result?.landUse?.coordinate,
  ];

  for (const item of candidates) {
    const x = Number(item?.x);
    const y = Number(item?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y, source: item?.source || result?.parsedAddress?.type || "검색 결과" };
    }
  }

  return null;
}

function renderList(config, result) {
  const items = normalizeItems(result, config.key, config.fallbackKey);
  const listEl = document.getElementById(`${config.key}List`);
  const emptyEl = document.getElementById(`${config.key}Empty`);
  const countEl = document.getElementById(`${config.key}Count`);

  countEl.textContent = `${items.length}건`;

  if (items.length === 0) {
    listEl.innerHTML = "";
    emptyEl.style.display = "block";
    return items;
  }

  emptyEl.style.display = "none";
  listEl.innerHTML = items
    .map((item) => {
      const name = escapeHtml(item.name);
      const notice = escapeHtml(item.notice || "세부 설명 없음");
      return `<li><strong>${name}</strong><span>${notice}</span></li>`;
    })
    .join("");

  return items;
}

function renderResult(result) {
  resultSection.hidden = false;

  const coords = resolveCoordinate(result);
  const displayAddress =
    result?.input?.original ||
    result?.input ||
    result?.parsedAddress?.text ||
    "조회 주소 없음";

  mapAddressLabel.textContent = displayAddress;
  mapMetaText.textContent = coords
    ? `좌표 ${coords.x.toFixed(6)}, ${coords.y.toFixed(6)} / ${coords.source}`
    : "좌표 정보를 찾지 못했습니다.";

  summaryInputAddress.textContent = displayAddress;
  summaryCoordinates.textContent = coords ? `${coords.x.toFixed(6)}, ${coords.y.toFixed(6)}` : "-";
  summarySource.textContent = coords?.source || "-";
  lookupAiSummary.textContent = result?.aiSummary || "AI 해설이 아직 없습니다. 지도 위치는 실제 주소검색 결과를 기준으로 표시됩니다.";
  lookupRawJson.textContent = JSON.stringify(result, null, 2);

  const useAreas = renderList(LIST_CONFIG[0], result);
  const useDistricts = renderList(LIST_CONFIG[1], result);
  const useZones = renderList(LIST_CONFIG[2], result);
  renderList(LIST_CONFIG[3], result);
  renderList(LIST_CONFIG[4], result);
  renderList(LIST_CONFIG[5], result);

  countUseArea.textContent = `용도지역 ${useAreas.length}건`;
  countUseDistrict.textContent = `용도지구 ${useDistricts.length}건`;
  countUseZone.textContent = `용도구역 ${useZones.length}건`;

  if (coords) {
    setMapPosition(coords.y, coords.x, displayAddress);
  }
}

function requestJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `lookupJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("주소 좌표 검색이 지연되고 있습니다."));
    }, 10000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.src = `${url}&json_callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("주소 좌표 검색에 실패했습니다."));
    };

    document.body.appendChild(script);
  });
}

async function geocodeAddress(address) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "kr");
  url.searchParams.set("accept-language", "ko");

  const data = await requestJsonp(url.toString());
  const first = Array.isArray(data) ? data[0] : null;

  if (!first) {
    throw new Error("입력한 주소를 지도에서 찾지 못했습니다.");
  }

  return {
    input: {
      original: address,
    },
    parsedAddress: {
      text: first.display_name || address,
      chosen: {
        x: Number(first.lon),
        y: Number(first.lat),
        source: "Nominatim 주소검색",
      },
      rawGeocoder: first,
    },
    landUse: {
      useAreas: [],
      useDistricts: [],
      useZones: [],
      urbanFacilities: [],
      districtPlans: [],
      otherRegulations: [],
    },
    aiSummary: null,
    success: true,
  };
}

async function fetchLookupApi(address) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return null;
    }

    const hasUsefulPayload =
      data.parsedAddress || data.landUse || data.aiSummary || data.input?.original || data.input;

    return hasUsefulPayload ? data : null;
  } catch {
    return null;
  }
}

function mergeLookupResult(geocoded, apiData) {
  if (!apiData) {
    return geocoded;
  }

  return {
    ...geocoded,
    ...apiData,
    input: apiData.input || geocoded.input,
    parsedAddress: {
      ...geocoded.parsedAddress,
      ...(apiData.parsedAddress || {}),
      chosen: apiData.parsedAddress?.chosen || geocoded.parsedAddress.chosen,
    },
    landUse: {
      ...(geocoded.landUse || {}),
      ...(apiData.landUse || {}),
    },
    aiSummary: apiData.aiSummary || geocoded.aiSummary,
    raw: {
      geocoder: geocoded.parsedAddress?.rawGeocoder,
      api: apiData,
    },
  };
}

async function handleLookup() {
  const address = addressInput.value.trim();

  if (!address) {
    showError("주소 또는 지번을 입력해 주세요.");
    resultSection.hidden = true;
    return;
  }

  hideError();
  setLoading(true);

  try {
    const geocoded = await geocodeAddress(address);
    const apiData = await fetchLookupApi(address);
    const mergedResult = mergeLookupResult(geocoded, apiData);

    renderResult(mergedResult);
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showError(error instanceof Error ? error.message : "조회 실패");
    resultSection.hidden = true;
  } finally {
    setLoading(false);
  }
}

function initLookup() {
  setLoading(false);
  initMap();

  addressInput.addEventListener("input", () => setLoading(false));
  addressInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLookup();
    }
  });
  lookupButton.addEventListener("click", handleLookup);
  sampleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      addressInput.value = button.getAttribute("data-sample-address") || "";
      setLoading(false);
      addressInput.focus();
    });
  });
}

window.addEventListener("load", () => {
  initFaq();
  initLookup();
});
