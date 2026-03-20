const API_URL = "https://archi-flow-api.jojep2.workers.dev";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_CENTER = [37.5665, 126.978];
const KAKAO_MAP_APPKEY =
  window.KAKAO_MAP_APPKEY ||
  window.localStorage.getItem("KAKAO_MAP_APPKEY") ||
  "";
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
const kakaoMapKeyInput = document.getElementById("kakaoMapKeyInput");
const saveKakaoKeyButton = document.getElementById("saveKakaoKeyButton");
const kakaoKeyHelp = document.getElementById("kakaoKeyHelp");

let mapProvider = "leaflet";
let map;
let marker;
let kakaoGeocoder;
let kakaoInfoWindow;

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

function setMapPosition(lat, lng, label) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  if (mapProvider === "kakao" && window.kakao?.maps && map && marker) {
    const position = new window.kakao.maps.LatLng(lat, lng);
    map.setCenter(position);
    map.setLevel(3);
    marker.setPosition(position);
    kakaoInfoWindow.setContent(`<div style="padding:8px 10px; font-size:13px;">${escapeHtml(label)}</div>`);
    kakaoInfoWindow.open(map, marker);
    return;
  }

  if (mapProvider === "leaflet" && map && marker) {
    map.setView([lat, lng], 16);
    marker.setLatLng([lat, lng]);
    marker.bindPopup(label).openPopup();
  }
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
  lookupAiSummary.textContent =
    result?.aiSummary ||
    (mapProvider === "kakao"
      ? "카카오맵 지적편집도 기준 좌표를 표시하고 있습니다. AI 해설은 아직 없습니다."
      : "AI 해설이 아직 없습니다. 기본 지도 좌표를 표시하고 있습니다.");
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

function initKakaoKeyUi() {
  if (!kakaoMapKeyInput || !saveKakaoKeyButton || !kakaoKeyHelp) {
    return;
  }

  if (KAKAO_MAP_APPKEY) {
    kakaoMapKeyInput.value = KAKAO_MAP_APPKEY;
    kakaoKeyHelp.textContent = "카카오맵 키가 저장되어 있습니다. 현재 카카오 지도 사용을 시도합니다.";
  } else {
    kakaoKeyHelp.textContent = "카카오맵 JavaScript 키를 입력하면 주소검색과 지적편집도를 카카오 기준으로 표시합니다.";
  }

  saveKakaoKeyButton.addEventListener("click", () => {
    const key = kakaoMapKeyInput.value.trim();
    if (!key) {
      window.localStorage.removeItem("KAKAO_MAP_APPKEY");
      kakaoKeyHelp.textContent = "저장된 카카오맵 키를 삭제했습니다. 새로고침 후 기본 지도를 사용합니다.";
      return;
    }

    window.localStorage.setItem("KAKAO_MAP_APPKEY", key);
    kakaoKeyHelp.textContent = "카카오맵 키를 저장했습니다. 페이지를 새로고침해 카카오 지도를 적용합니다.";
    window.setTimeout(() => window.location.reload(), 500);
  });
}

function loadKakaoSdk() {
  return new Promise((resolve, reject) => {
    if (!KAKAO_MAP_APPKEY) {
      reject(new Error("카카오맵 JavaScript 키가 설정되지 않았습니다."));
      return;
    }

    if (window.kakao?.maps?.services) {
      resolve(window.kakao);
      return;
    }

    const existing = document.querySelector('script[data-kakao-sdk="true"]');
    if (existing) {
      existing.addEventListener("load", () => {
        window.kakao.maps.load(() => resolve(window.kakao));
      });
      existing.addEventListener("error", () => reject(new Error("카카오맵 SDK를 불러오지 못했습니다.")));
      return;
    }

    const script = document.createElement("script");
    script.dataset.kakaoSdk = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${KAKAO_MAP_APPKEY}&libraries=services`;
    script.onload = () => {
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => reject(new Error("카카오맵 SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

async function initKakaoMap() {
  const kakao = await loadKakaoSdk();
  const container = document.getElementById("lookupMap");
  const center = new kakao.maps.LatLng(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);

  mapProvider = "kakao";
  map = new kakao.maps.Map(container, {
    center,
    level: 4,
  });
  marker = new kakao.maps.Marker({
    position: center,
  });
  marker.setMap(map);
  kakaoInfoWindow = new kakao.maps.InfoWindow({ removable: false });
  kakaoGeocoder = new kakao.maps.services.Geocoder();

  if (kakao.maps.MapTypeId?.USE_DISTRICT) {
    map.addOverlayMapTypeId(kakao.maps.MapTypeId.USE_DISTRICT);
    mapMetaText.textContent = "카카오맵 지적편집도 기준 지도가 준비되었습니다.";
  } else {
    mapMetaText.textContent = "카카오맵이 준비되었습니다.";
  }
}

function initLeafletMap() {
  if (!window.L) {
    mapMetaText.textContent = "지도를 불러오지 못했습니다.";
    return;
  }

  mapProvider = "leaflet";
  map = window.L.map("lookupMap", {
    scrollWheelZoom: false,
  }).setView(DEFAULT_CENTER, 13);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  marker = window.L.marker(DEFAULT_CENTER).addTo(map);
  marker.bindPopup("검색 결과 위치가 여기에 표시됩니다.");
  mapMetaText.textContent = "기본 지도가 준비되었습니다. 카카오맵 키가 있으면 지적편집도로 전환됩니다.";

  setTimeout(() => map.invalidateSize(), 100);
}

async function initMap() {
  try {
    await initKakaoMap();
  } catch {
    initLeafletMap();
  }
}

async function geocodeAddressWithKakao(address) {
  return new Promise((resolve, reject) => {
    if (!kakaoGeocoder || !window.kakao?.maps?.services) {
      reject(new Error("카카오 주소검색을 사용할 수 없습니다."));
      return;
    }

    kakaoGeocoder.addressSearch(address, (result, status) => {
      if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(result) || result.length === 0) {
        reject(new Error("입력한 주소를 카카오맵에서 찾지 못했습니다."));
        return;
      }

      const first = result[0];
      resolve({
        input: {
          original: address,
        },
        parsedAddress: {
          text: first.address_name || first.road_address?.address_name || address,
          roadAddress: first.road_address?.address_name || null,
          parcelAddress: first.address_name || null,
          chosen: {
            x: Number(first.x),
            y: Number(first.y),
            source: "Kakao 주소검색",
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
      });
    });
  });
}

async function geocodeAddressWithFallback(address) {
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
        source: "기본 주소검색",
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

async function geocodeAddress(address) {
  if (mapProvider === "kakao") {
    try {
      return await geocodeAddressWithKakao(address);
    } catch {
      return geocodeAddressWithFallback(address);
    }
  }

  return geocodeAddressWithFallback(address);
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

async function initLookup() {
  setLoading(false);
  await initMap();

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

window.addEventListener("load", async () => {
  initFaq();
  initKakaoKeyUi();
  await initLookup();
});
