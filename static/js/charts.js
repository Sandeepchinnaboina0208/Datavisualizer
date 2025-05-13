document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const chartContainer = document.getElementById('chart-container');
    const chartTypeSelect = document.getElementById('chart-type');
    const xColumnSelect = document.getElementById('x-column');
    const yColumnsSelect = document.getElementById('y-columns');
    const generateChartBtn = document.getElementById('generate-chart');
    const filtersContainer = document.getElementById('filters-container');
    const addFilterBtn = document.getElementById('add-filter');
    
    let currentChart = null;
    let availableColumns = [];
    
    // Initialize column selectors
    fetch('/api/summary')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showAlert(data.error, 'danger');
                return;
            }
            
            availableColumns = data.column_names;
            
            // Populate column selects
            populateColumnSelect(xColumnSelect, availableColumns);
            populateMultiColumnSelect(yColumnsSelect, availableColumns);
            
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Failed to load column data', 'danger');
        });
    
    // Add filter button event
    if (addFilterBtn) {
        addFilterBtn.addEventListener('click', function() {
            addFilterRow();
        });
    }
    
    // Generate chart button event
    if (generateChartBtn) {
        generateChartBtn.addEventListener('click', function() {
            generateChart();
        });
    }
    
    // Chart type change event
    if (chartTypeSelect) {
        chartTypeSelect.addEventListener('change', function() {
            updateYColumnVisibility();
        });
    }
    
    function updateYColumnVisibility() {
        const chartType = chartTypeSelect.value;
        const yColumnsGroup = document.getElementById('y-columns-group');
        
        if (chartType === 'pie') {
            yColumnsGroup.style.display = 'none';
        } else {
            yColumnsGroup.style.display = 'block';
            
            // For scatter plot, allow only one Y column
            if (chartType === 'scatter') {
                yColumnsSelect.setAttribute('multiple', false);
                yColumnsSelect.size = 1;
                // If multiple values are selected, keep only the first one
                if (yColumnsSelect.selectedOptions.length > 1) {
                    const firstSelected = yColumnsSelect.selectedOptions[0].value;
                    yColumnsSelect.value = firstSelected;
                }
            } else {
                yColumnsSelect.setAttribute('multiple', true);
                yColumnsSelect.size = Math.min(5, availableColumns.length);
            }
        }
    }
    
    function populateColumnSelect(selectElement, columns) {
        selectElement.innerHTML = '';
        columns.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            selectElement.appendChild(option);
        });
    }
    
    function populateMultiColumnSelect(selectElement, columns) {
        selectElement.innerHTML = '';
        selectElement.setAttribute('multiple', true);
        selectElement.size = Math.min(5, columns.length);
        
        columns.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            selectElement.appendChild(option);
        });
    }
    
    function addFilterRow() {
        const filterRow = document.createElement('div');
        filterRow.className = 'filter-row mb-3 row';
        
        filterRow.innerHTML = `
            <div class="col-md-4">
                <select class="form-select filter-column" required>
                    <option value="">Select Column</option>
                    ${availableColumns.map(col => `<option value="${col}">${col}</option>`).join('')}
                </select>
            </div>
            <div class="col-md-3">
                <select class="form-select filter-operator" required>
                    <option value="equals">Equals</option>
                    <option value="greater_than">Greater Than</option>
                    <option value="less_than">Less Than</option>
                    <option value="contains">Contains</option>
                </select>
            </div>
            <div class="col-md-4">
                <input type="text" class="form-control filter-value" placeholder="Value" required>
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-danger remove-filter">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        filtersContainer.appendChild(filterRow);
        
        // Add remove filter event
        filterRow.querySelector('.remove-filter').addEventListener('click', function() {
            filterRow.remove();
        });
    }
    
    function getFilters() {
        const filters = [];
        const filterRows = document.querySelectorAll('.filter-row');
        
        filterRows.forEach(row => {
            const column = row.querySelector('.filter-column').value;
            const operator = row.querySelector('.filter-operator').value;
            const value = row.querySelector('.filter-value').value;
            
            if (column && operator && value) {
                filters.push({
                    column: column,
                    operator: operator,
                    value: value
                });
            }
        });
        
        return filters;
    }
    
    function generateChart() {
        const chartType = chartTypeSelect.value;
        const xColumn = xColumnSelect.value;
        const yColumns = Array.from(yColumnsSelect.selectedOptions).map(opt => opt.value);
        const filters = getFilters();
        
        if (!chartType || !xColumn) {
            showAlert('Please select chart type and X-axis column', 'warning');
            return;
        }
        
        if (chartType !== 'pie' && yColumns.length === 0) {
            showAlert('Please select at least one Y-axis column', 'warning');
            return;
        }
        
        // Show loading indicator
        chartContainer.innerHTML = '<div class="d-flex justify-content-center my-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        
        fetch('/api/chart-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chart_type: chartType,
                x_column: xColumn,
                y_columns: yColumns,
                filters: filters
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showAlert(data.error, 'danger');
                chartContainer.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                return;
            }
            
            createChart(chartType, data);
        })
        .catch(error => {
            console.error('Error:', error);
            chartContainer.innerHTML = `<div class="alert alert-danger">Failed to generate chart: ${error.message}</div>`;
        });
    }
    
    function createChart(chartType, data) {
        // Clear previous chart
        if (currentChart) {
            currentChart.destroy();
        }
        
        // Create canvas for chart
        chartContainer.innerHTML = '<canvas id="chart-canvas"></canvas>';
        const ctx = document.getElementById('chart-canvas').getContext('2d');
        
        // Generate random colors for datasets
        const generateColors = (count) => {
            const colors = [];
            for (let i = 0; i < count; i++) {
                const hue = (i * 137) % 360; // Use golden angle to get well-distributed colors
                colors.push(`hsl(${hue}, 70%, 60%)`);
            }
            return colors;
        };
        
        let chartConfig = {
            type: chartType,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                }
            }
        };
        
        // Configure chart based on type
        if (chartType === 'pie') {
            const backgroundColors = generateColors(data.labels.length);
            
            chartConfig.data = {
                labels: data.labels,
                datasets: [{
                    data: data.datasets[0].data,
                    backgroundColor: backgroundColors,
                    hoverOffset: 4
                }]
            };
            
        } else if (chartType === 'scatter') {
            const colors = generateColors(1);
            
            chartConfig.data = {
                datasets: [{
                    label: data.datasets[0].label,
                    data: data.datasets[0].data,
                    backgroundColor: colors[0],
                    borderColor: colors[0],
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            };
            
            chartConfig.options.scales = {
                x: {
                    title: {
                        display: true,
                        text: xColumnSelect.value
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: yColumnsSelect.value
                    }
                }
            };
            
        } else { // bar or line
            const colors = generateColors(data.datasets.length);
            
            chartConfig.data = {
                labels: data.labels,
                datasets: data.datasets.map((dataset, index) => ({
                    label: dataset.label,
                    data: dataset.data,
                    backgroundColor: chartType === 'bar' ? colors[index] : 'rgba(0,0,0,0)',
                    borderColor: colors[index],
                    borderWidth: 2,
                    tension: chartType === 'line' ? 0.1 : 0
                }))
            };
            
            chartConfig.options.scales = {
                x: {
                    title: {
                        display: true,
                        text: xColumnSelect.value
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Value'
                    }
                }
            };
        }
        
        // Create chart
        currentChart = new Chart(ctx, chartConfig);
        
        // Scroll to chart
        chartContainer.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Utility function to show alerts
    function showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alert-container') || document.createElement('div');
        alertContainer.id = 'alert-container';
        alertContainer.className = 'position-fixed top-0 start-50 translate-middle-x mt-3 z-index-1050';
        document.body.appendChild(alertContainer);
        
        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type} alert-dismissible fade show`;
        alertEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        alertContainer.appendChild(alertEl);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            alertEl.classList.remove('show');
            setTimeout(() => alertEl.remove(), 150);
        }, 5000);
    }
});
