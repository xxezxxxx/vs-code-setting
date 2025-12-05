// ===============================================
// 1. EQP & DATA (백엔드 데이터 구조)
// ===============================================
const eqpItemsFromBackend = [
  "EQP-A001: Reactor 1",
  "EQP-B023: Furnace 5",
  "EQP-C2300: Conveyor System",
  "EQP-C100: Conveyor System",
  "EQP-D450: Pump Unit",
  "EQP-F990: Sensor Array",
  "EQP-G111: Mixer Tank 3",
  "EQP-H007: Cooler Tower",
];

const dataItemsFromBackend = [
  {
    name: "Sensor_Unit_A",
    sub_data: ["Temperature", "Pressure", "Flow_Rate"],
  },
  {
    name: "Monitor_Set_B",
    sub_data: [
      "Vibration_X",
      "Vibration_Y",
      "Power_Consumption",
      "Temperature",
    ],
  },
  {
    name: "Controller_C",
    sub_data: ["Voltage_Regulator", "Current_Monitor"],
  },
  {
    name: "Quality_Checker_D",
    sub_data: ["Color_Value", "Opacity", "Density"],
  },
];

// ===============================================
// 2. UI 및 상태 관리 변수 (차트 관련 제거됨)
// ===============================================
// Chart.js 관련 변수 (chartMap, chartContainerDiv) 제거됨

let selectedEqp = null; // 현재 선택된 EQP 항목

/**
 * 차트 관련 기능이 제거되었으므로, 이 함수도 제거합니다.
 * 이전 clearAllCharts 역할의 빈 함수를 두어 혹시 모를 호출에 대비할 수 있습니다.
 */
const noOpDisplayClear = () => {
  // 아무 작업도 하지 않음
  const displayArea = document.querySelector(".right-content .chart-container");
  if (displayArea) {
    displayArea.innerHTML = `
      <p id="chart-message" style="text-align: center; margin-top: 20px; color: var(--color-text-placeholder);">
        EQP와 DATA를 선택하면 여기에 관련 데이터 정보가 표시됩니다.
      </p>
    `;
  }
};

// renderMultipleCharts 함수 제거됨

// ===============================================
// 3. UI 렌더링 및 필터링 함수
// ===============================================

const renderEqpList = (eqpArray) => {
  const eqpContainer = document.getElementById("search-results");
  if (!eqpContainer || !eqpArray) return;
  // 기존 항목 제거 (no-click-item은 제외)
  eqpContainer
    .querySelectorAll(".search-result-item:not(.no-click-item)")
    .forEach((el) => el.remove());

  // 새 항목 추가
  eqpArray.forEach((eqpName) => {
    const item = document.createElement("a");
    item.href = "#";
    item.className = "search-result-item";
    item.textContent = eqpName;
    eqpContainer.appendChild(item);
  });
};

const renderDataList = (dataArray) => {
  const dataContainer = document.getElementById("data-results");
  if (!dataContainer || !dataArray) return;
  dataContainer.innerHTML = ""; // 기존 항목 모두 제거

  // 새 항목 추가
  dataArray.forEach((dataItem) => {
    const item = document.createElement("a");
    item.href = "#";
    item.className = "search-result-item";
    item.textContent = dataItem.name;
    dataContainer.appendChild(item);
  });
};

const filterEqpItems = () => {
  const searchBar = document.getElementById("search-bar");
  const filterText = searchBar.value.toLowerCase();
  const eqpResultsContainer = document.getElementById("search-results");
  const noEqpMessage = document.getElementById("no-eqp-message");
  if (!eqpResultsContainer || !noEqpMessage) return;

  const items = eqpResultsContainer.querySelectorAll(
    ".search-result-item:not(.no-click-item)"
  );
  let visibleItemCount = 0;

  // 필터링 로직
  items.forEach((item) => {
    const itemText = item.textContent.toLowerCase();
    if (itemText.includes(filterText)) {
      item.style.display = "block";
      visibleItemCount++;
    } else {
      item.style.display = "none";
    }
  });

  // 메시지 표시/숨김
  if (visibleItemCount === 0) {
    noEqpMessage.style.display = "block";
  } else {
    noEqpMessage.style.display = "none";
  }
};

const handleItemSelection = (selectedItem) => {
  const clickedValue = selectedItem.textContent.trim();
  const parentContainer = selectedItem.closest(".search-results-container");
  let containerId = null;
  let isMultiSelect = false;
  let resultValues = clickedValue;
  let allStructuredMeasurements = []; // 선택된 데이터의 구조화된 측정값을 저장 (필요시 사용)

  if (parentContainer) {
    containerId = parentContainer.id;

    if (containerId === "search-results") {
      // **EQP 선택 로직**
      // 다른 EQP 항목 선택 해제
      parentContainer
        .querySelectorAll(".search-result-item")
        .forEach((el) => el.classList.remove("selected"));

      // DATA 항목 선택 해제 및 입력창 초기화
      const dataContainer = document.getElementById("data-results");
      if (dataContainer) {
        dataContainer
          .querySelectorAll(".search-result-item")
          .forEach((el) => el.classList.remove("selected"));

        if (dataBar) dataBar.value = "";
      }

      // 현재 EQP 항목 선택
      selectedItem.classList.add("selected");
      selectedEqp = clickedValue;
      noOpDisplayClear(); // 데이터 표시 영역 초기화
    } else if (containerId === "data-results") {
      // **DATA 선택 로직**
      isMultiSelect = true;
      selectedItem.classList.toggle("selected"); // 토글 선택

      // 현재 선택된 모든 DATA 항목 이름 수집
      const selectedDataNames = Array.from(
        parentContainer.querySelectorAll(".search-result-item.selected")
      ).map((el) => el.textContent.trim());

      // 선택된 DATA 항목의 하위 측정값 구조화
      selectedDataNames.forEach((name) => {
        const dataObj = dataItemsFromBackend.find((item) => item.name === name);
        if (dataObj && dataObj.sub_data) {
          dataObj.sub_data.forEach((measurement) => {
            allStructuredMeasurements.push({
              source: name,
              label: measurement,
            });
          });
        }
      });

      resultValues = selectedDataNames;

      // 차트 렌더링 호출 제거 - 데이터 처리 및 표시만 필요한 경우 여기에 로직 추가
      if (selectedEqp && allStructuredMeasurements.length > 0) {
        // 데이터가 선택되었지만, 차트 렌더링은 제거됨.
        // 현재는 콘솔 로그를 통해 선택된 데이터를 확인합니다.
        console.log("선택된 EQP:", selectedEqp);
        console.log(
          "구조화된 측정값 (차트 로직을 위한 준비):",
          allStructuredMeasurements
        );
      } else {
        noOpDisplayClear(); // 데이터 표시 영역 초기화
      }
    }
  }

  return {
    selectedValues: resultValues,
    selectedContainerId: containerId,
    isMultiSelect,
  };
};

// ===============================================
// 4. 실행 코드: DOM 로드 후 이벤트 리스너 설정 (토글 로직 포함)
// ===============================================
document.addEventListener("DOMContentLoaded", () => {
  // dataDisplayContainer 변수명을 차트 용도에 맞게 다시 지정
  const chartContainerDiv = document.querySelector(
    ".right-content .chart-container"
  );

  // 1. EQP 및 DATA 목록을 DOM에 렌더링합니다. (필수 선행 작업)
  renderEqpList(eqpItemsFromBackend);
  renderDataList(dataItemsFromBackend);

  // 2. 검색창 이벤트 리스너 설정
  const searchBar = document.getElementById("search-bar");

  if (searchBar) {
    searchBar.addEventListener("keyup", filterEqpItems);
    filterEqpItems();
  }

  // ⭐⭐⭐ [핵심 수정] 3. EQP/DATA 목록 항목에 이벤트 리스너 연결 (렌더링 후!) ⭐⭐⭐
  // renderEqpList와 renderDataList가 실행된 후에 목록 요소를 쿼리합니다.
  const allClickableItems = document.querySelectorAll(
    "#search-results .search-result-item:not(.no-click-item), #data-results .search-result-item:not(.no-click-item)"
  );

  allClickableItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const selectionResult = handleItemSelection(item);
      console.log("--- 항목 선택됨 ---");
      console.log("결과 객체:", selectionResult);
    });
  });
  // ⭐⭐⭐ [핵심 수정] 끝 ⭐⭐⭐

  noOpDisplayClear();

  // 사이드바 토글 로직 (이전 요청에서 추가됨)
  const toggleButton = document.getElementById("toggle-sidebar");
  const mainWrapper = document.querySelector(".main-wrapper");
  const toggleIcon = toggleButton.querySelector("i");

  if (toggleButton && mainWrapper && toggleIcon) {
    toggleButton.addEventListener("click", () => {
      mainWrapper.classList.toggle("collapsed");

      if (mainWrapper.classList.contains("collapsed")) {
        toggleIcon.classList.remove("fa-angles-left");
        toggleIcon.classList.add("fa-angles-right");
      } else {
        toggleIcon.classList.remove("fa-angles-right");
        toggleIcon.classList.add("fa-angles-left");
      }
    });
  } else {
    console.error(
      "토글을 위한 DOM 요소를 찾을 수 없습니다: #toggle-sidebar, .main-wrapper 중 누락된 요소가 있습니다."
    );
  }
});
