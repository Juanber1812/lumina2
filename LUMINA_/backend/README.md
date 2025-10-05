# Suitability Analysis Backend

## Overview
This backend system generates dynamic agricultural suitability GeoTIFF files based on weighted environmental factors from the web interface.

## Features
- **Dynamic GeoTIFF Generation**: Creates new suitability rasters based on custom weights
- **Factor Normalization**: Implements agricultural scoring criteria for each environmental factor
- **Web API**: Flask-based REST API for integration with the frontend
- **Real-time Processing**: Processes analysis requests and provides status updates

## Installation

### 1. Prerequisites
- Python 3.7 or higher
- pip (Python package installer)

### 2. Quick Start (Windows)
```bash
# Navigate to the backend directory
cd backend

# Run the setup script
start_server.bat
```

### 3. Manual Installation
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Start the server
python api_server.py
```

## Usage

### Starting the Server
```bash
cd backend
python api_server.py --host localhost --port 5000
```

### API Endpoints

#### Health Check
```
GET http://localhost:5000/health
```

#### Generate Suitability Map
```
POST http://localhost:5000/analyze
Content-Type: application/json

{
    "weights": {
        "fertility": 25,
        "moisture": 20,
        "soc": 15,
        "ndvi": 10,
        "nitrogen": 8,
        "phosphorus": 8,
        "potassium": 6,
        "ph": 4,
        "texture": 2,
        "sulphur": 2
    }
}
```

#### Check Analysis Status
```
GET http://localhost:5000/status
```

#### Get Default Weights
```
GET http://localhost:5000/weights/default
```

#### Get Available Factors
```
GET http://localhost:5000/factors
```

## How It Works

### 1. Factor Processing
Each environmental factor is:
- Loaded from its GeoTIFF file in the `data/` folder
- Normalized to 0-1 scale using agricultural scoring criteria
- Weighted according to the user's preferences

### 2. Suitability Calculation
```
Suitability = Σ(Factor_i × Weight_i) / Σ(Weight_i) × 100
```

### 3. Output Generation
- Results are saved as `data/suitability.tif`
- The web map automatically refreshes to show the new suitability layer
- Original suitability.tif is replaced with the new analysis

### 4. Normalization Rules

#### Soil Moisture (θ)
- θ < 0.08 → 0.0 (very dry)
- 0.08 ≤ θ < 0.12 → 0.25 (very low)
- 0.12 ≤ θ < 0.20 → 0.6 (marginal)
- 0.20 ≤ θ ≤ 0.35 → 1.0 (optimal)
- 0.35 < θ ≤ 0.45 → 0.7 (wet but OK)
- θ > 0.45 → 0.2 (waterlogged)

#### pH
- < 4.5 → 0.1 (very acidic)
- 4.5-5.5 → 0.3 (acidic)
- 5.5-6.0 → 0.6 (slightly acidic)
- 6.0-7.5 → 1.0 (optimal)
- 7.5-8.5 → 0.7 (slightly alkaline)
- 8.5-9.0 → 0.4 (alkaline)
- > 9.0 → 0.1 (very alkaline)

#### NDVI
- < 0.1 → 0.0 (no vegetation)
- 0.1-0.3 → 0.3 (sparse vegetation)
- 0.3-0.8 → 1.0 (optimal vegetation)
- 0.8-0.9 → 0.8 (dense vegetation)
- > 0.9 → 0.5 (over-dense)

#### Nutrients (N, P, K, S)
- Percentile-based normalization
- Higher values generally better
- Diminishing returns at very high levels

#### Soil Organic Carbon (SOC)
- < 0.5% → 0.2 (very low)
- 0.5-1.0% → 0.4 (low)
- 1.0-1.5% → 0.6 (moderate)
- 1.5-2.0% → 0.8 (good)
- > 2.0% → 1.0 (excellent)

## File Structure
```
backend/
├── suitability_analyzer.py    # Core analysis engine
├── api_server.py             # Flask web API
├── requirements.txt          # Python dependencies
├── start_server.bat         # Windows startup script
└── README.md               # This file
```

## Integration with Frontend
The frontend automatically calls the backend API when:
1. User clicks "Generate Suitability Map"
2. Weights are sent to `/analyze` endpoint
3. Status is polled until completion
4. New suitability.tif replaces the old one
5. Map refreshes to show updated analysis

## Troubleshooting

### Server Won't Start
- Check Python installation: `python --version`
- Verify you're in the backend directory
- Check for port conflicts (5000 is default)

### Analysis Fails
- Ensure all GeoTIFF files exist in `data/` folder
- Check file permissions
- Verify raster formats and projections match

### Frontend Can't Connect
- Confirm server is running on http://localhost:5000
- Check CORS settings if using different domains
- Verify firewall isn't blocking the connection

## Development

### Adding New Factors
1. Add the factor to `factor_files` dict in `SuitabilityAnalyzer`
2. Implement normalization rules in `normalize_raster_values`
3. Update frontend sliders to include the new factor
4. Add the factor to default weights

### Customizing Normalization
Edit the `normalize_raster_values` method to adjust scoring criteria for each factor based on agricultural requirements.