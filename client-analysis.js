/**
 * Client-Side Suitability Analysis Engine
 * Converts the Python backend logic to JavaScript for Netlify deployment
 */

class ClientSuitabilityAnalyzer {
    constructor() {
        this.factorFiles = {
            'fertility': 'data/Fertility.tif',
            'moisture': 'data/SoilMoisture.tif', 
            'soc': 'data/SOC.tif',
            'ndvi': 'data/NDVI.tif',
            'nitrogen': 'data/Nitrogen.tif',
            'phosphorus': 'data/Phosphorus.tif',
            'potassium': 'data/Potassium.tif',
            'ph': 'data/PH.tif',
            'texture': 'data/SoilTexture.tif',
            'sulphur': 'data/Sulphur.tif'
        };

        this.defaultWeights = {
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
        };

        this.loadedData = {};
    }

    /**
     * Normalize raster values based on factor-specific rules
     */
    normalizeRasterValues(data, factorName) {
        console.log(`Normalizing ${factorName}...`);
        
        const result = new Float32Array(data.length);

        // CATEGORICAL (DISCRETE) FACTORS
        if (factorName === 'fertility') {
            // 0=best, 4=ok, 36=bad
            for (let i = 0; i < data.length; i++) {
                if (data[i] === 0) result[i] = 100;
                else if (data[i] === 4) result[i] = 50;
                else if (data[i] === 36) result[i] = 10;
                else result[i] = 0;
            }
            return result;
        }

        if (factorName === 'texture') {
            // 1=best, 2=ok, 3=bad
            for (let i = 0; i < data.length; i++) {
                if (data[i] === 1) result[i] = 100;
                else if (data[i] === 2) result[i] = 50;
                else if (data[i] === 3) result[i] = 10;
                else result[i] = 0;
            }
            return result;
        }

        if (factorName === 'ndvi') {
            // 1-5 scale: 1,2=bad, 3=best, 4=good, 5=forest
            for (let i = 0; i < data.length; i++) {
                if (data[i] === 1) result[i] = 10;
                else if (data[i] === 2) result[i] = 40;
                else if (data[i] === 3) result[i] = 100;
                else if (data[i] === 4) result[i] = 80;
                else if (data[i] === 5) result[i] = 20;
                else result[i] = 0;
            }
            return result;
        }

        // CONTINUOUS FACTORS WITH OPTIMAL RANGE
        if (factorName === 'ph') {
            // Optimal range 6.0-7.5
            for (let i = 0; i < data.length; i++) {
                if (data[i] < 5.5) result[i] = 10;
                else if (data[i] >= 5.5 && data[i] < 6.0) result[i] = 50;
                else if (data[i] >= 6.0 && data[i] <= 7.5) result[i] = 100;
                else if (data[i] > 7.5 && data[i] <= 8.5) result[i] = 50;
                else if (data[i] > 8.5) result[i] = 10;
                else result[i] = 0;
            }
            return result;
        }

        if (factorName === 'moisture') {
            // Optimal around 5-6, values 1-10
            for (let i = 0; i < data.length; i++) {
                if (data[i] < 3) result[i] = 20;
                else if (data[i] >= 3 && data[i] < 5) result[i] = 60;
                else if (data[i] >= 5 && data[i] <= 7) result[i] = 100;
                else if (data[i] > 7 && data[i] <= 9) result[i] = 60;
                else if (data[i] > 9) result[i] = 20;
                else result[i] = 0;
            }
            return result;
        }

        // CONTINUOUS FACTORS - HIGHER IS BETTER
        if (['nitrogen', 'phosphorus', 'potassium', 'soc', 'sulphur'].includes(factorName)) {
            // Linear scaling: higher values = better
            const min = Math.min(...data);
            const max = Math.max(...data);
            const range = max - min;
            
            for (let i = 0; i < data.length; i++) {
                if (range > 0) {
                    result[i] = ((data[i] - min) / range) * 90 + 10; // Scale to 10-100
                } else {
                    result[i] = 50; // Default if no variation
                }
            }
            return result;
        }

        // Default case
        return result;
    }

    /**
     * Load and process a GeoTIFF file
     */
    async loadGeoTIFF(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
            const image = await tiff.getImage();
            const data = await image.readRasters();
            
            return {
                data: data[0], // First band
                width: image.getWidth(),
                height: image.getHeight(),
                bbox: image.getBoundingBox(),
                transform: image.getGeoTransform()
            };
        } catch (error) {
            console.error(`Error loading ${url}:`, error);
            throw error;
        }
    }

    /**
     * Calculate suitability with custom weights
     */
    async calculateSuitability(customWeights = null) {
        try {
            const weights = customWeights || this.defaultWeights;
            
            // Normalize weights to percentages
            const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
            const normalizedWeights = {};
            for (const [factor, weight] of Object.entries(weights)) {
                normalizedWeights[factor] = (weight / totalWeight) * 100;
            }

            console.log('Using weights:', normalizedWeights);

            // Load reference data (first factor) to get dimensions
            const referenceKey = Object.keys(this.factorFiles)[0];
            const referenceData = await this.loadGeoTIFF(this.factorFiles[referenceKey]);
            
            const width = referenceData.width;
            const height = referenceData.height;
            const totalPixels = width * height;
            
            // Initialize final suitability array
            const finalSuitability = new Float32Array(totalPixels);

            // Process each factor
            for (const [factor, weightPercentage] of Object.entries(normalizedWeights)) {
                if (weightPercentage === 0) continue;

                console.log(`Processing ${factor}...`);
                
                const factorData = await this.loadGeoTIFF(this.factorFiles[factor]);
                const normalizedData = this.normalizeRasterValues(factorData.data, factor);
                
                const weightFactor = weightPercentage / 100.0;
                console.log(`  Applied weight: ${weightPercentage}% (factor: ${weightFactor.toFixed(3)})`);
                
                // Add weighted factor to final suitability
                for (let i = 0; i < totalPixels; i++) {
                    finalSuitability[i] += normalizedData[i] * weightFactor;
                }
            }

            // Classify final scores into 1-5 scale
            const classified = new Uint8Array(totalPixels);
            for (let i = 0; i < totalPixels; i++) {
                const score = finalSuitability[i];
                if (score <= 20) classified[i] = 1;
                else if (score <= 40) classified[i] = 2;
                else if (score <= 60) classified[i] = 3;
                else if (score <= 80) classified[i] = 4;
                else classified[i] = 5;
            }

            console.log(`Final suitability range: ${Math.min(...finalSuitability)} - ${Math.max(...finalSuitability)}`);
            console.log('Re-classified to 1-5 scale');

            return {
                data: classified,
                width: width,
                height: height,
                bbox: referenceData.bbox,
                transform: referenceData.transform
            };

        } catch (error) {
            console.error('Error calculating suitability:', error);
            throw error;
        }
    }

    /**
     * Create downloadable GeoTIFF blob
     */
    async createDownloadableGeoTIFF(analysisResult, customName = 'custom_analysis') {
        // For now, return analysis data as JSON
        // In a full implementation, you'd use a library like geotiff-writer
        const result = {
            name: `suitability_${customName}.json`,
            data: {
                values: Array.from(analysisResult.data),
                width: analysisResult.width,
                height: analysisResult.height,
                bbox: analysisResult.bbox,
                transform: analysisResult.transform
            }
        };
        
        const blob = new Blob([JSON.stringify(result.data, null, 2)], 
                              { type: 'application/json' });
        return { blob, filename: result.name };
    }
}

// Make available globally
window.ClientSuitabilityAnalyzer = ClientSuitabilityAnalyzer;