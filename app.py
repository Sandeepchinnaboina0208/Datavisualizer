import os
import pandas as pd
import numpy as np
import json
import uuid
import logging
from werkzeug.utils import secure_filename
from io import BytesIO
from flask import Flask, render_template, request, jsonify, session, flash, redirect, url_for, send_file

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "datascienceapp-secret-key")

# Configure file upload settings
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}

# Create upload folder if it doesn't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Helper function to check allowed file extensions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Data storage in memory (in a real app, you might use a database)
datasets = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            
            # Generate a unique ID for this dataset
            dataset_id = str(uuid.uuid4())
            
            # Read the file based on its extension
            if filename.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:  # Excel files
                df = pd.read_excel(file_path)
            
            # Store the dataframe in our dictionary
            datasets[dataset_id] = {
                'filename': filename,
                'df': df,
                'columns': df.columns.tolist(),
                'row_count': len(df),
                'column_count': len(df.columns)
            }
            
            # Save dataset_id in session
            session['current_dataset'] = dataset_id
            
            # Return basic info about the dataset
            return jsonify({
                'success': True,
                'dataset_id': dataset_id,
                'filename': filename,
                'columns': df.columns.tolist(),
                'row_count': len(df),
                'column_count': len(df.columns)
            })
            
        except Exception as e:
            logging.error(f"Error processing file: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/visualization')
def visualization():
    dataset_id = session.get('current_dataset')
    if not dataset_id or dataset_id not in datasets:
        flash('Please upload a file first', 'warning')
        return redirect(url_for('index'))
    
    data = datasets[dataset_id]
    return render_template('visualization.html', 
                           filename=data['filename'],
                           columns=data['columns'],
                           row_count=data['row_count'])

@app.route('/analysis')
def analysis():
    dataset_id = session.get('current_dataset')
    if not dataset_id or dataset_id not in datasets:
        flash('Please upload a file first', 'warning')
        return redirect(url_for('index'))
    
    data = datasets[dataset_id]
    return render_template('analysis.html', 
                           filename=data['filename'],
                           columns=data['columns'],
                           row_count=data['row_count'])

@app.route('/api/data', methods=['GET'])
def get_data():
    dataset_id = session.get('current_dataset')
    if not dataset_id or dataset_id not in datasets:
        return jsonify({'error': 'No dataset found'}), 404
    
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    df = datasets[dataset_id]['df']
    subset = df.iloc[offset:offset+limit]
    
    # Convert to JSON with NaN/None handling
    result = subset.where(pd.notnull(subset), None).to_dict(orient='records')
    
    return jsonify({
        'data': result,
        'total_rows': len(df),
        'limit': limit,
        'offset': offset
    })

@app.route('/api/summary', methods=['GET'])
def get_summary():
    dataset_id = session.get('current_dataset')
    if not dataset_id or dataset_id not in datasets:
        return jsonify({'error': 'No dataset found'}), 404
    
    df = datasets[dataset_id]['df']
    
    # Get descriptive statistics
    try:
        numeric_cols = df.select_dtypes(include=['number']).columns
        summary = df[numeric_cols].describe().to_dict()
        
        # Count missing values
        missing_values = df.isnull().sum().to_dict()
        
        # Get data types
        data_types = {col: str(dtype) for col, dtype in df.dtypes.items()}
        
        return jsonify({
            'summary': summary,
            'missing_values': missing_values,
            'data_types': data_types,
            'column_names': df.columns.tolist()
        })
    except Exception as e:
        logging.error(f"Error generating summary: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/correlation', methods=['GET'])
def get_correlation():
    dataset_id = session.get('current_dataset')
    if not dataset_id or dataset_id not in datasets:
        return jsonify({'error': 'No dataset found'}), 404
    
    df = datasets[dataset_id]['df']
    
    try:
        # Get only numeric columns
        numeric_df = df.select_dtypes(include=['number'])
        
        # Calculate correlation matrix
        corr_matrix = numeric_df.corr().fillna(0).round(3)
        
        # Convert to a format suitable for visualization
        columns = corr_matrix.columns.tolist()
        corr_data = []
        
        for i, row in enumerate(columns):
            for j, col in enumerate(columns):
                corr_data.append({
                    'row': row,
                    'column': col,
                    'value': corr_matrix.iloc[i, j]
                })
        
        return jsonify({
            'columns': columns,
            'correlation_data': corr_data
        })
    except Exception as e:
        logging.error(f"Error calculating correlation: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chart-data', methods=['POST'])
def get_chart_data():
    dataset_id = session.get('current_dataset')
    if not dataset_id or dataset_id not in datasets:
        return jsonify({'error': 'No dataset found'}), 404
    
    data = request.json
    chart_type = data.get('chart_type')
    x_column = data.get('x_column')
    y_columns = data.get('y_columns', [])
    filters = data.get('filters', [])
    
    if not chart_type or not x_column:
        return jsonify({'error': 'Missing required parameters'}), 400
    
    df = datasets[dataset_id]['df']
    
    # Apply filters if any
    if filters:
        for f in filters:
            column = f.get('column')
            operator = f.get('operator')
            value = f.get('value')
            
            if column and operator and value is not None:
                try:
                    if operator == 'equals':
                        df = df[df[column] == value]
                    elif operator == 'greater_than':
                        df = df[df[column] > float(value)]
                    elif operator == 'less_than':
                        df = df[df[column] < float(value)]
                    elif operator == 'contains':
                        df = df[df[column].astype(str).str.contains(str(value))]
                except Exception as e:
                    logging.error(f"Error applying filter: {str(e)}")
                    return jsonify({'error': f'Error applying filter: {str(e)}'}), 400
    
    try:
        if chart_type == 'bar' or chart_type == 'line':
            result = {
                'labels': df[x_column].fillna('N/A').tolist(),
                'datasets': []
            }
            
            for y_col in y_columns:
                if y_col in df.columns:
                    result['datasets'].append({
                        'label': y_col,
                        'data': df[y_col].fillna(0).tolist()
                    })
            
            return jsonify(result)
            
        elif chart_type == 'scatter':
            if len(y_columns) >= 1:
                y_column = y_columns[0]
                result = {
                    'datasets': [{
                        'label': f'{x_column} vs {y_column}',
                        'data': [{'x': x, 'y': y} for x, y in zip(df[x_column].fillna(0).tolist(), df[y_column].fillna(0).tolist())]
                    }]
                }
                return jsonify(result)
            else:
                return jsonify({'error': 'Y column required for scatter plot'}), 400
                
        elif chart_type == 'pie':
            # Get value counts for pie chart
            value_counts = df[x_column].value_counts()
            result = {
                'labels': value_counts.index.tolist(),
                'datasets': [{
                    'data': value_counts.values.tolist()
                }]
            }
            return jsonify(result)
            
        else:
            return jsonify({'error': 'Unsupported chart type'}), 400
            
    except Exception as e:
        logging.error(f"Error generating chart data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/export/<format>', methods=['GET'])
def export_data(format):
    dataset_id = session.get('current_dataset')
    if not dataset_id or dataset_id not in datasets:
        flash('No dataset found', 'error')
        return redirect(url_for('index'))
    
    df = datasets[dataset_id]['df']
    filename = datasets[dataset_id]['filename'].rsplit('.', 1)[0]
    
    try:
        if format == 'csv':
            output = BytesIO()
            df.to_csv(output, index=False)
            output.seek(0)
            return send_file(
                output,
                as_attachment=True,
                download_name=f"{filename}_export.csv",
                mimetype='text/csv'
            )
            
        elif format == 'excel':
            output = BytesIO()
            df.to_excel(output, index=False)
            output.seek(0)
            return send_file(
                output,
                as_attachment=True,
                download_name=f"{filename}_export.xlsx",
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            
        elif format == 'json':
            output = BytesIO()
            output.write(df.to_json(orient='records').encode())
            output.seek(0)
            return send_file(
                output,
                as_attachment=True,
                download_name=f"{filename}_export.json",
                mimetype='application/json'
            )
            
        else:
            flash('Unsupported export format', 'error')
            return redirect(url_for('index'))
            
    except Exception as e:
        logging.error(f"Error exporting data: {str(e)}")
        flash(f'Error exporting data: {str(e)}', 'error')
        return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
