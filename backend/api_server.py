#!/usr/bin/env python3
"""
Suitability Analysis Web API
Flask server to handle suitability analysis requests from the frontend
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import sys
from pathlib import Path
import threading
import time

# Add the backend directory to path
sys.path.append(str(Path(__file__).parent))

from suitability_analyzer import SuitabilityAnalyzer

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Global analyzer instance
analyzer = None
current_analysis = None

def initialize_analyzer():
    """Initialize the analyzer with the correct data folder"""
    global analyzer
    
    # Find the data folder relative to the script location
    script_dir = Path(__file__).parent
    data_folder = script_dir.parent / "data"
    
    if not data_folder.exists():
        print(f"Warning: Data folder not found at {data_folder}")
        data_folder = Path("data")  # Fallback to relative path
    
    analyzer = SuitabilityAnalyzer(str(data_folder))
    print(f"Analyzer initialized with data folder: {data_folder}")

def update_files_json(data_folder, new_filename):
    """Update the files.json to include the new suitability layer"""
    files_json_path = Path(data_folder) / "files.json"
    
    try:
        # Read existing files.json
        if files_json_path.exists():
            with open(files_json_path, 'r') as f:
                files_list = json.load(f)
        else:
            files_list = []
        
        # Add new file if not already present
        if new_filename not in files_list:
            files_list.append(new_filename)
            
            # Write back to files.json
            with open(files_json_path, 'w') as f:
                json.dump(files_list, f, indent=2)
            
            print(f"Added {new_filename} to files.json")
    
    except Exception as e:
        print(f"Error updating files.json: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "message": "Suitability analysis server running"})

@app.route('/analyze', methods=['POST'])
def analyze_suitability():
    """
    Main analysis endpoint
    Expects JSON with weights in the format:
    {
        "weights": {
            "fertility": 20,
            "moisture": 15,
            ...
        },
        "name": "My Custom Analysis"  // Optional custom name
    }
    """
    global current_analysis
    
    try:
        data = request.get_json()
        
        if not data or 'weights' not in data:
            return jsonify({
                "status": "error",
                "message": "Missing 'weights' in request body"
            }), 400
        
        weights = data['weights']
        custom_name = data.get('name', 'Custom_Analysis')  # Default name if not provided
        
        # Sanitize the name for filename
        import re
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', custom_name)
        safe_name = safe_name.strip('_')[:50]  # Limit length
        
        # Validate weights
        expected_factors = list(analyzer.default_weights.keys())
        for factor in expected_factors:
            if factor not in weights:
                return jsonify({
                    "status": "error", 
                    "message": f"Missing weight for factor: {factor}"
                }), 400
        
        # Set current analysis status
        current_analysis = {
            "status": "processing",
            "progress": 0,
            "message": "Starting analysis..."
        }
        
        # Run analysis in background thread
        def run_analysis():
            global current_analysis
            try:
                current_analysis["message"] = "Calculating suitability..."
                current_analysis["progress"] = 25
                
                # Calculate suitability
                suitability_data, meta = analyzer.calculate_suitability(weights)
                
                current_analysis["message"] = "Saving results..."
                current_analysis["progress"] = 75
                
                # Save the result with custom name
                output_filename = f"suitability_{safe_name}.tif"
                output_path = analyzer.data_folder / output_filename
                analyzer.save_suitability_raster(suitability_data, meta, str(output_path))
                
                # Also update the files.json to include the new layer
                update_files_json(str(analyzer.data_folder), output_filename)
                
                current_analysis = {
                    "status": "completed",
                    "progress": 100,
                    "message": "Analysis completed successfully",
                    "output_file": str(output_path),
                    "layer_name": safe_name,
                    "filename": output_filename,
                    "custom_name": custom_name,
                    "statistics": {
                        "min_suitability": float(np.nanmin(suitability_data)),
                        "max_suitability": float(np.nanmax(suitability_data)),
                        "mean_suitability": float(np.nanmean(suitability_data))
                    }
                }
                
            except Exception as e:
                current_analysis = {
                    "status": "error",
                    "progress": 0,
                    "message": f"Analysis failed: {str(e)}"
                }
        
        # Start analysis thread
        analysis_thread = threading.Thread(target=run_analysis)
        analysis_thread.daemon = True
        analysis_thread.start()
        
        return jsonify({
            "status": "started",
            "message": "Analysis started successfully",
            "analysis_id": int(time.time()),  # Simple ID based on timestamp
            "layer_name": safe_name,
            "custom_name": custom_name
        })
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Server error: {str(e)}"
        }), 500

@app.route('/status', methods=['GET'])
def get_analysis_status():
    """Get the current analysis status"""
    global current_analysis
    
    if current_analysis is None:
        return jsonify({
            "status": "idle",
            "message": "No analysis in progress"
        })
    
    return jsonify(current_analysis)

@app.route('/weights/default', methods=['GET'])
def get_default_weights():
    """Get the default weights configuration"""
    return jsonify({
        "status": "success",
        "weights": analyzer.default_weights
    })

@app.route('/factors', methods=['GET'])
def get_available_factors():
    """Get list of available environmental factors"""
    # Check which files actually exist
    available_factors = {}
    
    for factor, filename in analyzer.factor_files.items():
        file_path = analyzer.data_folder / filename
        available_factors[factor] = {
            "filename": filename,
            "exists": file_path.exists(),
            "path": str(file_path)
        }
    
    return jsonify({
        "status": "success",
        "factors": available_factors,
        "data_folder": str(analyzer.data_folder)
    })

@app.route('/layers', methods=['GET'])
def get_available_layers():
    """Get list of all available suitability layers"""
    try:
        files_json_path = analyzer.data_folder / "files.json"
        
        if files_json_path.exists():
            with open(files_json_path, 'r') as f:
                all_files = json.load(f)
        else:
            all_files = []
        
        # Filter for suitability files
        suitability_layers = []
        for filename in all_files:
            if filename.startswith('suitability'):
                layer_info = {
                    "filename": filename,
                    "exists": (analyzer.data_folder / filename).exists()
                }
                
                # Extract custom name from filename
                if filename == 'suitability.tif':
                    layer_info["display_name"] = "Default Suitability"
                    layer_info["layer_name"] = "default"
                else:
                    # Extract name from suitability_CustomName.tif
                    name_part = filename.replace('suitability_', '').replace('.tif', '')
                    layer_info["display_name"] = name_part.replace('_', ' ').title()
                    layer_info["layer_name"] = name_part
                
                suitability_layers.append(layer_info)
        
        return jsonify({
            "status": "success",
            "layers": suitability_layers
        })
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error retrieving layers: {str(e)}"
        }), 500

def main():
    """Main function to run the server"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Suitability Analysis Web API Server')
    parser.add_argument('--host', default='localhost', help='Host to bind the server to')
    parser.add_argument('--port', type=int, default=5000, help='Port to bind the server to')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    
    args = parser.parse_args()
    
    # Initialize the analyzer
    initialize_analyzer()
    
    print(f"Starting Suitability Analysis API Server...")
    print(f"Server will be available at: http://{args.host}:{args.port}")
    print(f"Health check: http://{args.host}:{args.port}/health")
    
    # Run the Flask app
    app.run(host=args.host, port=args.port, debug=args.debug)

if __name__ == "__main__":
    # Import numpy here to avoid issues with Flask
    import numpy as np
    main()