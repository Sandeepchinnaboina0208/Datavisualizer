document.addEventListener('DOMContentLoaded', function() {
    // Load summary statistics
    loadSummaryStatistics();
    
    // Load correlation matrix
    loadCorrelationMatrix();
    
    // Set up event listeners for the tabs
    const tabs = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(event) {
            const targetTab = event.target.getAttribute('aria-controls');
            
            if (targetTab === 'correlation-tab-pane' && !document.getElementById('correlation-heatmap')) {
                loadCorrelationMatrix();
            }
        });
    });
    
    // Load summary statistics
    function loadSummaryStatistics() {
        const summaryContainer = document.getElementById('summary-stats-container');
        
        if (!summaryContainer) return;
        
        summaryContainer.innerHTML = '<div class="d-flex justify-content-center my-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        
        fetch('/api/summary')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    summaryContainer.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                    return;
                }
                
                displaySummaryStatistics(data);
                displayMissingValues(data);
                displayDataTypes(data);
            })
            .catch(error => {
                console.error('Error:', error);
                summaryContainer.innerHTML = `<div class="alert alert-danger">Failed to load summary statistics: ${error.message}</div>`;
            });
    }
    
    // Display summary statistics
    function displaySummaryStatistics(data) {
        const summaryContainer = document.getElementById('summary-stats-container');
        
        if (!data.summary || Object.keys(data.summary).length === 0) {
            summaryContainer.innerHTML = '<div class="alert alert-info">No numeric columns available for statistics</div>';
            return;
        }
        
        let tableHtml = `
            <div class="table-responsive">
                <table class="table table-striped table-bordered">
                    <thead class="table-dark">
                        <tr>
                            <th>Statistic</th>
                            ${Object.keys(data.summary).map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Get all unique statistics (count, mean, std, min, etc.)
        const allStats = new Set();
        Object.values(data.summary).forEach(colStats => {
            Object.keys(colStats).forEach(stat => allStats.add(stat));
        });
        
        // Create rows for each statistic
        Array.from(allStats).sort().forEach(stat => {
            tableHtml += `<tr><td class="fw-bold">${stat}</td>`;
            
            Object.keys(data.summary).forEach(col => {
                const value = data.summary[col][stat];
                tableHtml += `<td>${value !== undefined ? Number(value).toFixed(4) : 'N/A'}</td>`;
            });
            
            tableHtml += `</tr>`;
        });
        
        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;
        
        summaryContainer.innerHTML = tableHtml;
    }
    
    // Display missing values
    function displayMissingValues(data) {
        const missingValuesContainer = document.getElementById('missing-values-container');
        
        if (!missingValuesContainer) return;
        
        if (!data.missing_values || Object.keys(data.missing_values).length === 0) {
            missingValuesContainer.innerHTML = '<div class="alert alert-info">No missing values found</div>';
            return;
        }
        
        let html = `
            <div class="row">
                <div class="col-md-6">
                    <div class="table-responsive">
                        <table class="table table-striped table-bordered">
                            <thead class="table-dark">
                                <tr>
                                    <th>Column</th>
                                    <th>Missing Values</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        Object.entries(data.missing_values).forEach(([col, count]) => {
            html += `<tr><td>${col}</td><td>${count}</td></tr>`;
        });
        
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="col-md-6">
                    <canvas id="missing-values-chart"></canvas>
                </div>
            </div>
        `;
        
        missingValuesContainer.innerHTML = html;
        
        // Create missing values chart
        const ctx = document.getElementById('missing-values-chart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(data.missing_values),
                datasets: [{
                    label: 'Missing Values',
                    data: Object.values(data.missing_values),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Column'
                        }
                    }
                }
            }
        });
    }
    
    // Display data types
    function displayDataTypes(data) {
        const dataTypesContainer = document.getElementById('data-types-container');
        
        if (!dataTypesContainer) return;
        
        if (!data.data_types || Object.keys(data.data_types).length === 0) {
            dataTypesContainer.innerHTML = '<div class="alert alert-info">No data types information available</div>';
            return;
        }
        
        let tableHtml = `
            <div class="table-responsive">
                <table class="table table-striped table-bordered">
                    <thead class="table-dark">
                        <tr>
                            <th>Column</th>
                            <th>Data Type</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        Object.entries(data.data_types).forEach(([col, type]) => {
            tableHtml += `<tr><td>${col}</td><td>${type}</td></tr>`;
        });
        
        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;
        
        dataTypesContainer.innerHTML = tableHtml;
    }
    
    // Load correlation matrix
    function loadCorrelationMatrix() {
        const correlationContainer = document.getElementById('correlation-container');
        
        if (!correlationContainer) return;
        
        correlationContainer.innerHTML = '<div class="d-flex justify-content-center my-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        
        fetch('/api/correlation')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    correlationContainer.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                    return;
                }
                
                if (!data.columns || data.columns.length === 0) {
                    correlationContainer.innerHTML = '<div class="alert alert-info">No numeric columns available for correlation analysis</div>';
                    return;
                }
                
                // Create container for heatmap and table
                correlationContainer.innerHTML = `
                    <div class="row">
                        <div class="col-md-7">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Correlation Heatmap</h5>
                                    <div id="correlation-heatmap" style="height: 500px;"></div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-5">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Correlation Table</h5>
                                    <div id="correlation-table"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                createCorrelationHeatmap(data);
                createCorrelationTable(data);
            })
            .catch(error => {
                console.error('Error:', error);
                correlationContainer.innerHTML = `<div class="alert alert-danger">Failed to load correlation data: ${error.message}</div>`;
            });
    }
    
    // Create correlation heatmap
    function createCorrelationHeatmap(data) {
        const heatmapContainer = document.getElementById('correlation-heatmap');
        
        // Prepare data for heatmap
        const xValues = data.columns;
        const yValues = data.columns;
        const zValues = [];
        
        // Initialize 2D array for z values
        for (let i = 0; i < yValues.length; i++) {
            zValues.push(Array(xValues.length).fill(0));
        }
        
        // Fill in the correlation values
        data.correlation_data.forEach(item => {
            const rowIndex = yValues.indexOf(item.row);
            const colIndex = xValues.indexOf(item.column);
            if (rowIndex !== -1 && colIndex !== -1) {
                zValues[rowIndex][colIndex] = item.value;
            }
        });
        
        // Create heatmap
        const heatmapData = [{
            type: 'heatmap',
            x: xValues,
            y: yValues,
            z: zValues,
            colorscale: [
                [0, 'rgb(0, 0, 255)'],      // Strong negative correlation: blue
                [0.25, 'rgb(127, 127, 255)'], // Weak negative correlation: light blue
                [0.5, 'rgb(255, 255, 255)'], // No correlation: white
                [0.75, 'rgb(255, 127, 127)'], // Weak positive correlation: light red
                [1, 'rgb(255, 0, 0)']       // Strong positive correlation: red
            ],
            zmin: -1,
            zmax: 1,
            hoverinfo: 'text',
            text: zValues.map((row, i) => row.map((value, j) => `${yValues[i]} vs ${xValues[j]}: ${value.toFixed(3)}`)),
            showscale: true
        }];
        
        const layout = {
            margin: {
                l: 100,
                r: 50,
                b: 100,
                t: 50,
                pad: 4
            },
            title: 'Correlation Matrix',
            xaxis: {
                title: 'Columns',
                ticks: ''
            },
            yaxis: {
                title: 'Columns',
                ticks: '',
                autorange: 'reversed'
            },
            annotations: []
        };
        
        // Add correlation values as annotations
        for (let i = 0; i < yValues.length; i++) {
            for (let j = 0; j < xValues.length; j++) {
                const value = zValues[i][j];
                
                // Text color based on background color for better visibility
                const textColor = Math.abs(value) > 0.5 ? 'white' : 'black';
                
                layout.annotations.push({
                    x: xValues[j],
                    y: yValues[i],
                    text: value.toFixed(2),
                    font: {
                        color: textColor
                    },
                    showarrow: false
                });
            }
        }
        
        Plotly.newPlot(heatmapContainer, heatmapData, layout, {responsive: true});
    }
    
    // Create correlation table
    function createCorrelationTable(data) {
        const tableContainer = document.getElementById('correlation-table');
        
        let tableHtml = `
            <div class="table-responsive">
                <table class="table table-bordered table-striped correlation-table">
                    <thead class="table-dark">
                        <tr>
                            <th></th>
                            ${data.columns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Create rows for each column
        data.columns.forEach(rowCol => {
            tableHtml += `<tr><td class="fw-bold">${rowCol}</td>`;
            
            data.columns.forEach(colCol => {
                const correlationItem = data.correlation_data.find(
                    item => item.row === rowCol && item.column === colCol
                );
                
                const value = correlationItem ? correlationItem.value : 0;
                
                // Add styling based on correlation strength
                let cellClass = '';
                if (value > 0.7) cellClass = 'bg-danger text-white';
                else if (value > 0.4) cellClass = 'bg-warning';
                else if (value < -0.7) cellClass = 'bg-primary text-white';
                else if (value < -0.4) cellClass = 'bg-info';
                
                tableHtml += `<td class="${cellClass}">${value.toFixed(3)}</td>`;
            });
            
            tableHtml += `</tr>`;
        });
        
        tableHtml += `
                    </tbody>
                </table>
            </div>
            <div class="mt-3">
                <div class="d-flex align-items-center mb-1">
                    <div class="bg-danger text-white px-2 me-2" style="width:30px;">&gt;0.7</div>
                    <span>Strong positive correlation</span>
                </div>
                <div class="d-flex align-items-center mb-1">
                    <div class="bg-warning px-2 me-2" style="width:30px;">&gt;0.4</div>
                    <span>Moderate positive correlation</span>
                </div>
                <div class="d-flex align-items-center mb-1">
                    <div class="bg-primary text-white px-2 me-2" style="width:30px;">&lt;-0.7</div>
                    <span>Strong negative correlation</span>
                </div>
                <div class="d-flex align-items-center">
                    <div class="bg-info px-2 me-2" style="width:30px;">&lt;-0.4</div>
                    <span>Moderate negative correlation</span>
                </div>
            </div>
        `;
        
        tableContainer.innerHTML = tableHtml;
    }
});
