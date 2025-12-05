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

// DATA 목록 (하위 속성 sub_data 포함)
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
      "Temperature", // 비교 테스트용
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
// 7. Chart.js 다중 차트 관리 변수 및 함수 (Zoom/Pan 이벤트 활용 통합)
// ===============================================
let chartMap = new Map(); // key를 canvasId로 사용합니다.
let selectedEqp = null;
let chartContainerDiv = null;

/**
 * 모든 차트와 메시지를 초기화합니다.
 */
const clearAllCharts = () => {
  chartMap.forEach((chart) => chart.destroy());
  chartMap.clear();

  if (chartContainerDiv) {
    chartContainerDiv.innerHTML = `
            <p id="chart-message" style="text-align: center; margin-top: 20px; color: var(--color-text-placeholder);">
                EQP와 DATA를 선택하면 여기에 차트가 표시됩니다.
            </p>
        `;
  }
};

/**
 * 특정 차트의 Zoom/Pan을 초기화하고, 상태를 업데이트합니다.
 * HTML 버튼에서 호출됩니다.
 */
const resetZoom = (canvasId) => {
  const chart = chartMap.get(canvasId);
  if (chart) {
    chart.resetZoom(); // 상태 업데이트 로직 (onZoomComplete에서 하는 것과 동일)
    const resetBtn = document.getElementById(`reset-btn-${canvasId}`);
    if (resetBtn) {
      resetBtn.style.opacity = "0.5";
      resetBtn.style.pointerEvents = "none";
      resetBtn.textContent = "🔄 Zoom 초기화 (역방향 드래그)";
    }
  }
};

/**
 * 하위 속성 배열을 기반으로 다중 차트를 렌더링하고 업데이트합니다.
 * @param {Array<{source: string, label: string}>} structuredMeasurements - 구조화된 측정값 배열
 */
// [!!! 중요: 이 함수는 전역 변수 dragStartX에 의존하지 않습니다. !!!]

// [!!! 중요: 이 함수는 전역 변수 dragStartX에 의존하지 않습니다. !!!]

const renderMultipleCharts = (structuredMeasurements) => {
  if (
    !selectedEqp ||
    structuredMeasurements.length === 0 ||
    !chartContainerDiv
  ) {
    clearAllCharts();
    return;
  } // 1. 기존 차트 제거

  clearAllCharts(); // 2. 측정 항목 레이블별 그룹화

  const groupedMeasurements = structuredMeasurements.reduce((acc, current) => {
    if (!acc[current.label]) {
      acc[current.label] = [];
    }
    acc[current.label].push(current);
    return acc;
  }, {});

  const measurementLabels = Object.keys(groupedMeasurements);

  const colors = [
    "rgb(255, 99, 132)",
    "rgb(54, 162, 235)",
    "rgb(75, 192, 192)",
    "rgb(255, 159, 64)",
    "rgb(153, 102, 255)", // 색상 통일
    "rgb(201, 203, 207)",
  ]; // 3. 그룹별로 차트 생성

  measurementLabels.forEach((measurementLabel, chartIndex) => {
    const datasetsForThisChart = groupedMeasurements[measurementLabel];

    const canvasId = `chart-${measurementLabel.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}-${chartIndex}`; // 차트 wrapper + 버튼 생성

    const chartWrapper = document.createElement("div");
    chartWrapper.className = "sub-chart-wrapper";
    chartWrapper.innerHTML = `
        <h4 style="margin-top: 15px; color: var(--color-text-main); font-size: 16px;">
            ${selectedEqp} - ${measurementLabel} (비교)
        </h4>
        <canvas id="${canvasId}"></canvas>
        <button id="reset-btn-${canvasId}" onclick="resetZoom('${canvasId}')"
            style="margin-top: 5px; padding: 5px 10px; background: var(--color-background-sub); 
            color: var(--color-text-main); border: 1px solid var(--color-border-main); 
            border-radius: 4px; cursor: pointer; font-size: 12px; margin-bottom: 10px; 
            opacity: 0.5; pointer-events: none;">
            🔄 Zoom 초기화 (역방향 드래그)
        </button>
    `;
    chartContainerDiv.appendChild(chartWrapper); // Mock 데이터 (시뮬레이션)

    const datasets = datasetsForThisChart.map((dataItem, dataIndex) => {
      const mockData = Array(15)
        .fill(0)
        .map((_, i) =>
          dataItem.label.includes("Pressure")
            ? Math.floor(Math.random() * 50) + 100
            : dataItem.label.includes("Temperature")
            ? Math.floor(Math.random() * 30) + 20
            : Math.floor(Math.random() * 80)
        );
      return {
        label: dataItem.source,
        data: mockData,
        borderColor: colors[dataIndex % colors.length],
        tension: 0.3,
        borderWidth: 2,
        fill: false,
      };
    }); // Zoom 상태 버튼 업데이트 함수

    const onZoomComplete = ({ chart }) => {
      const resetBtn = document.getElementById(`reset-btn-${canvasId}`);
      const isZoomed = chart.isZoomedOrPanned();

      if (resetBtn) {
        if (isZoomed) {
          resetBtn.style.opacity = "1";
          resetBtn.style.pointerEvents = "auto";
          resetBtn.textContent = "✅ 확대됨: 🔄 Zoom 초기화 (역방향 드래그)";
        } else {
          resetBtn.style.opacity = "0.5";
          resetBtn.style.pointerEvents = "none";
          resetBtn.textContent = "🔄 Zoom 초기화 (역방향 드래그)";
        }
      }
    };

    const mockLabels = Array(15)
      .fill(0)
      .map((_, i) => `Time ${i + 1}`); // 4. Chart.js 생성

    const newChart = new Chart(
      document.getElementById(canvasId).getContext("2d"),
      {
        type: "line",
        data: {
          labels: mockLabels,
          datasets: datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: false },
            zoom: {
              zoom: {
                drag: {
                  enabled: true, // [!!! Zoom 기능 다시 활성화 !!!]
                  backgroundColor: "rgba(54, 162, 235, 0.2)",
                },
                mode: "xy",
                speed: 0.1,
              },
              pan: {
                enabled: true,
                mode: "xy",
                modifierKey: "shift",
              }, // ⬇⬇⬇ 드래그 시작 지점 기억 (개별 차트 인스턴스에 저장)

              onZoomStart({ chart, event }) {
                chart.dragStartX = event.x; // X축 시작점만 기억
              }, // ⬇⬇⬇ [재수정됨] 우 -> 좌 드래그 시 초기화 및 Zoom 차단

              beforeZoom({ chart, event }) {
                const dragEndX = event.x;
                const dragStartX = chart.dragStartX; // X축 기준, 우측 -> 좌측으로 드래그 했을 때 (역방향)

                if (dragStartX !== undefined && dragEndX < dragStartX) {
                  chart.resetZoom(); // 버튼 상태 수동 업데이트 (초기화 후에는 isZoomed가 false)

                  const resetBtn = document.getElementById(
                    `reset-btn-${canvasId}`
                  );
                  if (resetBtn) {
                    resetBtn.style.opacity = "0.5";
                    resetBtn.style.pointerEvents = "none";
                    resetBtn.textContent = "🔄 Zoom 초기화 (역방향 드래그)";
                  }

                  return false; // Zoom 동작 자체 차단
                } // 좌측 -> 우측 드래그 (정방향)은 Zoom 허용

                return true;
              },
              onZoomComplete: onZoomComplete,
            },
          },
          scales: {
            x: {},
            y: {},
          },
        },
      }
    );

    chartMap.set(canvasId, newChart);

    onZoomComplete({ chart: newChart });
  });
};

// ... (나머지 함수는 변경 없음)

// ===============================================
// 2, 3, 5번 함수는 변경 사항 없음
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

// ===============================================
// 4. 선택 처리 함수 (변경 사항 없음)
// ===============================================
const handleItemSelection = (selectedItem) => {
  const clickedValue = selectedItem.textContent.trim();
  const parentContainer = selectedItem.closest(".search-results-container");
  let containerId = null;
  let isMultiSelect = false;
  let resultValues = clickedValue;

  if (parentContainer) {
    containerId = parentContainer.id;

    if (containerId === "search-results") {
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
      clearAllCharts();
    } else if (containerId === "data-results") {
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
        renderMultipleCharts(allStructuredMeasurements);
      } else {
        clearAllCharts();
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
// 6. 실행 코드: DOM 로드 후 이벤트 리스너 설정 (변경 사항 없음)
// ===============================================
document.addEventListener("DOMContentLoaded", () => {
  chartContainerDiv = document.querySelector(".right-content .chart-container");

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

  clearAllCharts();
});
