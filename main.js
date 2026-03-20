const KAKAO_SEARCH_BASE = "https://map.kakao.com/link/search/";

const addressInput = document.getElementById("addressInput");
const lookupButton = document.getElementById("lookupButton");
const lookupError = document.getElementById("lookupError");
const sampleButtons = document.querySelectorAll("[data-sample-address]");

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
  lookupButton.textContent = isLoading ? "이동 중" : "조회";
}

function showError(message) {
  lookupError.hidden = false;
  lookupError.textContent = message;
}

function hideError() {
  lookupError.hidden = true;
  lookupError.textContent = "";
}

function openKakaoSearch() {
  const address = addressInput.value.trim();

  if (!address) {
    showError("주소 또는 지번을 입력해 주세요.");
    return;
  }

  hideError();
  setLoading(true);

  const url = `${KAKAO_SEARCH_BASE}${encodeURIComponent(address)}`;
  window.open(url, "_blank", "noopener,noreferrer");

  window.setTimeout(() => {
    setLoading(false);
  }, 300);
}

function initLookup() {
  setLoading(false);

  addressInput.addEventListener("input", () => setLoading(false));
  addressInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openKakaoSearch();
    }
  });

  lookupButton.addEventListener("click", openKakaoSearch);

  sampleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      addressInput.value = button.getAttribute("data-sample-address") || "";
      hideError();
      setLoading(false);
      addressInput.focus();
    });
  });
}

window.addEventListener("load", () => {
  initFaq();
  initLookup();
});
