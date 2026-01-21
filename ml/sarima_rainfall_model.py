"""
SARIMA Rainfall Forecasting Model for Kerala, India
=====================================================
This module implements a real SARIMA (Seasonal AutoRegressive Integrated Moving Average)
model for rainfall prediction in Kerala's rubber plantation regions.

Model: SARIMA(p, d, q)(P, D, Q, s)
- p, d, q: Non-seasonal AR, differencing, and MA orders
- P, D, Q: Seasonal AR, differencing, and MA orders
- s: Seasonal period (12 for monthly data)

Author: RubberEco ML Team
"""

import os
import json
import warnings
from datetime import datetime
from pathlib import Path

import pandas as pd
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller, acf, pacf
from sklearn.metrics import mean_squared_error, mean_absolute_error
import joblib

# Suppress convergence warnings during model fitting
warnings.filterwarnings('ignore')

# Project paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR
MODEL_DIR = BASE_DIR / 'ml' / 'trained_models'
OUTPUT_DIR = BASE_DIR / 'ml' / 'forecasts'

# Ensure directories exist
MODEL_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# Kerala's 14 districts
KERALA_DISTRICTS = [
    "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha",
    "Kottayam", "Idukki", "Ernakulam", "Thrissur", "Palakkad",
    "Malappuram", "Kozhikode", "Wayanad", "Kannur", "Kasaragod"
]

# Rubber belt districts (significant rubber cultivation)
RUBBER_BELT_DISTRICTS = [
    "Kottayam", "Idukki", "Ernakulam", "Thrissur", "Palakkad",
    "Kozhikode", "Kannur", "Kasaragod", "Pathanamthitta", "Kollam",
    "Thiruvananthapuram", "Malappuram", "Wayanad"
]


class KeralaRainfallSARIMA:
    """
    SARIMA model for Kerala monsoon rainfall forecasting.
    
    This model is specifically tuned for Kerala's rainfall patterns:
    - Strong monsoon seasonality (June-September)
    - Southwest monsoon (June-August) and Northeast monsoon (October-November)
    
    Kerala Districts (14):
    - South: Thiruvananthapuram, Kollam, Pathanamthitta
    - Central: Alappuzha, Kottayam, Idukki, Ernakulam, Thrissur
    - North: Palakkad, Malappuram, Kozhikode, Wayanad, Kannur, Kasaragod
    """
    
    def __init__(self, state_name: str = "Kerala"):
        self.state_name = state_name
        self.districts = KERALA_DISTRICTS
        self.rubber_districts = RUBBER_BELT_DISTRICTS
        self.model = None
        self.fitted_model = None
        self.order = None
        self.seasonal_order = None
        self.training_data = None
        self.model_metadata = {}
        
    def load_historical_data(self, csv_path: str = None) -> pd.DataFrame:
        """
        Load historical rainfall data from Kerala-Rainfall-Historical.csv
        """
        if csv_path is None:
            csv_path = DATA_DIR / 'Kerala-Rainfall-Historical.csv'
        
        print(f"📁 Loading data from: {csv_path}")
        
        df = pd.read_csv(csv_path)
        
        # Ensure state column exists
        if 'STATE' not in df.columns and 'SUBDIVISION' in df.columns:
            df['STATE'] = df['SUBDIVISION']
        
        print(f"✅ Loaded {len(df)} years of data ({df['YEAR'].min()}-{df['YEAR'].max()})")
        return df
    
    def prepare_monsoon_data(self, df: pd.DataFrame) -> pd.Series:
        """
        Extract and prepare monsoon season (JJAS) rainfall data for SARIMA.
        
        The JJAS column contains June-July-August-September total rainfall,
        which is the critical period for rubber plantation management.
        """
        # Use JJAS column (monsoon rainfall)
        if 'JJAS' in df.columns:
            monsoon_data = df[['YEAR', 'JJAS']].copy()
            monsoon_data.columns = ['Year', 'Rainfall']
        else:
            # Calculate from monthly columns if JJAS not present
            monsoon_data = df[['YEAR']].copy()
            monsoon_data['Rainfall'] = df['JUN'] + df['JUL'] + df['AUG'] + df['SEP']
            monsoon_data.columns = ['Year', 'Rainfall']
        
        # Create datetime index
        monsoon_data['Date'] = pd.to_datetime(monsoon_data['Year'], format='%Y')
        monsoon_data.set_index('Date', inplace=True)
        monsoon_data = monsoon_data.sort_index()
        
        # Remove any NaN values
        monsoon_data = monsoon_data.dropna()
        
        self.training_data = monsoon_data
        
        print(f"📊 Monsoon data prepared:")
        print(f"   - Years: {monsoon_data['Year'].min()} to {monsoon_data['Year'].max()}")
        print(f"   - Mean rainfall: {monsoon_data['Rainfall'].mean():.2f} mm")
        print(f"   - Std deviation: {monsoon_data['Rainfall'].std():.2f} mm")
        
        return monsoon_data['Rainfall']
    
    def test_stationarity(self, series: pd.Series) -> dict:
        """
        Perform Augmented Dickey-Fuller test for stationarity.
        """
        result = adfuller(series.dropna())
        
        stationarity_result = {
            'adf_statistic': result[0],
            'p_value': result[1],
            'critical_values': result[4],
            'is_stationary': result[1] < 0.05
        }
        
        print(f"\n📈 Stationarity Test (ADF):")
        print(f"   - ADF Statistic: {result[0]:.4f}")
        print(f"   - p-value: {result[1]:.4f}")
        print(f"   - Stationary: {'Yes ✓' if result[1] < 0.05 else 'No ✗ (differencing needed)'}")
        
        return stationarity_result
    
    def find_optimal_parameters(self, series: pd.Series) -> tuple:
        """
        Find optimal SARIMA parameters using grid search with AIC criterion.
        
        For yearly monsoon data, we use:
        - No seasonal component (s=1) since data is annual
        - Focus on AR and MA orders for capturing trends
        """
        print("\n🔍 Finding optimal SARIMA parameters...")
        
        best_aic = float('inf')
        best_order = (1, 1, 1)
        best_seasonal = (0, 0, 0, 1)  # No seasonality for yearly data
        
        # Grid search for non-seasonal parameters
        # For yearly data, we don't need seasonal components
        p_range = range(0, 4)
        d_range = range(0, 2)
        q_range = range(0, 4)
        
        total_combinations = len(list(p_range)) * len(list(d_range)) * len(list(q_range))
        tested = 0
        
        for p in range(0, 4):
            for d in range(0, 2):
                for q in range(0, 4):
                    try:
                        model = SARIMAX(
                            series,
                            order=(p, d, q),
                            seasonal_order=(0, 0, 0, 1),
                            enforce_stationarity=False,
                            enforce_invertibility=False
                        )
                        results = model.fit(disp=False)
                        
                        if results.aic < best_aic:
                            best_aic = results.aic
                            best_order = (p, d, q)
                            
                        tested += 1
                        
                    except Exception:
                        continue
        
        print(f"   - Tested {tested} parameter combinations")
        print(f"   - Best order: ARIMA{best_order}")
        print(f"   - Best AIC: {best_aic:.2f}")
        
        self.order = best_order
        self.seasonal_order = best_seasonal
        
        return best_order, best_seasonal
    
    def train(self, series: pd.Series, order: tuple = None, seasonal_order: tuple = None) -> dict:
        """
        Train the SARIMA model on historical rainfall data.
        
        Parameters:
        -----------
        series : pd.Series
            Time series of monsoon rainfall
        order : tuple, optional
            ARIMA order (p, d, q). If None, uses auto-detected values.
        seasonal_order : tuple, optional
            Seasonal order (P, D, Q, s). For yearly data, defaults to (0,0,0,1).
        
        Returns:
        --------
        dict : Training metrics and model summary
        """
        print("\n🚂 Training SARIMA model...")
        
        if order is None:
            if self.order is None:
                self.find_optimal_parameters(series)
            order = self.order
        
        if seasonal_order is None:
            seasonal_order = self.seasonal_order or (0, 0, 0, 1)
        
        # Fit the model
        self.model = SARIMAX(
            series,
            order=order,
            seasonal_order=seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False
        )
        
        self.fitted_model = self.model.fit(disp=False)
        
        # Calculate training metrics
        predictions = self.fitted_model.fittedvalues
        residuals = series - predictions
        
        # Handle alignment issues
        common_idx = series.index.intersection(predictions.index)
        actual = series.loc[common_idx]
        pred = predictions.loc[common_idx]
        
        mse = mean_squared_error(actual, pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(actual, pred)
        mape = np.mean(np.abs((actual - pred) / actual)) * 100
        
        # Store metadata
        self.model_metadata = {
            'state': self.state_name,
            'model_type': 'SARIMA',
            'order': order,
            'seasonal_order': seasonal_order,
            'aic': self.fitted_model.aic,
            'bic': self.fitted_model.bic,
            'training_years': f"{series.index.min().year}-{series.index.max().year}",
            'n_observations': len(series),
            'metrics': {
                'mse': mse,
                'rmse': rmse,
                'mae': mae,
                'mape': mape
            },
            'trained_at': datetime.now().isoformat()
        }
        
        print(f"\n✅ Model trained successfully!")
        print(f"   - Order: ARIMA{order}")
        print(f"   - AIC: {self.fitted_model.aic:.2f}")
        print(f"   - BIC: {self.fitted_model.bic:.2f}")
        print(f"\n📊 Training Metrics:")
        print(f"   - RMSE: {rmse:.2f} mm")
        print(f"   - MAE: {mae:.2f} mm")
        print(f"   - MAPE: {mape:.2f}%")
        
        return self.model_metadata
    
    def forecast(self, steps: int = 5, confidence_level: float = 0.95) -> pd.DataFrame:
        """
        Generate rainfall forecasts for future years.
        
        Parameters:
        -----------
        steps : int
            Number of years to forecast
        confidence_level : float
            Confidence level for prediction intervals
        
        Returns:
        --------
        pd.DataFrame : Forecasts with confidence intervals
        """
        if self.fitted_model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        print(f"\n🔮 Generating {steps}-year forecast...")
        
        # Get forecast
        forecast_result = self.fitted_model.get_forecast(steps=steps)
        forecast_mean = forecast_result.predicted_mean
        confidence_int = forecast_result.conf_int(alpha=1 - confidence_level)
        
        # Create forecast dataframe
        last_year = self.training_data['Year'].max()
        forecast_years = list(range(last_year + 1, last_year + 1 + steps))
        
        forecast_df = pd.DataFrame({
            'year': forecast_years,
            'state': self.state_name,
            'season': 'Monsoon',
            'months': 'June-July-August-September',
            'predicted_rainfall': forecast_mean.values,
            'lower_ci': confidence_int.iloc[:, 0].values,
            'upper_ci': confidence_int.iloc[:, 1].values,
            'model': f'SARIMA{self.order}',
            'is_forecast': True
        })
        
        # Classify risk levels based on historical average
        historical_avg = self.training_data['Rainfall'].mean()
        historical_std = self.training_data['Rainfall'].std()
        
        def classify_risk(rainfall):
            if rainfall > historical_avg + 0.5 * historical_std:
                return 'High'
            elif rainfall < historical_avg - 0.5 * historical_std:
                return 'Low'
            return 'Normal'
        
        forecast_df['risk_level'] = forecast_df['predicted_rainfall'].apply(classify_risk)
        
        print(f"\n📅 Forecast Results ({forecast_years[0]}-{forecast_years[-1]}):")
        print(f"   Historical Average: {historical_avg:.2f} mm")
        print("-" * 60)
        
        for _, row in forecast_df.iterrows():
            risk_emoji = {'High': '🔴', 'Normal': '🟢', 'Low': '🟡'}[row['risk_level']]
            print(f"   {int(row['year'])}: {row['predicted_rainfall']:.2f} mm "
                  f"[{row['lower_ci']:.2f} - {row['upper_ci']:.2f}] "
                  f"{risk_emoji} {row['risk_level']}")
        
        return forecast_df
    
    def save_model(self, filename: str = 'kerala_sarima_model.joblib'):
        """Save the trained model to disk."""
        if self.fitted_model is None:
            raise ValueError("No trained model to save.")
        
        model_path = MODEL_DIR / filename
        
        model_data = {
            'fitted_model': self.fitted_model,
            'order': self.order,
            'seasonal_order': self.seasonal_order,
            'metadata': self.model_metadata,
            'training_data': self.training_data
        }
        
        joblib.dump(model_data, model_path)
        print(f"\n💾 Model saved to: {model_path}")
        
        # Also save metadata as JSON for easy reading
        metadata_path = MODEL_DIR / 'model_metadata.json'
        with open(metadata_path, 'w') as f:
            # Convert non-serializable items
            metadata_json = self.model_metadata.copy()
            metadata_json['order'] = list(metadata_json['order'])
            metadata_json['seasonal_order'] = list(metadata_json['seasonal_order'])
            json.dump(metadata_json, f, indent=2)
        
        print(f"📄 Metadata saved to: {metadata_path}")
        
        return model_path
    
    def load_model(self, filename: str = 'kerala_sarima_model.joblib'):
        """Load a trained model from disk."""
        model_path = MODEL_DIR / filename
        
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        model_data = joblib.load(model_path)
        
        self.fitted_model = model_data['fitted_model']
        self.order = model_data['order']
        self.seasonal_order = model_data['seasonal_order']
        self.model_metadata = model_data['metadata']
        self.training_data = model_data['training_data']
        
        print(f"✅ Model loaded from: {model_path}")
        return self
    
    def export_forecasts_for_mongodb(self, forecast_df: pd.DataFrame, 
                                      filename: str = 'rainfall_forecasts.json'):
        """
        Export forecasts in a format ready for MongoDB import.
        """
        output_path = OUTPUT_DIR / filename
        
        # Include historical data + forecasts
        historical_records = []
        for _, row in self.training_data.iterrows():
            historical_avg = self.training_data['Rainfall'].mean()
            rainfall = row['Rainfall']
            
            if rainfall > historical_avg * 1.1:
                risk = 'High'
            elif rainfall < historical_avg * 0.9:
                risk = 'Low'
            else:
                risk = 'Normal'
            
            historical_records.append({
                'year': int(row['Year']),
                'state': self.state_name,
                'districts': self.districts,
                'rubberBeltDistricts': self.rubber_districts,
                'season': 'Monsoon',
                'months': ['June', 'July', 'August', 'September'],
                'predictedRainfall': round(rainfall, 2),
                'riskLevel': risk,
                'model': f'SARIMA{self.order}',
                'isForecast': False
            })
        
        # Add forecasts
        forecast_records = []
        for _, row in forecast_df.iterrows():
            forecast_records.append({
                'year': int(row['year']),
                'state': self.state_name,
                'districts': self.districts,
                'rubberBeltDistricts': self.rubber_districts,
                'season': 'Monsoon',
                'months': ['June', 'July', 'August', 'September'],
                'predictedRainfall': round(row['predicted_rainfall'], 2),
                'lowerCI': round(row['lower_ci'], 2),
                'upperCI': round(row['upper_ci'], 2),
                'riskLevel': row['risk_level'],
                'model': f'SARIMA{self.order}',
                'isForecast': True
            })
        
        all_records = historical_records + forecast_records
        
        with open(output_path, 'w') as f:
            json.dump(all_records, f, indent=2)
        
        print(f"\n📤 Exported {len(all_records)} records to: {output_path}")
        print(f"   - Historical: {len(historical_records)}")
        print(f"   - Forecasts: {len(forecast_records)}")
        print(f"   - Districts: {len(self.districts)}")
        
        return output_path


def main():
    """
    Main training pipeline for Kerala rainfall SARIMA model.
    """
    print("=" * 70)
    print("🌧️  KERALA RAINFALL SARIMA MODEL TRAINING")
    print("=" * 70)
    print(f"   State: Kerala")
    print(f"   Region: India (Rubber Plantation Belt)")
    print(f"   Training Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    # Initialize model
    model = KeralaRainfallSARIMA(state_name="Kerala")
    
    # Load and prepare data
    df = model.load_historical_data()
    series = model.prepare_monsoon_data(df)
    
    # Test stationarity
    model.test_stationarity(series)
    
    # Find optimal parameters and train
    model.find_optimal_parameters(series)
    model.train(series)
    
    # Generate forecasts (2018-2030)
    last_data_year = model.training_data['Year'].max()
    forecast_years = 2030 - last_data_year
    forecast_df = model.forecast(steps=max(forecast_years, 5))
    
    # Save model and exports
    model.save_model()
    model.export_forecasts_for_mongodb(forecast_df)
    
    print("\n" + "=" * 70)
    print("✅ TRAINING COMPLETE!")
    print("=" * 70)
    print(f"\nFiles generated:")
    print(f"   📦 Model: backend/ml/trained_models/kerala_sarima_model.joblib")
    print(f"   📄 Metadata: backend/ml/trained_models/model_metadata.json")
    print(f"   📊 Forecasts: backend/ml/forecasts/rainfall_forecasts.json")
    print("\nNext steps:")
    print("   1. Run: node scripts/importSarimaForecasts.js")
    print("   2. Forecasts will be loaded into MongoDB")
    print("=" * 70)
    
    return model, forecast_df


if __name__ == '__main__':
    main()

