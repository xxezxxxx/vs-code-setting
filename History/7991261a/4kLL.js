// ===============================================
// 1. EQP & DATA (백엔드 데이터 구조) - 변경 없음
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
// 7. Plotly 다중 차트 관리 변수 및 함수
// ===============================================
let chartMap = new Map(); // key를 divId로 사용합니다.
let selectedEqp = null;
let chartContainerDiv = null;

// Plotly의 기본 색상 팔레트
const plotlyColors = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
  '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
  '#bcbd22', '#17becf'
];

/**
 * 모든 차트와 메시지를 초기화합니다.
 */
const clearAllCharts = () => {
  chartMap.forEach((chartDomId) => {
    // Plotly.js를 사용하여 차트를 제거합니다.
    const chartDom = document.getElementById(chartDomId);
    if (chartDom) {
      Plotly.purge(chartDomId);
    }
  });
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
 * 특정 차트의 Zoom을 초기화합니다.
 * @param {string} divId - 차트 컨테이너 ID
 */
const resetZoom = (divId) => {
  const chartDom = document.getElementById(divId);
  if (chartDom) {
    // Plotly의 relayout을 사용하여 x축 범위를 초기값으로 되돌립니다.
    Plotly.relayout(divId, {
      'xaxis.autorange': true,
      'yaxis.autorange': true
    });
  }
};

/**
 * 하위 속성 배열을 기반으로 다중 차트를 렌더링하고 업데이트합니다. (Plotly 구현)
 * @param {Array<{source: string, label: string}>} structuredMeasurements - 구조화된 측정값 배열
 */
const renderMultipleCharts = (structuredMeasurements) => {
  if (
    !selectedEqp ||
    structuredMeasurements.length === 0 ||
    !chartContainerDiv
  ) {
    clearAllCharts();
    return;
  }

  clearAllCharts();

  // 2. 측정 항목 레이블별 그룹화
  const groupedMeasurements = structuredMeasurements.reduce((acc, current) => {
    if (!acc[current.label]) {
      acc[current.label] = [];
    }
    acc[current.label].push(current);
    return acc;
  }, {});

  const measurementLabels = Object.keys(groupedMeasurements);

  // 3. 그룹별로 차트 생성
  measurementLabels.forEach((measurementLabel, chartIndex) => {
    const datasetsForThisChart = groupedMeasurements[measurementLabel];

    const divId = `plotly-${measurementLabel.replace(
      /[^a-zA-Z0-9]/g, "_"
    )}-${chartIndex}`;

    // 차트 wrapper (버튼 제거)
    const chartWrapper = document.createElement("div");
    chartWrapper.className = "sub-chart-wrapper";
    chartWrapper.innerHTML = `
      <h4 style="margin-top: 15px; color: var(--color-text-main); font-size: 16px;">
        ${selectedEqp} - ${measurementLabel} (비교)
      </h4>
      <div id="${divId}" style="height: 300px; width: 100%;"></div> 
    `;
    chartContainerDiv.appendChild(chartWrapper);

    // Mock 데이터 (시뮬레이션)
    const mockLabels = Array(50) // Plotly는 데이터 포인트가 많을수록 좋습니다.
      .fill(0)
      .map((_, i) => `Time ${i + 1}`);

    const traces = datasetsForThisChart.map((dataItem, dataIndex) => {
      const mockData = Array(50)
        .fill(0)
        .map((_, i) =>
          dataItem.label.includes("Pressure")
            ? Math.floor(Math.random() * 50) + 100 + Math.sin(i / 5) * 10
            : dataItem.label.includes("Temperature")
              ? Math.floor(Math.random() * 30) + 20 + Math.cos(i / 10) * 5
              : Math.floor(Math.random() * 80)
        );

      return {
        x: mockLabels,
        y: mockData,
        name: dataItem.source,
        mode: 'lines',
        line: {
          color: plotlyColors[dataIndex % plotlyColors.length],
          width: 2
        }
      };
    });

    // 4. Plotly 차트 생성 및 옵션 설정
    const layout = {
      title: false, // 제목은 위에 h4로 표시되므로 제거
      margin: { t: 20, r: 20, b: 50, l: 50 },
      hovermode: 'x unified',
      xaxis: {
        title: 'Time',
        rangeslider: { visible: false },
        autorange: true // 초기 자동 범위 설정
      },
      yaxis: {
        title: measurementLabel,
        autorange: true // 초기 자동 범위 설정
      },
      legend: {
        orientation: "h",
        y: 1.1,
        x: 0,
      }
    };

    const config = {
      // **핵심 수정: 모든 버튼 제거**
      displayModeBar: false,
      // 드래그 모드를 Box Zoom으로 설정 (마우스 휠은 기본 Zoom)
      scrollZoom: true, // 휠 확대/축소 활성화
      dragmode: 'zoom'
    };

    Plotly.newPlot(divId, traces, layout, config);
    chartMap.set(divId, divId); // Map에 차트 ID 저장

    // 5. 드래그 방향 감지 로직 (역방향 드래그 시 초기화만 수행)
    const chartDom = document.getElementById(divId);
    let dragStartX = 0;
    let isDragging = false;
    const DRAG_THRESHOLD = 5;

    // 마우스 다운 (드래그 시작) - 차트 DOM에 등록
    chartDom.addEventListener("mousedown", (e) => {
      // 차트의 캔버스 영역에서만 드래그 시작으로 간주
      if (e.target.closest('.plot-container') && e.buttons === 1) {
        isDragging = true;
        dragStartX = e.clientX;
      }
    });

    // 마우스 업 (드래그 종료) - document에 등록하여 안정성 확보
    document.addEventListener("mouseup", (e) => {
      if (!isDragging) return;

      const dragEndX = e.clientX;
      const dx = dragEndX - dragStartX;

      isDragging = false; // 마우스 버튼이 떼어지면 드래그 상태 초기화

      // 1. 이동 거리가 임계값 미만이면 무시
      if (Math.abs(dx) < DRAG_THRESHOLD) {
        return;
      }

      // 2. X축 기준, 우측 -> 좌측으로 드래그 했을 때 (역방향: dx < 0)
      if (dx < 0) {
        // 역방향 드래그는 Zoom 대신 초기화 기능을 수행합니다.
        resetZoom(divId);
      }
      // 3. 정방향 드래그 (dx > 0)는 Plotly의 Box Zoom이 담당합니다.

    }, { once: true });
  });
};

// ===============================================
// 2, 3, 5, 4, 6번 함수는 변경 사항 없음
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
        // Plotly 렌더링 함수 호출
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
// 6. 실행 코드: DOM 로드 후 이벤트 리스너 설정 (Plotly 로드 확인 필요)
// ===============================================
document.addEventListener("DOMContentLoaded", () => {
  // Plotly 라이브러리가 HTML에 로드되어 있어야 합니다.
  if (typeof Plotly === 'undefined') {
    console.error("Plotly.js 라이브러리가 로드되지 않았습니다. <script src='https://cdn.plot.ly/plotly-latest.min.js'></script>를 HTML에 추가해 주세요.");
    return;
  }

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