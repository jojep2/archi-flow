const API_URL = "https://archi-flow-api.jojep2.workers.dev";

const addressInput = document.getElementById("addressInput");
const lookupButton = document.getElementById("lookupButton");
const resultSection = document.getElementById("resultSection");
const errorBox = document.getElementById("errorBox");
const sampleButtons = document.querySelectorAll("[data-sample-address]");

const summaryInput = document.getElementById("summaryInput");
const summaryAddress = document.getElementById("summaryAddress");
const summaryCoordinate = document.getElementById("summaryCoordinate");
const summarySource = document.getElementById("summarySource");
const aiSummaryText = document.getElementById("aiSummaryText");
const rawJsonPre = document.getElementById("rawJsonPre");

const LIST_KEYS = [
  "useAreas",
  "useDistricts",
  "useZones",
  "urbanFacilities",
  "districtPlans",
  "otherRegulations",
];

function setLoading(isLoading) {
  lookupButton.disabled = isLoading || !addressInput.value.trim();
  lookupButton.textContent = isLoading ? "조회 중..." : "조회";
}

function hideError() {
  errorBox.classList.add("hidden");
  errorBox.innerHTML = "";
}

function showError(message) {
  errorBox.classList.remove("hidden");
  errorBox.innerHTML = `<strong>오류</strong><p>${message}</p>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderList(key, items) {
  const listEl = document.getElementById(`${key}List`);
  const emptyEl = document.getElementById(`${key}Empty`);
  const countEl = document.getElementById(`${key}Count`);
  const normalizedItems = Array.isArray(items) ? items : [];

  countEl.textContent = `${normalizedItems.length}건`;

  if (normalizedItems.length === 0) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  listEl.innerHTML = normalizedItems
    .map((item) => {
      const name = escapeHtml(item?.name || "이름없음");
      const notice = escapeHtml(item?.notice || "세부 고시정보 없음");
      return `<li><strong>${name}</strong><span>${notice}</span></li>`;
    })
    .join("");
}

function renderResult(result) {
  resultSection.classList.remove("hidden");

  summaryInput.textContent = result.input || "입력값 없음";
  summaryAddress.textContent = result.input || "-";

  const x = result.parsedAddress?.chosen?.x ?? "-";
  const y = result.parsedAddress?.chosen?.y ?? "-";
  summaryCoordinate.textContent = `${x}, ${y}`;
  summarySource.textContent = result.parsedAddress?.chosen?.source || "-";
  aiSummaryText.textContent = result.aiSummary || "AI 해설이 없습니다.";
  rawJsonPre.textContent = JSON.stringify(result, null, 2);

  LIST_KEYS.forEach((key) => {
    renderList(key, result.landUse?.[key]);
  });
}

async function handleLookup() {
  const address = addressInput.value.trim();

  if (!address) {
    showError("주소 또는 지번을 입력해 주세요.");
    resultSection.classList.add("hidden");
    return;
  }

  hideError();
  setLoading(true);
  resultSection.classList.add("hidden");

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
      throw new Error(data.error || "조회 중 오류가 발생했습니다.");
    }

    renderResult(data);
  } catch (error) {
    showError(error instanceof Error ? error.message : "조회 실패");
  } finally {
    setLoading(false);
  }
}

addressInput.addEventListener("input", () => {
  setLoading(false);
});

addressInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleLookup();
  }
});

lookupButton.addEventListener("click", handleLookup);

sampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const sampleAddress = button.getAttribute("data-sample-address") || "";
    addressInput.value = sampleAddress;
    setLoading(false);
    addressInput.focus();
  });
});

setLoading(false);
