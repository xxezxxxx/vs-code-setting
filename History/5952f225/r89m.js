// 1. 가상 데이터 정의 (10개 이상의 데이터 열)
const mockData = {
    // X축 데이터 (시간, ID 등)
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
    // Y축 데이터 (사용자가 선택할 수 있는 10가지 열)
    ColA: [10, 15, 7, 20, 25, 18, 22, 30, 28, 35],
    ColB: [5, 12, 18, 10, 15, 25, 15, 10, 5, 2],
    ColC: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    ColD: [30, 25, 20, 15, 10, 5, 10, 15, 20, 25],
    ColE: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512],
    ColF: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55], // 피보나치 예시
    ColG: [50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
    ColH: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10],
    ColI: [12, 14, 16, 18, 20, 18, 16, 14, 12, 10],
    ColJ: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29]
};

// 기본적으로 표시할 열
let selectedColumns = ['ColA', 'ColB', 'ColC'];

// 2. 커스터마이징 UI 생성
function createColumnSelector() {
    const selectorDiv = document.getElementById('column-selector');
    const allColumns = Object.keys(mockData).filter(key => key !== 'labels');
    
    allColumns.forEach(colKey => {
        // 열쇠 이름 (ColA, ColB 등)을 읽기 쉬운 이름으로 변환
        const displayLabel = colKey.replace('Col', 'Column ');
        
        const isChecked = selectedColumns.includes(colKey) ? 'checked' : '';
        
        const html = `
            <label class="column-label">
                <input type="checkbox" data-col="${colKey}" ${isChecked}>
                ${displayLabel}
            </label>
        `;
        selectorDiv.insertAdjacentHTML('beforeend', html);
    });

    // 체크박스 이벤트 리스너 추가
    selectorDiv.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            const col = event.target.dataset.col;
            if (event.target.checked) {
                // 선택된 열 추가
                selectedColumns.push(col);
            } else {
                // 선택된 열 제거
                selectedColumns = selectedColumns.filter(c => c !== col);
            }
            // 차트 업데이트 함수 호출
            updateChart();
        }
    });
}

// 3. 차트 데이터 준비 및 그리기/업데이트
function updateChart() {
    const traces = selectedColumns.map(colKey => {
        // Plotly 트레이스 객체 생성
        return {
            x: mockData.labels,
            y: mockData[colKey],
            mode: 'lines+markers', // 선과 마커
            name: colKey.replace('Col', 'Column '), // 범례 이름
            line: {
                width: 2.5
            },
            marker: {
                size: 6
            }
        };
    });

    const layout = {
        title: '동적 데이터 비교 차트 (Plotly)',
        xaxis: {
            title: '시간/항목',
            showgrid: true,
            zeroline: false
        },
        yaxis: {
            title: '값',
            showgrid: true,
            zeroline: false
        },
        // Apple 스타일 레이아웃 조정
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#ffffff',
        font: {
            family: '-apple-system, sans-serif',
            color: '#1d1d1f'
        },
        hovermode: 'closest',
        margin: { t: 50, b: 30, l: 40, r: 20 }, // 여백 조정
        // 범례 스타일 조정
        legend: {
            orientation: 'h', // 수평 범례
            yanchor: 'bottom',
            y: 1.02,
            xanchor: 'right',
            x: 1
        }
    };
    
    // Plotly.react는 차트가 이미 그려져 있다면 업데이트하고, 없다면 새로 그립니다.
    Plotly.react('plotly-chart', traces, layout);
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    createColumnSelector(); // UI 생성
    updateChart(); // 초기 차트 그리기
});