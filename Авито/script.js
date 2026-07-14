const salePriceInput = document.querySelector("#salePrice");
const marginPercentInput = document.querySelector("#marginPercent");
const purchasePriceInput = document.querySelector("#purchasePrice");
const marginAmountInput = document.querySelector("#marginAmount");
const totalCostLabel = document.querySelector("#totalCost");
const prepCostInput = document.querySelector("#prepCost");
const widgetPurchasePrice = document.querySelector("#widgetPurchasePrice");
const widgetMarginAmount = document.querySelector("#widgetMarginAmount");
const widgetSalePrice = document.querySelector("#widgetSalePrice");
const approvalWidget = document.querySelector("#approvalWidget");
const approvalWidgetHeader = document.querySelector("#approvalWidgetHeader");
const approvalWidgetHeaderTitle = document.querySelector("#approvalWidgetHeaderTitle");
const sendForApprovalButton = document.querySelector("#sendForApprovalButton");
const secondaryWidgetButton = document.querySelector("#secondaryWidgetButton");
const tabs = document.querySelectorAll(".tabs__item");
const estimatePanel = document.querySelector("#estimatePanel");
const marketPanel = document.querySelector("#marketPanel");
const marketChartToggle = document.querySelector("#marketChartToggle");
const marketList = document.querySelector(".market-list");
const marketChart = document.querySelector("#marketChart");
const marketChartTooltip = document.querySelector("#marketChartTooltip");
const marketChartPoints = document.querySelectorAll(".market-chart__point");
const marketSelectedImage = document.querySelector("#marketSelectedImage");
const marketSelectedDate = document.querySelector("#marketSelectedDate");
const marketSelectedPrice = document.querySelector("#marketSelectedPrice");
const marketSelectedDays = document.querySelector("#marketSelectedDays");
const marketSelectedSites = document.querySelector("#marketSelectedSites");
const marketSelectedRating = document.querySelector("#marketSelectedRating");
const marketSelectedYear = document.querySelector("#marketSelectedYear");
const marketSelectedSpec = document.querySelector("#marketSelectedSpec");
const marketSelectedOwners = document.querySelector("#marketSelectedOwners");
const marketSelectedSeller = document.querySelector("#marketSelectedSeller");
const marketSelectedCity = document.querySelector("#marketSelectedCity");
const roleLanding = document.querySelector("#roleLanding");
const prototypeApp = document.querySelector("#prototypeApp");

const chartListings = [
  { price: "1 300 000 ₽", mileage: "127 000 км", days: "12 дней", image: "./assets/polo-1.jpg", date: "3 апреля 2026", sites: "Авито", rating: "Рейтинг 1 из 12", year: "2020, 127 000 км", spec: "1.6 AT, передний, Base", owners: "2 владельца", seller: "Частник", city: "Москва", trend: "↑" },
  { price: "1 579 000 ₽", mileage: "168 000 км", days: "41 день", image: "./assets/polo-2.jpg", date: "6 февраля 2026", sites: "Авито · Авто.ру", rating: "Рейтинг 2 из 12", year: "2021, 168 000 км", spec: "1.6 AT, передний, LE Base", owners: "1 владелец", seller: "Салон", city: "Москва", trend: "↓" },
  { price: "1 700 000 ₽", mileage: "110 000 км", days: "79 дней", image: "./assets/polo-3.jpg", date: "25 декабря 2025", sites: "Авито · Дром", rating: "Рейтинг 2 из 12", year: "2020, 110 000 км", spec: "1.6 AT, передний", owners: "5 владельцев", seller: "Салон", city: "Москва", trend: "↓" },
  { price: "1 220 000 ₽", mileage: "124 000 км", days: "35 дней", image: "./assets/polo-4.jpg", date: "28 января 2026", sites: "Авито", rating: "Рейтинг 2 из 12", year: "2022, 124 000 км", spec: "1.6 AT, передний", owners: "3 владельца", seller: "Частник", city: "Москва", trend: "↓" },
  { price: "1 599 000 ₽", mileage: "297 996 км", days: "17 дней", image: "./assets/polo-5.jpg", date: "11 апреля 2026", sites: "Авито", rating: "Рейтинг 2 из 12", year: "2021, 297 996 км", spec: "1.6 AT, передний", owners: "4 владельца", seller: "Частник", city: "Москва", trend: "↓" },
  { price: "1 620 000 ₽", mileage: "25 345 км", days: "125 дней", image: "./assets/polo-6.jpg", date: "23 февраля 2026", sites: "Авито · Авто.ру · Дром", rating: "Рейтинг 2 из 12", year: "2020, 25 345 км", spec: "1.4 AMT (125 л.с.)", owners: "2 владельца", seller: "Частник", city: "Москва", trend: "↑" },
];

function parseNumber(value) {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function formatPercent(value) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function syncWidget(salePrice, purchasePrice, marginAmount) {
  widgetPurchasePrice.textContent = `${formatMoney(purchasePrice)} ₽`;
  widgetMarginAmount.textContent = `${formatMoney(marginAmount)} ₽`;
  widgetSalePrice.textContent = `${formatMoney(salePrice)} ₽`;
}

function recalculateFromSale() {
  const salePrice = parseNumber(salePriceInput.value);
  const marginPercent = parseNumber(marginPercentInput.value);
  const prepCost = parseNumber(prepCostInput.value);
  const marginAmount = salePrice * (marginPercent / 100);
  const purchasePrice = salePrice - marginAmount;
  const totalCost = purchasePrice + prepCost;

  purchasePriceInput.value = formatMoney(purchasePrice);
  marginAmountInput.value = formatMoney(marginAmount);
  totalCostLabel.textContent = `${formatMoney(totalCost)} ₽`;
  syncWidget(salePrice, purchasePrice, marginAmount);
}

function recalculateFromMargin() {
  const salePrice = parseNumber(salePriceInput.value);
  const marginAmount = parseNumber(marginAmountInput.value);
  const prepCost = parseNumber(prepCostInput.value);
  const purchasePrice = Math.max(0, salePrice - marginAmount);
  const marginPercent = salePrice ? (marginAmount / salePrice) * 100 : 0;
  const totalCost = purchasePrice + prepCost;

  purchasePriceInput.value = formatMoney(purchasePrice);
  marginPercentInput.value = formatPercent(marginPercent);
  totalCostLabel.textContent = `${formatMoney(totalCost)} ₽`;
  syncWidget(salePrice, purchasePrice, marginAmount);
}

function recalculateFromPurchase() {
  const salePrice = parseNumber(salePriceInput.value);
  const purchasePrice = parseNumber(purchasePriceInput.value);
  const prepCost = parseNumber(prepCostInput.value);
  const marginAmount = Math.max(0, salePrice - purchasePrice);
  const marginPercent = salePrice ? (marginAmount / salePrice) * 100 : 0;
  const totalCost = purchasePrice + prepCost;

  marginAmountInput.value = formatMoney(marginAmount);
  marginPercentInput.value = formatPercent(marginPercent);
  totalCostLabel.textContent = `${formatMoney(totalCost)} ₽`;
  syncWidget(salePrice, purchasePrice, marginAmount);
}

function normalizeMoneyInput(event) {
  const digits = event.target.value.replace(/[^\d]/g, "");
  event.target.value = digits ? formatMoney(Number(digits)) : "";
}

function normalizePercentInput(event) {
  const cleaned = event.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
  const [integerPart, fractionPart = ""] = cleaned.split(".");
  const safeValue = fractionPart ? `${integerPart}.${fractionPart.slice(0, 2)}` : integerPart;
  event.target.value = safeValue;
}

salePriceInput.addEventListener("input", (event) => {
  normalizeMoneyInput(event);
  recalculateFromSale();
});

marginAmountInput.addEventListener("input", (event) => {
  normalizeMoneyInput(event);
  recalculateFromMargin();
});

marginPercentInput.addEventListener("input", (event) => {
  normalizePercentInput(event);
  recalculateFromSale();
});

purchasePriceInput.addEventListener("input", (event) => {
  normalizeMoneyInput(event);
  recalculateFromPurchase();
});

prepCostInput.addEventListener("input", (event) => {
  normalizeMoneyInput(event);
  recalculateFromSale();
});

function setManagerApprovalPending() {
  approvalWidget.dataset.role = "manager";
  approvalWidget.classList.add("history-card--pending");
  approvalWidget.classList.remove("history-card--approved");
  approvalWidgetHeader.hidden = false;
  approvalWidgetHeaderTitle.textContent = "Ожидает согласования";
  sendForApprovalButton.textContent = "Согласовать оценку";
  secondaryWidgetButton.textContent = "Отправить на доработку";
}

function setBuyerApprovalState() {
  approvalWidget.dataset.role = "buyer";
  approvalWidget.classList.remove("history-card--pending", "history-card--approved");
  approvalWidgetHeader.hidden = true;
  approvalWidgetHeaderTitle.textContent = "Ожидает согласования";
  sendForApprovalButton.textContent = "Отправить на согласование";
  secondaryWidgetButton.textContent = "Сохранить без согласования";
}

function setManagerApprovalComplete() {
  approvalWidget.classList.add("history-card--pending", "history-card--approved");
  approvalWidgetHeader.hidden = false;
  approvalWidgetHeaderTitle.textContent = "Оценка согласована";
  sendForApprovalButton.textContent = "Изменить";
  secondaryWidgetButton.textContent = "Отправить на доработку";
}

sendForApprovalButton.addEventListener("click", () => {
  if (approvalWidget.dataset.role === "manager") {
    setManagerApprovalComplete();
    return;
  }

  approvalWidget.classList.add("history-card--pending");
  approvalWidgetHeader.hidden = false;
});

function showPrototypeForRole(role) {
  const isManager = role === "manager";

  roleLanding.hidden = true;
  prototypeApp.hidden = false;
  prototypeApp.classList.add("prototype-app--visible");
  if (isManager) {
    setManagerApprovalPending();
  } else {
    setBuyerApprovalState();
  }

  if (isManager) {
    tabs.forEach((item) => item.classList.toggle("tabs__item--active", item.dataset.tab === "estimate"));
    estimatePanel.hidden = false;
    marketPanel.hidden = true;
  }
}

window.showPrototypeForRole = showPrototypeForRole;

roleLanding.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const choice = event.target.closest("[data-role]");
  if (choice) {
    showPrototypeForRole(choice.dataset.role);
  }
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.tab !== "market" && tab.dataset.tab !== "estimate") {
      return;
    }

    const isMarketTab = tab.dataset.tab === "market";

    tabs.forEach((item) => {
      item.classList.toggle("tabs__item--active", item === tab);
    });

    estimatePanel.hidden = isMarketTab;
    marketPanel.hidden = !isMarketTab;
  });
});

marketChartToggle.addEventListener("click", () => {
  const showChart = marketChart.hidden;
  marketChart.hidden = !showChart;
  marketList.hidden = showChart;
  marketChartToggle.classList.toggle("is-active", showChart);
  marketChartToggle.setAttribute("aria-pressed", String(showChart));
  marketChartToggle.innerHTML = showChart ? "▥&nbsp; Список" : "▥&nbsp; График";
});

function hideChartTooltip() {
  marketChartTooltip.classList.remove("is-visible", "market-chart__tooltip--below");
  marketChartTooltip.setAttribute("aria-hidden", "true");
}

function showChartTooltip(point, listing) {
  const x = point.style.getPropertyValue("--x").trim();
  const y = point.style.getPropertyValue("--y").trim();
  const isNearTop = Number.parseFloat(y) < 24;

  marketChartTooltip.querySelector("strong").textContent = listing.price;
  marketChartTooltip.querySelector("span").textContent = `${listing.mileage}, ${listing.days}`;
  marketChartTooltip.style.setProperty("--tooltip-x", x);
  marketChartTooltip.style.setProperty("--tooltip-y", y);
  marketChartTooltip.classList.toggle("market-chart__tooltip--below", isNearTop);
  marketChartTooltip.classList.add("is-visible");
  marketChartTooltip.setAttribute("aria-hidden", "false");
}

function selectChartListing(point, listing) {
  marketChartPoints.forEach((item) => item.classList.toggle("is-selected", item === point));
  marketSelectedImage.src = listing.image;
  marketSelectedImage.alt = `Polo VI, ${listing.year.slice(0, 4)}`;
  marketSelectedDate.textContent = listing.date;
  marketSelectedPrice.innerHTML = `${listing.price} <em class="${listing.trend === "↓" ? "market-row__down" : ""}">${listing.trend}</em>`;
  marketSelectedDays.textContent = listing.days;
  marketSelectedSites.textContent = listing.sites;
  marketSelectedRating.textContent = listing.rating;
  marketSelectedYear.textContent = listing.year;
  marketSelectedSpec.textContent = listing.spec;
  marketSelectedOwners.textContent = listing.owners;
  marketSelectedSeller.textContent = listing.seller;
  marketSelectedCity.textContent = listing.city;
}

marketChartPoints.forEach((point, index) => {
  const listing = chartListings[index];
  point.setAttribute("aria-label", `${listing.price}, ${listing.mileage}, ${listing.days}`);
  point.addEventListener("mouseenter", () => showChartTooltip(point, listing));
  point.addEventListener("mouseleave", hideChartTooltip);
  point.addEventListener("focus", () => showChartTooltip(point, listing));
  point.addEventListener("blur", hideChartTooltip);
  point.addEventListener("click", () => selectChartListing(point, listing));
});

selectChartListing(marketChartPoints[0], chartListings[0]);

recalculateFromSale();
