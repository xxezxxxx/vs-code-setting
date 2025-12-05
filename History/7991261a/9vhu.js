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
let chartContainerDiv = null;

/**
 * 모든 Plotly 차트를 제거하고 영역을 초기 메시지로 설정합니다.
 */
const clearAllCharts = () => {
  // Plotly 차트를 제거합니다.
  if (chartContainerDiv && chartContainerDiv.children) {
    Array.from(chartContainerDiv.children).forEach((child) => {
      // Plotly가 렌더링한 DIV 내부에 Plotly 요소가 있는지 확인하여 제거
      if (child.className.includes("sub-chart-wrapper")) {
        const plotDivId = child.querySelector('div[id^="plotly-chart-"]')?.id;
        if (plotDivId) {
          // Plotly.purge를 사용하여 메모리에서 차트를 정리합니다.
          Plotly.purge(plotDivId);
        }
      }
    });
  }

  if (chartContainerDiv) {
    chartContainerDiv.innerHTML = `
      <p id="chart-message" style="text-align: center; margin-top: 20px; color: var(--color-text-placeholder);">
        EQP와 DATA를 선택하면 여기에 차트가 표시됩니다.
      </p>
    `;
  }
};

/**
 * 하위 속성 배열을 기반으로 다중 차트를 렌더링하고 업데이트합니다. (Plotly.js 구현)
 * @param {Array<{source: string, label: string}>} structuredMeasurements - 구조화된 측정값 배열
 */
const renderMultipleCharts = (structuredMeasurements) => {
  // Plotly 라이브러리 로드 여부 확인
  if (typeof Plotly === "undefined") {
    console.error(
      "Plotly.js 라이브러리가 로드되지 않았습니다. HTML 파일에 CDN을 추가해주세요."
    );
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
  const mockXLabels = Array(15)
    .fill(0)
    .map((_, i) => `Time ${i + 1}`);

  measurementLabels.forEach((measurementLabel, chartIndex) => {
    const datasetsForThisChart = groupedMeasurements[measurementLabel];

    const divId = `plotly-chart-${measurementLabel.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}-${chartIndex}`;

    // 차트를 담을 Wrapper와 Plotly 렌더링 DIV를 생성합니다.
    const chartWrapper = document.createElement("div");
    chartWrapper.className = "sub-chart-wrapper";
    chartWrapper.innerHTML = `
      <h4 style="margin-top: 15px; color: var(--color-text-main); font-size: 16px;">
        ${selectedEqp} - ${measurementLabel} (비교)
      </h4>
      <div id="${divId}" style="height: 350px; width: 100%;"></div>
    `;
    chartContainerDiv.appendChild(chartWrapper);

    // Plotly.js Trace (데이터셋) 준비
    const traces = datasetsForThisChart.map((dataItem, dataIndex) => {
      // 목업 데이터 생성 로직
      const mockYData = Array(15)
        .fill(0)
        .map(() =>
          dataItem.label.includes("Pressure")
            ? Math.floor(Math.random() * 50) + 100
            : dataItem.label.includes("Temperature")
            ? Math.floor(Math.random() * 30) + 20
            : Math.floor(Math.random() * 80)
        );

      return {
        x: mockXLabels,
        y: mockYData,
        mode: "lines",
        name: dataItem.source,
        line: {
          color: colors[dataIndex % colors.length],
          shape: "spline",
          width: 2,
        },
        type: "scatter",
      };
    });

    // Plotly.js 레이아웃 설정 (기본적으로 Zoom/Pan 지원)
    const layout = {
      autosize: true,
      margin: { t: 30, r: 20, b: 30, l: 40 },
      showlegend: true,
      legend: {
        orientation: "h",
        yanchor: "top",
        y: 1.1,
      },
      xaxis: {
        title: "Time Step",
        tickmode: "array",
      },
      dragmode: "zoom", // 기본 드래그 모드를 줌으로 설정
    };

    // Plotly.js 구성 (툴바 표시 옵션)
    const config = {
      responsive: true,
      displayModeBar: true, // 툴바(툴박스) 표시
      modeBarButtonsToRemove: ["select2d", "lasso2d", "toggleHover", "toImage"],
    };

    Plotly.newPlot(divId, traces, layout, config);
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
      clearAllCharts();
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
        // Plotly 차트 렌더링 함수 호출
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
// 4. 실행 코드: DOM 로드 후 이벤트 리스너 설정
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

  // ⭐⭐ 왼쪽 패널 토글 기능 추가 ⭐⭐
  const mainWrapper = document.querySelector(".main-wrapper");
  const toggleButton = document.getElementById("toggle-sidebar");

  if (toggleButton && mainWrapper) {
    toggleButton.addEventListener("click", () => {
      mainWrapper.classList.toggle("collapsed");

      // 버튼 텍스트(아이콘)를 변경합니다.
      if (mainWrapper.classList.contains("collapsed")) {
        toggleButton.innerHTML = "&gt;"; // 펴기 (>)
      } else {
        toggleButton.innerHTML = "&lt;"; // 접기 (<)
      }

      // 패널 크기 변경 후 Plotly 차트를 리사이즈하여 레이아웃 오류를 방지합니다.
      // 100ms 지연 후 실행 (CSS transition 완료를 기다림)
      setTimeout(() => {
        const plotlyDivs = document.querySelectorAll(
          '.sub-chart-wrapper div[id^="plotly-chart-"]'
        );
        plotlyDivs.forEach((div) => {
          // Plotly.Plots.resize는 차트 컨테이너 크기 변경에 맞춰 차트를 다시 그립니다.
          if (div.id && typeof Plotly !== "undefined") {
            Plotly.Plots.resize(div.id);
          }
        });
      }, 300); // CSS transition 시간(0.3s)과 일치하도록 300ms 설정
    });
  }

  clearAllCharts();
});
