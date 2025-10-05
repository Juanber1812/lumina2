#!/usr/bin/env python3
"""
Suitability Analysis Backend
Generates a new suitability GeoTIFF based on weighted environmental factors
"""

import os
import json
import sys
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio import warp
import argparse
from pathlib import Path

class SuitabilityAnalyzer:
    def __init__(self, data_folder="data"):
        self.data_folder = Path(data_folder)
        self.factor_files = {
            'fertility': 'Fertility.tif',
            'moisture': 'SoilMoisture.tif', 
            'soc': 'SOC.tif',
            'ndvi': 'NDVI.tif',
            'nitrogen': 'Nitrogen.tif',
            'phosphorus': 'Phosphorus.tif',
            'potassium': 'Potassium.tif',
            'ph': 'PH.tif',
            'texture': 'SoilTexture.tif',
            'sulphur': 'Sulphur.tif'
        }
        
        # Default weights (matching analysis2.py)
        self.default_weights = {
            'fertility': 30,
            'moisture': 25,
            'soc': 12,
            'ndvi': 12,
            'nitrogen': 8,
            'phosphorus': 7,
            'potassium': 6,
            'ph': 6,
            'texture': 3,
            'sulphur': 1
        }

    def normalize_raster_values(self, raster_data, factor_name):
        """
        Normalize raster values to 0-1 scale based on factor-specific rules
        Handles both categorical and continuous data appropriately
        """
        # Remove nodata values
        valid_mask = ~np.isnan(raster_data)
        normalized = np.full_like(raster_data, 0.0, dtype=np.float32)
        
        if factor_name == 'ph':
            # pH: continuous data from ~5.19 to 8.33 - use agricultural optimum curve
            # Optimal pH for agriculture: 6.0-7.5
            normalized = np.where(raster_data < 4.5, 0.1,
                         np.where(raster_data < 5.5, 0.3,
                         np.where(raster_data < 6.0, 0.6,
                         np.where(raster_data <= 7.5, 1.0,
                         np.where(raster_data <= 8.5, 0.7,
                         np.where(raster_data <= 9.0, 0.4, 0.1))))))
        
        elif factor_name == 'fertility':
            # Fertility: categorical values - higher numbers are worse
            # 0 is best (score 1.0), intermediate values get middle scores, 36+ is worst
            normalized = np.where(raster_data == 0, 1.0,
                         np.where(raster_data <= 4, 0.8,
                         np.where(raster_data <= 8, 0.6,
                         np.where(raster_data <= 12, 0.4,
                         np.where(raster_data <= 36, 0.2, 0.0)))))
        
        elif factor_name == 'ndvi':
            # NDVI: 1-5 scale provided by user
            # 1,2 = bad, 3 = best, 4 = good, 5 = forest (penalized)
            return np.select(
                [raster_data == 1, raster_data == 2, raster_data == 3, raster_data == 4, raster_data == 5],
                [10, 40, 100, 80, 20], # 1=v.low, 2=low, 3=optimal, 4=good, 5=forest(penalize)
                default=0
            )
        
        elif factor_name == 'nitrogen':
            # Nitrogen: only value 5.0 - treat as optimal
            normalized = np.where(raster_data == 5, 1.0, 0.0)
        
        elif factor_name == 'potassium':
            # Potassium: only value 5.0 - treat as optimal
            normalized = np.where(raster_data == 5, 1.0, 0.0)
        
        elif factor_name == 'phosphorus':
            # Phosphorus: categorical 2,3,4,5; 5 is great, 2 is bad
            mapping = {2: 0.0, 3: 0.33, 4: 0.66, 5: 1.0}
            for val, norm_val in mapping.items():
                normalized = np.where(raster_data == val, norm_val, normalized)
        
        elif factor_name == 'soc':
            # SOC: continuous data 0.8 to 3.2 - higher is better for agriculture
            # Excellent: >2%, Good: 1.5-2%, Fair: 1-1.5%, Poor: <1%
            normalized = np.where(raster_data < 1.0, 0.2,
                         np.where(raster_data < 1.5, 0.4,
                         np.where(raster_data < 2.0, 0.6,
                         np.where(raster_data < 2.5, 0.8, 1.0))))
        
        elif factor_name == 'texture':
            # Soil texture: categorical 0,1,2,4,5; 5 best, 0 worst
            mapping = {0: 0.0, 1: 0.2, 2: 0.33, 4: 0.66, 5: 1.0}
            for val, norm_val in mapping.items():
                normalized = np.where(raster_data == val, norm_val, normalized)
        
        elif factor_name == 'moisture':
            # Soil moisture: categorical 0,3,4,5,6,7,8,9,10; 5 ideal, extremes bad
            mapping = {0: 0.0, 3: 0.5, 4: 0.7, 5: 1.0, 6: 0.7, 7: 0.5, 8: 0.3, 9: 0.1, 10: 0.0}
            for val, norm_val in mapping.items():
                normalized = np.where(raster_data == val, norm_val, normalized)
        
        elif factor_name == 'sulphur':
            # Sulphur: mostly 3.0, some 2.0, 4.0, 5.0; higher is better
            # Treat continuous values around integers
            normalized = np.where(raster_data < 2.5, 0.0,
                         np.where(raster_data < 3.5, 0.33,
                         np.where(raster_data < 4.5, 0.66, 1.0)))
        
        else:
            # Default: no normalization, keep original values if in 0-1 range
            normalized = np.clip(raster_data, 0, 1)
        
        # Preserve nodata values
        normalized[~valid_mask] = np.nan
        
        return normalized

    def load_and_normalize_factor(self, factor_name, target_transform=None, target_shape=None):
        """Load and normalize a single factor raster"""
        file_path = self.data_folder / self.factor_files[factor_name]
        
        if not file_path.exists():
            print(f"Warning: {file_path} not found, skipping {factor_name}")
            return None, None
        
        try:
            with rasterio.open(file_path) as src:
                # Read the data
                data = src.read(1)
                
                # Convert to float32 and replace nodata with NaN
                data = data.astype(np.float32)
                if src.nodata is not None:
                    data[data == src.nodata] = np.nan
                
                # If target transform is provided, resample to match
                if target_transform is not None and target_shape is not None:
                    # Create output array
                    resampled_data = np.full(target_shape, np.nan, dtype=np.float32)
                    
                    # Resample - need to add band dimension for reproject
                    warp.reproject(
                        source=data[np.newaxis, :, :],  # Add band dimension
                        destination=resampled_data[np.newaxis, :, :],  # Add band dimension
                        src_transform=src.transform,
                        src_crs=src.crs,
                        dst_transform=target_transform,
                        dst_crs=src.crs,
                        resampling=Resampling.bilinear
                    )
                    data = resampled_data
                
                # Normalize the data
                normalized = self.normalize_raster_values(data, factor_name)
                
                return normalized, src.meta.copy()
        
        except Exception as e:
            print(f"Error loading {factor_name}: {e}")
            return None, None

    def calculate_suitability(self, weights=None):
        """
        Calculate weighted suitability based on all factors with NDVI penalties
        """
        if weights is None:
            weights = self.default_weights.copy()
        
        # Normalize weights to sum to 100
        total_weight = sum(weights.values())
        if total_weight != 100:
            weights = {k: (v / total_weight) * 100 for k, v in weights.items()}
        
        print(f"Using weights: {weights}")
        
        # Find reference raster for spatial properties
        reference_file = None
        reference_meta = None
        
        for factor_name, filename in self.factor_files.items():
            file_path = self.data_folder / filename
            if file_path.exists():
                with rasterio.open(file_path) as src:
                    reference_meta = src.meta.copy()
                    target_transform = src.transform
                    target_shape = (src.height, src.width)
                    reference_file = file_path
                    break
        
        if reference_meta is None:
            raise FileNotFoundError("No valid raster files found in data folder")
        
        print(f"Using {reference_file} as spatial reference")
        
        # Initialize suitability array and store normalized factors
        suitability = np.zeros(target_shape, dtype=np.float32)
        normalized_factors = {}
        total_weights_used = 0
        
        # Process each factor
        for factor_name in self.factor_files.keys():
            if factor_name in weights:
                print(f"Processing {factor_name}...")
                
                normalized_data, meta = self.load_and_normalize_factor(
                    factor_name, target_transform, target_shape
                )
                
                if normalized_data is not None:
                    # Store normalized data for later use
                    normalized_factors[factor_name] = normalized_data
                    
                    # Apply weight
                    weight = weights[factor_name] / 100.0  # Convert to 0-1 scale
                    
                    # Handle NaN values
                    valid_mask = ~np.isnan(normalized_data)
                    suitability[valid_mask] += (normalized_data[valid_mask] * weight)
                    total_weights_used += weight
                    
                    print(f"  Applied weight: {weights[factor_name]}% (factor: {weight:.3f})")
        
        # Normalize final suitability to 0-1 scale first
        if total_weights_used > 0:
            # Scale to account for any missing factors
            suitability = suitability / total_weights_used
        
        # Apply NDVI penalties (from analysis2.py logic)
        if 'ndvi' in normalized_factors:
            # Load original NDVI values (not normalized) to check for special cases
            ndvi_file = self.data_folder / self.factor_files['ndvi']
            if ndvi_file.exists():
                with rasterio.open(ndvi_file) as src:
                    ndvi_original = src.read(1).astype(np.float32)
                    if src.nodata is not None:
                        ndvi_original[ndvi_original == src.nodata] = np.nan
                    
                    # Resample if needed
                    if ndvi_original.shape != target_shape:
                        resampled_ndvi = np.full(target_shape, np.nan, dtype=np.float32)
                        warp.reproject(
                            source=ndvi_original[np.newaxis, :, :],  # Add band dimension
                            destination=resampled_ndvi[np.newaxis, :, :],  # Add band dimension
                            src_transform=src.transform,
                            src_crs=src.crs,
                            dst_transform=target_transform,
                            dst_crs=src.crs,
                            resampling=Resampling.nearest
                        )
                        ndvi_original = resampled_ndvi
                    
                    # Apply penalties: 1 or 2 = 0.1 (poor), 5 = 0.2 (forest)
                    ndvi_poor_mask = (ndvi_original == 1) | (ndvi_original == 2)
                    ndvi_forest_mask = (ndvi_original == 5)
                    suitability = np.where(ndvi_poor_mask, 0.1, suitability)
                    suitability = np.where(ndvi_forest_mask, 0.2, suitability)
                    
                    print(f"Applied NDVI penalties: poor areas set to 0.1, forest areas set to 0.2")
        
        # Round to 1 decimal place for discretization (like analysis2.py)
        suitability = np.round(suitability, 1)
        
        # Convert to 0-100 scale for output
        suitability = suitability * 100
        
        # Clip to valid range
        suitability = np.clip(suitability, 0, 100)
        
        print(f"Suitability range: {np.nanmin(suitability):.1f} - {np.nanmax(suitability):.1f}")
        
        return suitability, reference_meta

    def save_suitability_raster(self, suitability_data, meta, output_path="data/suitability.tif"):
        """Save the calculated suitability as a GeoTIFF"""
        
        # Update metadata for output
        meta.update({
            'dtype': 'float32',
            'count': 1,
            'compress': 'lzw',
            'nodata': -9999
        })
        
        # Replace NaN with nodata value
        output_data = suitability_data.copy()
        output_data[np.isnan(output_data)] = meta['nodata']
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Write the raster
        with rasterio.open(output_path, 'w', **meta) as dst:
            dst.write(output_data, 1)
        
        print(f"Suitability raster saved to: {output_path}")
        
        return output_path

def main():
    parser = argparse.ArgumentParser(description='Generate agricultural suitability raster')
    parser.add_argument('--weights', '-w', type=str, 
                       help='JSON string with weights (e.g., \'{"fertility":25,"moisture":20}\')')
    parser.add_argument('--weights-file', '-f', type=str,
                       help='JSON file containing weights')
    parser.add_argument('--data-folder', '-d', type=str, default='data',
                       help='Folder containing input rasters')
    parser.add_argument('--output', '-o', type=str, default='data/suitability.tif',
                       help='Output suitability raster path')
    
    args = parser.parse_args()
    
    # Initialize analyzer
    analyzer = SuitabilityAnalyzer(args.data_folder)
    
    # Load weights
    weights = None
    if args.weights:
        try:
            weights = json.loads(args.weights)
        except json.JSONDecodeError:
            print("Error: Invalid JSON in weights argument")
            return 1
    
    elif args.weights_file:
        try:
            with open(args.weights_file, 'r') as f:
                weights = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Error loading weights file: {e}")
            return 1
    
    try:
        # Calculate suitability
        suitability, meta = analyzer.calculate_suitability(weights)
        
        # Save result
        analyzer.save_suitability_raster(suitability, meta, args.output)
        
        print("Suitability analysis completed successfully!")
        return 0
        
    except Exception as e:
        print(f"Error during analysis: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())