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

// ... (기존 코드 유지: chartDataSets, labels, chartKeys, gridContainer 등) ...

// 💡 5. 사이드바 토글 기능 추가
function setupSidebarToggle() {
  const sidebar = document.getElementById("left-sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");

  if (!sidebar || !toggleBtn) return; // 요소가 없으면 종료

  toggleBtn.addEventListener("click", () => {
    // 1. 사이드바와 버튼에 'collapsed' 클래스를 토글
    const isCollapsed = sidebar.classList.toggle("collapsed");
    toggleBtn.classList.toggle("collapsed");

    // 2. 버튼 텍스트 변경 (접힘/펼침 상태 표시)
    toggleBtn.innerHTML = isCollapsed ? "&gt;" : "&lt;";

    // 3. 💡 차트 크기 재조정 (가장 중요!)
    // 사이드바가 접히거나 펼쳐지면 main-content의 너비가 변합니다.
    // Plotly 차트가 이 변화를 반영하도록 크기를 재조정해야 합니다.
    setTimeout(() => {
      chartKeys.forEach((key) => {
        const chartId = `chart-${key}`;
        // Plotly.relayout을 사용하여 크기 재조정
        Plotly.relayout(chartId, { autosize: true });
      });
    }, 350); // CSS transition 시간(0.3s)보다 조금 더 길게 설정
  });
}

// 4. 초기화 및 이벤트 리스너 설정 (DOMContentLoaded 내부)
document.addEventListener("DOMContentLoaded", () => {
  // 1. 초기 차트 생성 및 초기화
  // ... (기존 코드 유지) ...

  // 2. 초기 Column 개수 설정
  // ... (기존 코드 유지) ...

  // 3. Column 선택 컨테이너에 이벤트 리스너 연결
  // ... (기존 코드 유지) ...

  // 4. 초기 실행 (1 Column)
  // ... (기존 코드 유지) ...

  // 5. 윈도우 크기 변경 시 차트 크기 재조정
  // ... (기존 코드 유지) ...

  // 6. 💡 사이드바 토글 기능 설정
  setupSidebarToggle();
});

// ... (기존 코드 유지) ...

// 💡 새로운 함수: 리스트 항목에 이벤트 리스너 설정
function setupChartListListeners() {
  const listSection = document.getElementById("chart-list-ul"); // HTML에 이 ID가 있다고 가정

  if (!listSection) {
    console.error("차트 리스트 섹션(chart-list-ul)을 찾을 수 없습니다.");
    return;
  }

  // 1. 리스트 항목 생성 (HTML이 아닌 JS로 리스트를 생성한다고 가정)
  listSection.innerHTML = "";
  chartKeys.forEach((key, index) => {
    const listItem = document.createElement("li");
    listItem.textContent = key;
    listItem.setAttribute("data-chart-key", key);

    // 2. 이벤트 리스너 연결
    listItem.addEventListener("click", handleChartSelection);

    listSection.appendChild(listItem);
  });
}

// 💡 3. 차트 선택 핸들러
function handleChartSelection(event) {
  const selectedKey = event.target.getAttribute("data-chart-key");

  // A. 리스트 활성화 상태 토글
  document.querySelectorAll("#chart-list-ul li").forEach((li) => {
    li.classList.remove("active");
  });
  event.target.classList.add("active");

  // B. 그리드 컨테이너 상태 변경 (상세 보기 모드 활성화)
  gridContainer.classList.add("detail-view");

  // C. 차트 표시/숨김 및 크기 재조정
  chartKeys.forEach((key) => {
    const chartId = `chart-${key}`;
    const chartItem = document.getElementById(chartId);

    if (chartItem) {
      if (key === selectedKey) {
        // 선택된 차트만 표시
        chartItem.style.display = "block";

        // 💡 크기 재조정 (DOM 업데이트를 기다릴 필요 없이 즉시 실행 가능)
        Plotly.relayout(chartId, { autosize: true });
      } else {
        // 나머지 차트는 숨김
        chartItem.style.display = "none";
      }
    }
  });

  // D. Column 선택 라디오 버튼 비활성화 (선택 사항)
  document.querySelectorAll('input[name="chart-cols"]').forEach((radio) => {
    radio.disabled = true;
  });
}

// 💡 4. 상세 보기 모드 해제 (모든 차트 보기로 돌아가기)
function resetDetailView() {
  // A. 리스트 활성화 상태 해제
  document.querySelectorAll("#chart-list-ul li").forEach((li) => {
    li.classList.remove("active");
  });

  // B. 상세 보기 모드 비활성화
  gridContainer.classList.remove("detail-view");

  // C. Column 선택 라디오 버튼 재활성화
  document.querySelectorAll('input[name="chart-cols"]').forEach((radio) => {
    radio.disabled = false;
  });

  // D. 마지막으로 선택된 Column 레이아웃으로 복귀 및 차트 크기 재조정
  const currentCols = gridContainer.dataset.cols || "1";
  const initialEvent = {
    target: document.querySelector(`input[value="${currentCols}"]`),
  };
  if (initialEvent.target) {
    handleColumnChange(initialEvent); // Column 변경 핸들러를 재사용하여 레이아웃 복구
  }
}
