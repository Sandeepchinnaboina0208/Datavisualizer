import pandas as pd
import numpy as np
from scipy import stats
import logging

class DataProcessor:
    """
    Utility class for processing data uploaded to the application.
    This class provides methods for data analysis and transformations.
    """
    
    @staticmethod
    def get_summary_statistics(df):
        """
        Generate summary statistics for a DataFrame.
        
        Args:
            df (pandas.DataFrame): The DataFrame to analyze
            
        Returns:
            dict: Dictionary containing summary statistics
        """
        try:
            # Select only numeric columns
            numeric_df = df.select_dtypes(include=['number'])
            
            if numeric_df.empty:
                return {
                    'error': 'No numeric columns found in the dataset'
                }
            
            # Generate descriptive statistics
            stats_df = numeric_df.describe()
            
            # Add additional statistics
            stats_df.loc['skew'] = numeric_df.skew()
            stats_df.loc['kurtosis'] = numeric_df.kurtosis()
            stats_df.loc['median'] = numeric_df.median()
            stats_df.loc['missing'] = numeric_df.isnull().sum()
            
            # Convert to dictionary
            result = stats_df.to_dict()
            
            # Add column types
            result['dtypes'] = {col: str(dtype) for col, dtype in df.dtypes.items()}
            
            return result
        except Exception as e:
            logging.error(f"Error generating summary statistics: {str(e)}")
            return {'error': str(e)}
    
    @staticmethod
    def get_correlation_matrix(df):
        """
        Generate correlation matrix for a DataFrame.
        
        Args:
            df (pandas.DataFrame): The DataFrame to analyze
            
        Returns:
            dict: Dictionary containing correlation matrix
        """
        try:
            # Select only numeric columns
            numeric_df = df.select_dtypes(include=['number'])
            
            if numeric_df.empty:
                return {
                    'error': 'No numeric columns found in the dataset'
                }
            
            # Calculate correlation matrix
            corr_matrix = numeric_df.corr().round(3)
            
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
            
            return {
                'columns': columns,
                'correlation_data': corr_data
            }
        except Exception as e:
            logging.error(f"Error generating correlation matrix: {str(e)}")
            return {'error': str(e)}
    
    @staticmethod
    def get_missing_values_info(df):
        """
        Get information about missing values.
        
        Args:
            df (pandas.DataFrame): The DataFrame to analyze
            
        Returns:
            dict: Dictionary containing missing values information
        """
        try:
            # Calculate missing values
            missing = df.isnull().sum()
            missing_percentage = (missing / len(df) * 100).round(2)
            
            result = {
                'columns': df.columns.tolist(),
                'missing_values': missing.to_dict(),
                'missing_percentage': missing_percentage.to_dict()
            }
            
            return result
        except Exception as e:
            logging.error(f"Error analyzing missing values: {str(e)}")
            return {'error': str(e)}
    
    @staticmethod
    def filter_dataframe(df, filters):
        """
        Apply filters to a DataFrame.
        
        Args:
            df (pandas.DataFrame): The DataFrame to filter
            filters (list): List of filter dictionaries with column, operator, and value
            
        Returns:
            pandas.DataFrame: Filtered DataFrame
        """
        try:
            filtered_df = df.copy()
            
            for f in filters:
                column = f.get('column')
                operator = f.get('operator')
                value = f.get('value')
                
                if column and operator and value is not None:
                    if operator == 'equals':
                        filtered_df = filtered_df[filtered_df[column] == value]
                    elif operator == 'greater_than':
                        filtered_df = filtered_df[filtered_df[column] > float(value)]
                    elif operator == 'less_than':
                        filtered_df = filtered_df[filtered_df[column] < float(value)]
                    elif operator == 'contains':
                        filtered_df = filtered_df[filtered_df[column].astype(str).str.contains(str(value))]
            
            return filtered_df
        except Exception as e:
            logging.error(f"Error applying filters: {str(e)}")
            raise
