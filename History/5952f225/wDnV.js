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

// 3. Column 개수 변경 핸들러 (이름 변경 및 로직 단순화)
function handleColumnChange(event) {
  if (!event.target.matches('input[name="chart-cols"]')) return;

  const colCount = parseInt(event.target.value); // 선택된 Column 개수 (1, 2, 3, 4)
  const totalVisibleCharts = 10; // 최대 표시할 차트 개수 (여기서는 10개 모두 표시)

  // 1. 그리드 데이터 속성 업데이트 (CSS가 Flex 아이템 너비 조정)
  gridContainer.dataset.cols = colCount;

  // 2. 차트 표시/숨김 처리 (여기서는 모두 표시하거나 필요에 따라 제어할 수 있습니다.)
  // 모든 차트를 'block'으로 표시하고 CSS가 플렉스 배치를 담당하도록 합니다.
  chartKeys.forEach((key) => {
    const chartItem = document.getElementById(`chart-${key}`);
    if (chartItem) {
      // 여기서는 모든 차트를 표시(block)하고, CSS에서 .chart-flex-container가 10개까지 플렉스 배치합니다.
      chartItem.style.display = "block";
    }
  });

  // 3. 💡 핵심 수정: 개별 차트 크기 재조정
  // DOM 업데이트가 완료될 시간을 주기 위해 setTimeout을 사용합니다.
  setTimeout(() => {
    chartKeys.forEach((key) => {
      const chartId = `chart-${key}`;
      const chartItem = document.getElementById(chartId);

      // 화면에 표시되는 차트만 크기 재조정 (모두 표시 중이므로 조건 생략 가능)
      if (chartItem) {
        // Plotly.relayout 함수를 사용하여 차트 크기를 컨테이너에 맞게 강제 재조정
        Plotly.relayout(chartId, {
          autosize: true,
          // height: chartItem.offsetHeight, // 필요하다면 명시적으로 높이를 넘겨줄 수도 있음
        });
      }
    });
  }, 50);
}

// 4. 초기화 및 이벤트 리스너 설정
document.addEventListener("DOMContentLoaded", () => {
  // 1. 초기 차트 생성 및 초기화
  initializeCharts();

  // 2. 초기 Column 개수 설정
  gridContainer.dataset.cols = "1"; // 기본값을 1 Column으로 설정

  // 3. Column 선택 컨테이너에 이벤트 리스너 연결
  const columnSelector = document.getElementById("column-selector");
  if (columnSelector) {
    columnSelector.addEventListener("change", handleColumnChange);
  }

  // 4. 초기 실행 (1 Column)
  const initialEvent = { target: document.querySelector('input[value="1"]') };
  if (initialEvent.target) {
    handleColumnChange(initialEvent);
  }

  // 5. 윈도우 크기 변경 시 차트 크기 재조정 (반응형 대응)
  window.addEventListener("resize", () => {
    chartKeys.forEach((key) => {
      const chartId = `chart-${key}`;
      Plotly.relayout(chartId, { autosize: true });
    });
  });
});
