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

// 3. 레이아웃 변경 핸들러 (함수 중복 정의 제거)
function handleLayoutChange(event) {
  if (!event.target.matches('input[name="chart-layout"]')) return; // 라디오 버튼만 처리

  const layoutValue = event.target.value;

  // 1. 그리드 데이터 속성 업데이트 (CSS Grid가 레이아웃 변경)
  gridContainer.dataset.layout = layoutValue;

  // 2. 차트 표시/숨김 처리 로직 (더 간결하게 정리)
  let displayLimit = chartKeys.length;
  if (layoutValue === "3x3") {
    displayLimit = 9; // 3x3은 9개
  } else if (layoutValue === "1x2") {
    displayLimit = 2; // 1x2는 2개
  }
  // 2x5는 displayLimit = 10 (기본값)

  chartKeys.forEach((key, index) => {
    const chartItem = document.getElementById(`chart-${key}`);
    if (chartItem) {
      // 인덱스가 제한보다 작으면 'block', 아니면 'none'
      chartItem.style.display = index < displayLimit ? "block" : "none";
    }
  });

  // 3. 💡 핵심 수정: 레이아웃 변경 후 모든 차트의 크기를 재조정
  // CSS Grid 크기가 변경되었으므로 Plotly에 다시 그리라고 알림.
  Plotly.Plots.resize(gridContainer);
}

// 4. 초기화 및 이벤트 리스너 설정
document.addEventListener("DOMContentLoaded", () => {
  // 1. 초기 차트 생성 및 초기화
  initializeCharts();

  // 2. 초기 레이아웃 설정 (CSS에 맞게 데이터셋 속성 지정)
  gridContainer.dataset.layout = "3x3";

  // 3. 레이아웃 선택 컨테이너에 이벤트 리스너를 단 하나만 연결합니다.
  const layoutSelector = document.getElementById("layout-selector");
  if (layoutSelector) {
    layoutSelector.addEventListener("change", handleLayoutChange);
  }

  // 4. 초기 상태에서 3x3이므로 10번째 차트를 숨깁니다.
  // 이 로직은 handleLayoutChange 함수가 처리하므로, 아래 코드는 제거하거나 초기 실행을 유도하는 것이 좋습니다.
  // 초기 실행을 위해 DOMContentLoaded가 끝난 후, 3x3을 강제로 한 번 더 실행합니다.
  const initialEvent = { target: document.querySelector('input[value="3x3"]') };
  if (initialEvent.target) {
    handleLayoutChange(initialEvent);
  }

  // 5. 윈도우 크기 변경 시 차트 크기 재조정 (반응형 대응)
  window.addEventListener("resize", () => {
    Plotly.Plots.resize(gridContainer);
  });
});
