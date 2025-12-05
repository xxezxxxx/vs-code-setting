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
  // ECharts 인스턴스 해제
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
 * 특정 차트의 Zoom/Pan을 초기화하고, 상태를 업데이트합니다.
 * @param {string} divId - 차트 컨테이너 ID
 */
const resetZoom = (divId) => {
  const chart = chartMap.get(divId);
  if (chart) {
    // ECharts의 dataZoom 컴포넌트를 사용하여 초기화
    chart.dispatchAction({
      type: "dataZoom",
      start: 0,
      end: 100,
    }); // 버튼 상태 수동 업데이트

    const resetBtn = document.getElementById(`reset-btn-${divId}`);
    if (resetBtn) {
      resetBtn.style.opacity = "0.5";
      resetBtn.style.pointerEvents = "none";
      resetBtn.textContent = "🔄 Zoom 초기화 (역방향 드래그)";
    }
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
    )}-${chartIndex}`; // 차트 wrapper + 버튼 생성

    const chartWrapper = document.createElement("div");
    chartWrapper.className = "sub-chart-wrapper";
    chartWrapper.innerHTML = `
        <h4 style="margin-top: 15px; color: var(--color-text-main); font-size: 16px;">
            ${selectedEqp} - ${measurementLabel} (비교)
        </h4>
        <div id="${divId}" style="height: 300px; width: 100%;"></div> 
        <button id="reset-btn-${divId}" onclick="resetZoom('${divId}')"
            style="margin-top: 5px; padding: 5px 10px; background: var(--color-background-sub); 
            color: var(--color-text-main); border: 1px solid var(--color-border-main); 
            border-radius: 4px; cursor: pointer; font-size: 12px; margin-bottom: 10px; 
            opacity: 0.5; pointer-events: none;">
            🔄 Zoom 초기화 (역방향 드래그)
        </button>
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
      legend: { data: datasetsForThisChart.map((d) => d.source) },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "15%",
        top: "20%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: mockLabels,
        boundaryGap: false,
      },
      yAxis: { type: "value" },
      series: seriesData, // dataZoom 컴포넌트: 내부 드래그를 통해 Zoom/Pan 활성화
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          filterMode: "none",
          // Zoom/Pan 동작을 모두 활성화
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: "inside",
          yAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
      ],
    };

    myChart.setOption(option);
    chartMap.set(divId, myChart); // 5. ECharts 이벤트 리스너를 사용하여 드래그 방향에 따른 초기화 로직 구현 // dataZoom 발생 시 버튼 상태 업데이트

    myChart.on("datazoom", function (params) {
      // start/end 비율을 확인하여 확대 상태인지 판단
      const isZoomed = !(params.start === 0 && params.end === 100);
      const resetBtn = document.getElementById(`reset-btn-${divId}`);

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
    }); // ⬇⬇⬇ 드래그 방향 감지를 위한 DOM 이벤트 리스너 (Zoom 충돌 방지 로직 적용) ⬇⬇⬇

    let dragStartX = 0;
    let isDragging = false;
    const DRAG_THRESHOLD = 5; // 5 픽셀 이하의 움직임은 무시 // 마우스 다운 (드래그 시작) - 차트 DOM에 등록

    chartDom.addEventListener("mousedown", (e) => {
      isDragging = true;
      dragStartX = e.clientX;
    }); // 마우스 업 (드래그 종료) - document에 등록하여 안정성 확보

    // 주의: ECharts의 dataZoom 기능은 마우스 다운/업 이벤트를 내부적으로 사용하므로,
    // 이 DOM 이벤트를 너무 민감하게 처리하면 정방향 Zoom이 방해받을 수 있습니다.
    document.addEventListener(
      "mouseup",
      (e) => {
        if (!isDragging) return;

        const dragEndX = e.clientX;
        const dx = dragEndX - dragStartX;

        // 차트 DOM 위에서 시작한 드래그만 처리
        if (!chartDom.contains(e.target) && Math.abs(dx) > 100) {
          // 차트 밖에서 끝난 드래그는 ECharts가 처리할 수 없으므로,
          // 드래그가 차트 밖에서 끝나고 이동 거리가 클 때만 isDragging을 false로 바꾸지 않고 다음 로직을 스킵합니다.
          // ECharts의 내부 Zoom 로직이 완료되도록 isDragging은 잠시 유지합니다.
          // 하지만 여기서는 간단히 isDragging을 초기화하고, 역방향 로직만 수행합니다.
          // 정방향 드래그는 ECharts가 DOM 이벤트를 처리했을 것이므로, 이곳에서 아무것도 하지 않습니다.
        }

        isDragging = false; // 마우스 버튼이 떼어졌으므로 상태 초기화 // 1. 이동 거리가 임계값 미만이면 무시 (클릭 또는 미세한 움직임)

        if (Math.abs(dx) < DRAG_THRESHOLD) {
          return;
        } // 2. X축 기준, 우측 -> 좌측으로 드래그 했을 때 (역방향: dx < 0)

        if (dx < 0) {
          // 역방향 드래그는 Zoom 대신 초기화 기능을 수행합니다.
          resetZoom(divId);
        }
        // 3. 정방향 드래그 (dx > 0)는 ECharts의 기본 dataZoom 기능이 담당합니다.
      },
      { once: true }
    ); // 마우스 업은 한 번만 실행되도록 설정 // 드래그 취소 (캔버스 밖으로 마우스가 나갔을 때)

    chartDom.addEventListener("mouseleave", () => {
      // 마우스가 차트 영역을 벗어날 때 드래그 상태를 해제하지 않아, document의 mouseup이 최종 처리를 하도록 합니다.
    }); // 초기상태 버튼 설정

    const initialResetBtn = document.getElementById(`reset-btn-${divId}`);
    if (initialResetBtn) {
      initialResetBtn.style.opacity = "0.5";
      initialResetBtn.style.pointerEvents = "none";
    }
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
