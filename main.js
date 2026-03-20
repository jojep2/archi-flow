const DEFAULT_CENTER = {
  lat: 37.5665,
  lng: 126.978,
};

const addressInput = document.getElementById("addressInput");
const lookupButton = document.getElementById("lookupButton");
const lookupError = document.getElementById("lookupError");
const sampleButtons = document.querySelectorAll("[data-sample-address]");

let map;
let geocoder;
let marker;
let infoWindow;

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

function initMap() {
  if (!window.kakao?.maps) {
    showError("카카오 지도를 불러오지 못했습니다.");
    return;
  }

  const container = document.getElementById("map");
  const options = {
    center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
    level: 3,
  };

  map = new kakao.maps.Map(container, options);
  geocoder = new kakao.maps.services.Geocoder();
  marker = new kakao.maps.Marker({
    position: options.center,
  });
  marker.setMap(map);
  infoWindow = new kakao.maps.InfoWindow({
    removable: false,
  });
}

function moveToAddress(address) {
  if (!geocoder) {
    showError("주소검색 기능을 사용할 수 없습니다.");
    return;
  }

  geocoder.addressSearch(address, (result, status) => {
    if (status !== kakao.maps.services.Status.OK || !Array.isArray(result) || result.length === 0) {
      showError("입력한 주소를 찾지 못했습니다.");
      setLoading(false);
      return;
    }

    hideError();

    const first = result[0];
    const position = new kakao.maps.LatLng(Number(first.y), Number(first.x));

    map.setCenter(position);
    marker.setPosition(position);
    infoWindow.setContent(`<div style="padding:8px 10px; font-size:13px;">${first.address_name || address}</div>`);
    infoWindow.open(map, marker);
    setLoading(false);
  });
}

function handleLookup() {
  const address = addressInput.value.trim();

  if (!address) {
    showError("주소 또는 지번을 입력해 주세요.");
    return;
  }

  hideError();
  setLoading(true);
  moveToAddress(address);
}

function initLookup() {
  setLoading(false);

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
      hideError();
      setLoading(false);
      handleLookup();
    });
  });
}

window.addEventListener("load", () => {
  initFaq();
  initMap();
  initLookup();
});
