// 1. 전역 변수 정의
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
// DOMContentLoaded에서 초기화될 전역 변수
let gridContainer = null;

// 2. 차트 그리기 및 초기화
function initializeCharts() {
  if (!gridContainer) {
    console.error(
      "차트 그리드 컨테이너(chart-flex-container)를 찾을 수 없습니다."
    );
    return;
  }

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

// 3. Column 개수 변경 핸들러
function handleColumnChange(event) {
  // 상세 보기 모드일 경우 Column 변경 기능을 무시합니다.
  if (gridContainer.classList.contains("detail-view")) return;

  // 이벤트 객체가 아닌 경우 (resetDetailView에서 호출될 때) 타겟을 currentCols 라디오 버튼으로 간주
  let target = event.target;
  if (!target.matches('input[name="chart-cols"]')) {
    target =
      document.querySelector('input[name="chart-cols"]:checked') ||
      document.querySelector('input[value="1"]');
  }
  if (!target) return;

  const colCount = parseInt(target.value);

  // 1. 그리드 데이터 속성 업데이트 (CSS가 Flex 아이템 너비 조정)
  gridContainer.dataset.cols = colCount;

  // 2. 모든 차트를 'block'으로 표시하고 CSS가 플렉스 배치를 담당하도록 합니다.
  chartKeys.forEach((key) => {
    const chartItem = document.getElementById(`chart-${key}`);
    if (chartItem) {
      chartItem.style.display = "block";
    }
  });

  // 3. 핵심: 개별 차트 크기 재조정
  setTimeout(() => {
    chartKeys.forEach((key) => {
      const chartId = `chart-${key}`;
      Plotly.relayout(chartId, { autosize: true });
    });
  }, 50);
}

// 4. 리스트 항목에 이벤트 리스너 설정 및 항목 생성
function setupChartListListeners() {
  // HTML에서 ul 태그에 이 ID를 할당해야 합니다. 예: <ul id="chart-list-ul">
  const listSection = document.getElementById("chart-list-ul");

  if (!listSection) {
    console.error("차트 리스트 섹션(chart-list-ul)을 찾을 수 없습니다.");
    return;
  }

  // 1. 리스트 항목 생성
  listSection.innerHTML = "";
  chartKeys.forEach((key) => {
    const listItem = document.createElement("li");
    listItem.textContent = key;
    listItem.setAttribute("data-chart-key", key);

    // 2. 이벤트 리스너 연결
    listItem.addEventListener("click", handleChartSelection);

    listSection.appendChild(listItem);
  });
}

// 5. 차트 선택 핸들러 (상세 보기 모드 활성화)
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

        // 크기 재조정 (즉시 실행)
        Plotly.relayout(chartId, { autosize: true });
      } else {
        // 나머지 차트는 숨김
        chartItem.style.display = "none";
      }
    }
  });

  // D. Column 선택 라디오 버튼 비활성화 (시각적 피드백)
  document.querySelectorAll('input[name="chart-cols"]').forEach((radio) => {
    radio.disabled = true;
  });
}

// 6. 상세 보기 모드 해제 (모든 차트 보기로 돌아가기)
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

  // 현재 선택된 라디오 버튼을 찾아서 handleColumnChange 호출
  const currentRadio = document.querySelector(`input[value="${currentCols}"]`);
  if (currentRadio) {
    // Column 변경 핸들러를 재사용하여 레이아웃 복구
    handleColumnChange({ target: currentRadio });
  }
}

// 7. 사이드바 토글 기능 (기존 코드)
function setupSidebarToggle() {
  // ...
  toggleBtn.addEventListener("click", () => {
    // ... 클래스 토글

    // 💡 크기 재조정 (CSS transition이 끝난 후 실행)
    setTimeout(() => {
      chartKeys.forEach((key) => {
        const chartId = `chart-${key}`;
        Plotly.relayout(chartId, { autosize: true });
      });
    }, 350); // 트랜지션 시간(0.3s)보다 길게 설정
  });
}

// 8. 초기화 및 이벤트 리스너 설정 (DOM 로드가 완료된 후 실행)
document.addEventListener("DOMContentLoaded", () => {
  // 전역 변수 초기화
  // HTML에서 <div id="chart-flex-container">와 같은 ID가 사용된다고 가정합니다.
  gridContainer = document.getElementById("chart-flex-container");
  if (!gridContainer) {
    console.error(
      "차트 컨테이너 ID를 확인해 주세요. (#chart-flex-container가 필요합니다.)"
    );
    return;
  }

  // 1. 초기 차트 생성 및 초기화
  initializeCharts();

  // 2. 리스트 항목 생성 및 이벤트 리스너 설정
  setupChartListListeners();

  // 3. Column 선택 컨테이너에 이벤트 리스너 연결
  const columnSelector = document.querySelector(".layout-selector-group"); // 라디오 버튼 그룹 컨테이너
  if (columnSelector) {
    columnSelector.addEventListener("change", handleColumnChange);
  }

  // 4. 초기 Column 설정 및 실행
  gridContainer.dataset.cols = "1"; // 기본값을 1 Column으로 설정
  document.querySelector('input[value="1"]').checked = true;
  handleColumnChange({ target: document.querySelector('input[value="1"]') });

  // 5. 윈도우 크기 변경 시 차트 크기 재조정 (반응형 대응)
  window.addEventListener("resize", () => {
    chartKeys.forEach((key) => {
      const chartId = `chart-${key}`;
      Plotly.relayout(chartId, { autosize: true });
    });
  });

  // 6. 사이드바 토글 기능 설정
  setupSidebarToggle();

  // 7. 리스트 외 영역을 클릭했을 때 상세 보기 모드 해제 기능
  const mainContent = document.querySelector(".main-content");
  if (mainContent) {
    mainContent.addEventListener("click", (e) => {
      // 차트 아이템이나 Column 선택 영역이 아닌 빈 공간을 클릭했을 때
      if (
        gridContainer.classList.contains("detail-view") &&
        !e.target.closest(".grid-chart-item") &&
        !e.target.closest(".customization-panel") &&
        !e.target.closest("#sidebar-toggle-btn") // 사이드바 버튼 클릭 시 오동작 방지
      ) {
        resetDetailView();
      }
    });
  }
});
