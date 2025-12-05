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
// 2. UI 및 상태 관리 변수
// ===============================================
let selectedEqp = null;
let dataDisplayContainer = null; // chartContainerDiv 변수명 변경 및 목적 명확화

/**
 * 데이터 표시 영역을 초기 메시지로 설정합니다. (차트 관련 로직 없음)
 */
const clearDataDisplay = () => {
  if (dataDisplayContainer) {
    dataDisplayContainer.innerHTML = `
      <p id="data-message" style="text-align: center; margin-top: 20px; color: var(--color-text-placeholder);">
        EQP와 DATA를 선택하면 여기에 데이터 표시 영역이 활성화됩니다.
      </p>
    `;
  }
};

/**
 * 더미 데이터를 기반으로 데이터 표시 영역을 렌더링합니다. (ECharts 로직 완전 삭제)
 * @param {Array<{source: string, label: string}>} structuredMeasurements - 구조화된 측정값 배열
 */
const renderDataDisplay = (structuredMeasurements) => {
  if (
    !selectedEqp ||
    structuredMeasurements.length === 0 ||
    !dataDisplayContainer
  ) {
    clearDataDisplay();
    return;
  }

  clearDataDisplay();

  // measurementLabel (e.g., Temperature, Pressure) 기준으로 데이터를 그룹화합니다.
  const groupedMeasurements = structuredMeasurements.reduce((acc, current) => {
    if (!acc[current.label]) {
      acc[current.label] = [];
    }
    acc[current.label].push(current);
    return acc;
  }, {});

  const measurementLabels = Object.keys(groupedMeasurements);

  measurementLabels.forEach((measurementLabel) => {
    const datasetsForThisGroup = groupedMeasurements[measurementLabel];

    const groupWrapper = document.createElement("div");
    groupWrapper.className = "sub-data-group-wrapper";

    // 선택된 데이터 목록을 HTML 목록(ul) 형태로 생성하여 표시합니다.
    groupWrapper.innerHTML = `
      <h4 style="margin-top: 15px; color: var(--color-text-main); font-size: 16px;">
        ${selectedEqp} - ${measurementLabel} (선택된 데이터 그룹)
      </h4>
      <ul style="list-style: none; padding: 0;">
        ${datasetsForThisGroup
          .map(
            (item) =>
              `<li style="margin-bottom: 5px; border-left: 3px solid #6699ff; padding-left: 10px;">
             ${item.source}: ${item.label}
           </li>`
          )
          .join("")}
      </ul>
    `;
    dataDisplayContainer.appendChild(groupWrapper);
  });
};

// ===============================================
// 3. UI 렌더링 및 필터링 함수
// ===============================================

const renderEqpList = (eqpArray) => {
  const eqpContainer = document.getElementById("search-results");
  if (!eqpContainer || !eqpArray) return;
  eqpContainer
    .querySelectorAll(".search-result-item:not(.no-click-item)")
    .forEach((el) => el.remove());
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
  dataContainer.innerHTML = "";
  dataArray.forEach((dataItem) => {
    const item = document.createElement("a");
    item.href = "#";
    item.className = "search-result-item";
    item.dataset.target = "data-bar";
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
  items.forEach((item) => {
    const itemText = item.textContent.toLowerCase();
    if (itemText.includes(filterText)) {
      item.style.display = "block";
      visibleItemCount++;
    } else {
      item.style.display = "none";
    }
  });
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

  if (parentContainer) {
    containerId = parentContainer.id;

    if (containerId === "search-results") {
      // EQP 선택 로직
      parentContainer
        .querySelectorAll(".search-result-item")
        .forEach((el) => el.classList.remove("selected"));

      const dataContainer = document.getElementById("data-results");
      if (dataContainer) {
        dataContainer
          .querySelectorAll(".search-result-item")
          .forEach((el) => el.classList.remove("selected"));
        const dataBar = document.getElementById("data-bar");
        if (dataBar) dataBar.value = "";
      }

      selectedItem.classList.add("selected");
      selectedEqp = clickedValue;
      clearDataDisplay(); // 데이터 표시 영역 초기화
    } else if (containerId === "data-results") {
      // DATA 선택 로직
      isMultiSelect = true;
      selectedItem.classList.toggle("selected");

      const selectedDataNames = Array.from(
        parentContainer.querySelectorAll(".search-result-item.selected")
      ).map((el) => el.textContent.trim());

      let allStructuredMeasurements = [];

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

      const dataBar = document.getElementById("data-bar");
      if (dataBar) {
        dataBar.value = selectedDataNames.join(", ");
      }

      resultValues = selectedDataNames;

      if (selectedEqp && allStructuredMeasurements.length > 0) {
        // 일반 데이터 표시 함수 호출
        renderDataDisplay(allStructuredMeasurements);
      } else {
        clearDataDisplay();
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
// 4. 실행 코드: DOM 로드 후 이벤트 리스너 설정
// ===============================================
document.addEventListener("DOMContentLoaded", () => {
  // 차트 컨테이너 대신 데이터 표시 영역 컨테이너 지정
  dataDisplayContainer = document.querySelector(
    ".right-content .chart-container"
  );

  renderEqpList(eqpItemsFromBackend);
  renderDataList(dataItemsFromBackend);

  const resultItems = document.querySelectorAll(
    ".search-result-item:not(.no-click-item)"
  );

  const searchBar = document.getElementById("search-bar");

  if (searchBar) {
    searchBar.addEventListener("keyup", filterEqpItems);
    filterEqpItems();
  }

  resultItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const selectionResult = handleItemSelection(item);
      console.log("--- 항목 선택됨 ---");
      console.log("결과 객체:", selectionResult);
    });
  });

  clearDataDisplay();
});
