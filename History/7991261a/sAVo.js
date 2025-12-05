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
// 2. UI 및 상태 관리 변수 (Chart.js 인스턴스 포함)
// ===============================================
let chartMap = new Map(); // Chart.js 인스턴스를 저장합니다.
let selectedEqp = null;
let chartContainerDiv = null; // 차트를 표시할 컨테이너

/**
 * 모든 차트 인스턴스를 파괴하고 영역을 초기 메시지로 설정합니다.
 */
const clearAllCharts = () => {
  chartMap.forEach((chart) => chart.destroy()); // Chart.js 인스턴스 파괴
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
 * 하위 속성 배열을 기반으로 다중 차트를 렌더링하고 업데이트합니다. (Chart.js 구현)
 * @param {Array<{source: string, label: string}>} structuredMeasurements - 구조화된 측정값 배열
 */
const renderMultipleCharts = (structuredMeasurements) => {
  // Chart.js 라이브러리 로드 여부 확인
  if (typeof Chart === 'undefined') {
      console.error("Chart.js 라이브러리가 로드되지 않았습니다. HTML 파일에 CDN을 추가해주세요.");
      return;
  }
  
  if (
    !selectedEqp ||
    structuredMeasurements.length === 0 ||
    !chartContainerDiv
  ) {
    clearAllCharts();
    return;
  }

  clearAllCharts();

  // measurementLabel (e.g., Temperature, Pressure) 기준으로 데이터를 그룹화합니다.
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
    "rgb(153, 102, 255)",
    "rgb(201, 203, 207)",
  ];
  
  // X축 레이블 (더미 시간축)
  const mockLabels = Array(15)
    .fill(0)
    .map((_, i) => `Time ${i + 1}`);

  measurementLabels.forEach((measurementLabel, chartIndex) => {
    const datasetsForThisChart = groupedMeasurements[measurementLabel];

    const divId = `chartjs-${measurementLabel.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}-${chartIndex}`;

    // 차트를 담을 Wrapper와 Canvas를 생성합니다.
    const chartWrapper = document.createElement("div");
    chartWrapper.className = "sub-chart-wrapper";
    chartWrapper.innerHTML = `
      <h4 style="margin-top: 15px; color: var(--color-text-main); font-size: 16px;">
          ${selectedEqp} - ${measurementLabel} (비교)
      </h4>
      <div style="height: 300px; width: 100%;">
          <canvas id="${divId}"></canvas>
      </div>
    `;
    chartContainerDiv.appendChild(chartWrapper);

    // Chart.js 데이터셋 준비
    const chartDatasets = datasetsForThisChart.map((dataItem, dataIndex) => {
      // 목업 데이터 생성 로직
      const mockData = Array(15)
        .fill(0)
        .map((_, i) =>
          dataItem.label.includes("Pressure")
            ? Math.floor(Math.random() * 50) + 100 // 압력 (100-150)
            : dataItem.label.includes("Temperature")
            ? Math.floor(Math.random() * 30) + 20 // 온도 (20-50)
            : Math.floor(Math.random() * 80) // 기타 (0-80)
        );
      
      const color = colors[dataIndex % colors.length];

      return {
        label: dataItem.source, // 범례(Legend)에 표시될 이름
        data: mockData,
        borderColor: color,
        backgroundColor: color,
        fill: false,
        tension: 0.4, // 라인을 부드럽게 (ECharts smooth: true 와 유사)
        pointRadius: 3 // 데이터 포인트 크기
      };
    });

    const ctx = document.getElementById(divId).getContext('2d');
    
    // Chart.js 인스턴스 생성
    const myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: mockLabels,
        datasets: chartDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // height: 300px를 유지하도록 설정
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          }
        },
        scales: {
          x: {
            type: 'category',
          },
          y: {
            beginAtZero: false
          }
        },
      }
    });
    
    chartMap.set(divId, myChart);
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
      clearAllCharts(); // 👈 수정: clearDataDisplay -> clearAllCharts**
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
        // Chart.js 차트 렌더링 함수 호출
        renderMultipleCharts(allStructuredMeasurements); // 👈 수정: renderDataDisplay -> renderMultipleCharts**
      } else {
        **clearAllCharts(); // 👈 수정: clearDataDisplay -> clearAllCharts**
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
  // dataDisplayContainer 변수명을 차트 용도에 맞게 다시 지정
  chartContainerDiv = document.querySelector(
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

  clearAllCharts();
});