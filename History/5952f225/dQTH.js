// 1. 가상 데이터 정의 (10개의 독립적인 데이터 세트)
// 각 키는 차트 하나를 나타냅니다.
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

// 2. 차트 그리기 및 초기화
function initializeCharts() {
  gridContainer.innerHTML = ""; // 기존 차트 제거
  chartKeys.forEach((key, index) => {
    // 차트가 그려질 div 생성
    const chartDiv = document.createElement("div");
    chartDiv.id = `chart-${key}`;
    chartDiv.className = "grid-chart-item";
    gridContainer.appendChild(chartDiv);

    // Plotly 트레이스 및 레이아웃 정의 (간소화된 미니 차트)
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
      xaxis: { visible: false }, // 미니 차트이므로 축 숨김
      yaxis: { title: false, fixedrange: true },
      showlegend: false,
      paper_bgcolor: "#f9f9f9", // 작은 차트 배경에 약간의 색을 주어 구분
      plot_bgcolor: "#f9f9f9",
    };

    // Plotly 차트 생성
    Plotly.newPlot(chartDiv.id, [trace], layout, {
      responsive: true, // 크기 조정에 반응
      displayModeBar: false, // 툴바 숨김
    });
  });
}

// 3. 레이아웃 변경 핸들러
function handleLayoutChange(event) {
  const layoutValue = event.target.value;
  // 선택된 레이아웃 값을 CSS 변수에 전달하여 그리드 템플릿을 변경
  gridContainer.dataset.layout = layoutValue;

  // 차트의 갯수 제한 (예: 3x3은 9개만 표시)
  const limit = layoutValue === "3x3" ? 9 : 10;

  // 차트 표시/숨김 처리
  chartKeys.forEach((key, index) => {
    const chartItem = document.getElementById(`chart-${key}`);
    if (chartItem) {
      chartItem.style.display = index < limit ? "block" : "none";
    }
  });

  // 레이아웃 변경 후 Plotly 차트 크기 재조정 (그리드 크기 변화에 대응)
  Plotly.Plots.resize(gridContainer);
}

// 4. 초기화 및 이벤트 리스너 설정
document.addEventListener("DOMContentLoaded", () => {
  // 1. 초기 차트 생성
  initializeCharts();

  // 2. 초기 레이아웃 설정 (CSS에 맞게 데이터셋 속성 지정)
  gridContainer.dataset.layout = "3x3";

  // 3. 레이아웃 변경 핸들러
  function handleLayoutChange(event) {
    const layoutValue = event.target.value;
    const limit = layoutValue === "3x3" ? 9 : 10;

    // 1. 그리드 데이터 속성 업데이트 (CSS Grid가 레이아웃 변경)
    gridContainer.dataset.layout = layoutValue;

    // 2. 차트 표시/숨김 처리
    chartKeys.forEach((key, index) => {
      const chartItem = document.getElementById(`chart-${key}`);
      if (chartItem) {
        chartItem.style.display = index < limit ? "block" : "none";
      }
    });

    // 3. 💡 핵심 수정: 레이아웃 변경 후 모든 차트의 크기를 재조정
    // CSS Grid의 크기(특히 높이)가 변경되었기 때문에 Plotly에 다시 그리라고 알려줍니다.
    // Plotly.Plots.resize()를 사용하면 모든 차트의 크기를 컨테이너에 맞게 조정합니다.
    Plotly.Plots.resize(gridContainer);

    // 1x2 레이아웃의 경우, 10번째 차트도 숨겨야 합니다.
    const chart10 = document.getElementById("chart-Chart10");
    if (chart10) {
      chart10.style.display =
        layoutValue === "1x2" && chartKeys.length > 2
          ? "none"
          : layoutValue === "3x3"
          ? "none"
          : "block";

      // 1x2는 첫 2개만 보여주도록 로직을 더 명확히 합니다.
      chartKeys.forEach((key, index) => {
        const chartItem = document.getElementById(`chart-${key}`);
        if (chartItem) {
          chartItem.style.display =
            layoutValue === "1x2" && index >= 2
              ? "none"
              : layoutValue === "3x3" && index >= 9
              ? "none"
              : "block";
        }
      });
    }
  }
  // 4. 3x3 선택 시 10번째 차트 숨김
  document.getElementById("chart-Chart10").style.display = "none";

  // 5. 윈도우 크기 변경 시 차트 크기 재조정 (반응형 대응)
  window.addEventListener("resize", () => {
    Plotly.Plots.resize(gridContainer);
  });
});
