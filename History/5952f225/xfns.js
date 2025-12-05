// 1. 가상 데이터 정의 (10개의 독립적인 데이터 세트)
const chartDataSets = {
  Chart1: [10, 15, 7, 20, 25, 18, 22, 30],
  Chart2: [5, 12, 18, 10, 15, 25, 15, 10],
  Chart3: [2, 4, 6, 8, 10, 12, 14, 16],
  Chart4: [30, 25, 20, 15, 10, 5, 10, 15],
  Chart5: [1, 2, 4, 8, 16, 32, 64, 128],
  Chart6: [1, 1, 2, 3, 5, 8, 13, 21],
  Chart7: [50, 45, 40, 35, 30, 25, 20, 15],
  Chart8: [100, 90, 80, 70, 60, 50, 40, 30],
  Chart9: [12, 14, 16, 18, 20, 18, 16, 14],
  Chart10: [20, 21, 22, 23, 24, 25, 26, 27],
};

const labels = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
const chartKeys = Object.keys(chartDataSets);
const gridContainer = document.getElementById("chart-grid-container");

// 2. 차트 그리기 및 초기화 (이전과 동일)
function initializeCharts() {
  gridContainer.innerHTML = "";
  chartKeys.forEach((key) => {
    const chartDiv = document.createElement("div");
    chartDiv.id = `chart-${key}`;
    chartDiv.className = "grid-chart-item";
    gridContainer.appendChild(chartDiv);

    const trace = {
      x: labels,
      y: chartDataSets[key],
      type: "scatter",
      mode: "lines",
      name: key,
    };

    const layout = {
      title: {
        text: key,
        font: { size: 12, color: "#1d1d1f" },
      },
      autosize: true,
      margin: { t: 30, b: 20, l: 30, r: 10 },
      xaxis: { visible: false },
      yaxis: { title: false, fixedrange: true },
      showlegend: false,
      paper_bgcolor: "#f9f9f9",
      plot_bgcolor: "#f9f9f9",
    };

    Plotly.newPlot(chartDiv.id, [trace], layout, {
      responsive: true,
      displayModeBar: false,
    });
  });
}

// 3. 레이아웃 변경 핸들러
function handleLayoutChange(event) {
  if (!event.target.matches('input[name="chart-layout"]')) return;

  const layoutValue = event.target.value;

  // 1. 그리드 데이터 속성 업데이트 (CSS Grid가 레이아웃 변경)
  gridContainer.dataset.layout = layoutValue;

  // 2. 차트 표시/숨김 처리 로직
  let displayLimit = chartKeys.length;
  if (layoutValue === "3x3") {
    displayLimit = 9;
  } else if (layoutValue === "1x2") {
    displayLimit = 2;
  }

  chartKeys.forEach((key, index) => {
    const chartItem = document.getElementById(`chart-${key}`);
    if (chartItem) {
      // 인덱스가 제한보다 작으면 'block', 아니면 'none'
      chartItem.style.display = index < displayLimit ? "block" : "none";
    }
  });

  // 3. 💡 핵심 수정: 개별 차트 크기 재조정
  // 레이아웃 변경 시 CSS Grid에 의해 개별 차트 항목의 크기가 변합니다.
  // Plotly가 이를 반영하도록 개별 차트에 대해 relayout을 호출합니다.
  // DOM 업데이트가 완료될 시간을 주기 위해 setTimeout을 사용합니다.
  setTimeout(() => {
    chartKeys.forEach((key, index) => {
      const chartId = `chart-${key}`;
      const chartItem = document.getElementById(chartId);

      // 화면에 표시되는 차트만 크기 재조정
      if (chartItem && index < displayLimit) {
        // Plotly.relayout 함수를 사용하여 차트 크기를 컨테이너에 맞게 강제 재조정
        Plotly.relayout(chartId, {
          autosize: true,
          // width와 height를 명시적으로 설정하지 않고 autosize: true를 통해
          // 부모 요소(grid-chart-item)의 크기를 읽도록 유도합니다.
        });
      }
    });
  }, 50); // 50ms 후 실행하여 CSS Grid 크기 변경이 DOM에 적용될 시간을 줍니다.
}

// 4. 초기화 및 이벤트 리스너 설정
document.addEventListener("DOMContentLoaded", () => {
  // 1. 초기 차트 생성 및 초기화
  initializeCharts();

  // 2. 초기 레이아웃 설정 (CSS에 맞게 데이터셋 속성 지정)
  gridContainer.dataset.layout = "3x3";

  // 3. 레이아웃 선택 컨테이너에 이벤트 리스너 연결
  const layoutSelector = document.getElementById("layout-selector");
  if (layoutSelector) {
    layoutSelector.addEventListener("change", handleLayoutChange);
  }

  // 4. 초기 실행 (3x3)
  const initialEvent = { target: document.querySelector('input[value="3x3"]') };
  if (initialEvent.target) {
    handleLayoutChange(initialEvent);
  }

  // 5. 윈도우 크기 변경 시 차트 크기 재조정 (반응형 대응)
  // 윈도우 resize 이벤트는 Plotly가 자체적으로 처리합니다.
  window.addEventListener("resize", () => {
    // 모든 차트 항목을 순회하며 크기 재조정 (Plotly.Plots.resize()가 전체 div를 처리하지 못하므로)
    chartKeys.forEach((key) => {
      const chartId = `chart-${key}`;
      Plotly.relayout(chartId, { autosize: true });
    });
  });
});
