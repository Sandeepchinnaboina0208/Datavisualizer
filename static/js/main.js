document.addEventListener('DOMContentLoaded', function() {
    // Initialize file upload handling
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    const dataInfoContainer = document.getElementById('data-info');
    
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!fileInput.files.length) {
                showAlert('Please select a file to upload', 'warning');
                return;
            }
            
            const file = fileInput.files[0];
            const fileExtension = file.name.split('.').pop().toLowerCase();
            
            if (!['csv', 'xlsx', 'xls'].includes(fileExtension)) {
                showAlert('Please upload a CSV or Excel file', 'warning');
                return;
            }
            
            uploadStatus.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div> Uploading...';
            
            const formData = new FormData();
            formData.append('file', file);
            
            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    uploadStatus.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                } else {
                    uploadStatus.innerHTML = `<div class="alert alert-success">File uploaded successfully!</div>`;
                    displayDataInfo(data);
                    showControlButtons();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                uploadStatus.innerHTML = `<div class="alert alert-danger">Upload failed: ${error.message}</div>`;
            });
        });
    }
    
    // Display data preview
    function displayDataInfo(data) {
        if (dataInfoContainer) {
            dataInfoContainer.innerHTML = `
                <div class="card mt-4">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Dataset Information</h5>
                    </div>
                    <div class="card-body">
                        <p><strong>Filename:</strong> ${data.filename}</p>
                        <p><strong>Rows:</strong> ${data.row_count}</p>
                        <p><strong>Columns:</strong> ${data.column_count}</p>
                        <div class="mt-3">
                            <h6>Columns:</h6>
                            <ul class="list-group">
                                ${data.columns.map(col => `<li class="list-group-item">${col}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    // Show control buttons after successful upload
    function showControlButtons() {
        const controlsContainer = document.getElementById('data-controls');
        if (controlsContainer) {
            controlsContainer.innerHTML = `
                <div class="d-flex justify-content-center mt-4">
                    <a href="/visualization" class="btn btn-primary mx-2">
                        <i class="fas fa-chart-bar me-2"></i>Visualize Data
                    </a>
                    <a href="/analysis" class="btn btn-info mx-2">
                        <i class="fas fa-calculator me-2"></i>Analyze Data
                    </a>
                </div>
            `;
        }
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
    
    // Handle the data table display if on the correct page
    const dataTableContainer = document.getElementById('data-table-container');
    if (dataTableContainer) {
        loadDataTable();
    }
    
    function loadDataTable(limit = 10, offset = 0) {
        fetch(`/api/data?limit=${limit}&offset=${offset}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    dataTableContainer.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                    return;
                }
                
                if (!data.data || data.data.length === 0) {
                    dataTableContainer.innerHTML = '<div class="alert alert-info">No data available</div>';
                    return;
                }
                
                // Create table header from first row keys
                const columns = Object.keys(data.data[0]);
                
                let tableHtml = `
                    <div class="table-responsive">
                        <table class="table table-striped table-hover">
                            <thead class="table-dark">
                                <tr>
                                    ${columns.map(col => `<th>${col}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                // Add table rows
                data.data.forEach(row => {
                    tableHtml += '<tr>';
                    columns.forEach(col => {
                        tableHtml += `<td>${row[col] !== null ? row[col] : ''}</td>`;
                    });
                    tableHtml += '</tr>';
                });
                
                tableHtml += `
                            </tbody>
                        </table>
                    </div>
                `;
                
                // Add pagination
                const totalPages = Math.ceil(data.total_rows / limit);
                const currentPage = Math.floor(offset / limit) + 1;
                
                if (totalPages > 1) {
                    tableHtml += `
                        <nav aria-label="Data table pagination">
                            <ul class="pagination justify-content-center">
                                <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                                    <a class="page-link" href="#" data-offset="${Math.max(0, offset - limit)}" aria-label="Previous">
                                        <span aria-hidden="true">&laquo;</span>
                                    </a>
                                </li>
                    `;
                    
                    // Show at most 5 page numbers
                    const startPage = Math.max(1, currentPage - 2);
                    const endPage = Math.min(totalPages, startPage + 4);
                    
                    for (let i = startPage; i <= endPage; i++) {
                        const pageOffset = (i - 1) * limit;
                        tableHtml += `
                            <li class="page-item ${i === currentPage ? 'active' : ''}">
                                <a class="page-link" href="#" data-offset="${pageOffset}">${i}</a>
                            </li>
                        `;
                    }
                    
                    tableHtml += `
                                <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                                    <a class="page-link" href="#" data-offset="${offset + limit}" aria-label="Next">
                                        <span aria-hidden="true">&raquo;</span>
                                    </a>
                                </li>
                            </ul>
                        </nav>
                    `;
                }
                
                dataTableContainer.innerHTML = tableHtml;
                
                // Add pagination event listeners
                document.querySelectorAll('.pagination .page-link').forEach(link => {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        const newOffset = parseInt(this.getAttribute('data-offset'));
                        loadDataTable(limit, newOffset);
                    });
                });
            })
            .catch(error => {
                console.error('Error:', error);
                dataTableContainer.innerHTML = `<div class="alert alert-danger">Failed to load data: ${error.message}</div>`;
            });
    }
    
    // Handle export buttons
    const exportButtons = document.querySelectorAll('.export-btn');
    if (exportButtons.length) {
        exportButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                const format = this.getAttribute('data-format');
                window.location.href = `/export/${format}`;
            });
        });
    }
});
