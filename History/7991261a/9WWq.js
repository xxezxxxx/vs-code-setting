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
// 7. ECharts 다중 차트 관리 변수 및 함수
// ===============================================
let chartMap = new Map(); // key를 divId로 사용합니다.
let selectedEqp = null;
let chartContainerDiv = null;

/**
 * 모든 차트와 메시지를 초기화합니다.
 */
const clearAllCharts = () => {
  chartMap.forEach((chart) => chart.dispose());
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
 * 특정 차트의 Zoom을 초기화하고, Box Zoom 모드로 재진입시킵니다.
 * @param {string} divId - 차트 컨테이너 ID
 */
const resetZoom = (divId) => {
  const chart = chartMap.get(divId);
  if (chart) {
    // 1. Zoom을 초기 상태 (0% ~ 100%)로 되돌립니다.
    chart.dispatchAction({
      type: "dataZoom",
      start: 0,
      end: 100,
    }); // 2. 초기화 후, Box Zoom 모드로 재진입 (사용자의 다음 드래그가 영역 확대가 되도록)

    chart.dispatchAction({
      type: "takeGlobalCursor",
      key: "dataZoom",
      dataZoomOption: {
        xAxisIndex: [0], // X축 Zoom 활성화
        yAxisIndex: [0], // Y축 Zoom 활성화
      },
    });
  }
};

/**
 * 하위 속성 배열을 기반으로 다중 차트를 렌더링하고 업데이트합니다. (ECharts 구현)
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
    "rgb(153, 102, 255)",
    "rgb(201, 203, 207)",
  ]; // 3. 그룹별로 차트 생성

  measurementLabels.forEach((measurementLabel, chartIndex) => {
    const datasetsForThisChart = groupedMeasurements[measurementLabel];

    const divId = `echart-${measurementLabel.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}-${chartIndex}`; // 차트 wrapper

    const chartWrapper = document.createElement("div");
    chartWrapper.className = "sub-chart-wrapper";
    chartWrapper.innerHTML = `
        <h4 style="margin-top: 15px; color: var(--color-text-main); font-size: 16px;">
            ${selectedEqp} - ${measurementLabel} (비교)
        </h4>
        <div id="${divId}" style="height: 300px; width: 100%;"></div> 
    `;
    chartContainerDiv.appendChild(chartWrapper); // Mock 데이터 (시뮬레이션)

    const mockLabels = Array(15)
      .fill(0)
      .map((_, i) => `Time ${i + 1}`);
    const seriesData = datasetsForThisChart.map((dataItem, dataIndex) => {
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
        name: dataItem.source,
        type: "line",
        data: mockData,
        itemStyle: { color: colors[dataIndex % colors.length] },
        smooth: true,
      };
    }); // 4. ECharts 생성 및 옵션 설정

    const chartDom = document.getElementById(divId);
    if (typeof echarts === "undefined") {
      console.error("ECharts 라이브러리가 로드되지 않았습니다.");
      return;
    }
    const myChart = echarts.init(chartDom);

    const option = {
      tooltip: { trigger: "axis" },
      toolbox: {
        show: true,
        orient: "horizontal",
        right: 10,
        top: 0,
        feature: {
          // **[수정] Pan (이동) 관련 기능 삭제**
          dataZoom: {
            title: { zoom: "영역확대", back: "되돌리기" }, // X축과 Y축 모두 Box Zoom의 대상이 되도록 명시
            xAxisIndex: [0],
            yAxisIndex: [0],
          },
          restore: {
            title: "초기화",
          },
        },
      },
      legend: { data: datasetsForThisChart.map((d) => d.source) },
      grid: {
        left: "3%",
        right: "10%",
        bottom: "15%",
        top: "20%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: mockLabels,
        boundaryGap: false,
        min: "dataMin",
        max: "dataMax",
      },
      yAxis: { type: "value" },
      series: seriesData, // dataZoom 컴포넌트 (내부): 휠 확대/축소만 담당
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          yAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: true, // 휠은 Zoom // **[핵심 수정] 드래그 이동(Pan) 비활성화** -> 드래그가 Box Zoom을 위한 선택 동작이 되도록 함
          moveOnMouseMove: false,
          moveOnMouseWheel: false,
        },
      ],
    };

    myChart.setOption(option);
    chartMap.set(divId, myChart); // **[핵심 추가] 차트 로드 직후, 드래그가 바로 Box Zoom 모드가 되도록 강제 설정**

    // 이 dispatchAction은 '영역 확대' 툴 버튼을 누른 것과 같은 효과를 냅니다.
    myChart.dispatchAction({
      type: "takeGlobalCursor",
      key: "dataZoom",
      dataZoomOption: {
        xAxisIndex: [0],
        yAxisIndex: [0],
      },
    });
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
        // ECharts 렌더링 함수 호출
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
