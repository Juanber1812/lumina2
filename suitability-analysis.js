// Suitability Analysis Interactive Controls
// This script handles the weight sliders and suitability map generation

// Initialize the suitability analysis when page loads
document.addEventListener('DOMContentLoaded', function() {
    initSuitabilityAnalysis();
});

function initSuitabilityAnalysis() {
    // Get all slider elements
    const sliders = {
        fertility: document.getElementById('fertility-slider'),
        moisture: document.getElementById('moisture-slider'),
        soc: document.getElementById('soc-slider'),
        ndvi: document.getElementById('ndvi-slider'),
        nitrogen: document.getElementById('nitrogen-slider'),
        phosphorus: document.getElementById('phosphorus-slider'),
        potassium: document.getElementById('potassium-slider'),
        ph: document.getElementById('ph-slider'),
        texture: document.getElementById('texture-slider'),
        sulphur: document.getElementById('sulphur-slider')
    };

    // Get all value display elements
    const valueDisplays = {
        fertility: document.getElementById('fertility-value'),
        moisture: document.getElementById('moisture-value'),
        soc: document.getElementById('soc-value'),
        ndvi: document.getElementById('ndvi-value'),
        nitrogen: document.getElementById('nitrogen-value'),
        phosphorus: document.getElementById('phosphorus-value'),
        potassium: document.getElementById('potassium-value'),
        ph: document.getElementById('ph-value'),
        texture: document.getElementById('texture-value'),
        sulphur: document.getElementById('sulphur-value')
    };

    // Load saved weights
    loadSavedWeights();

    // Add event listeners to all sliders
    Object.keys(sliders).forEach(key => {
        if (sliders[key]) {
            sliders[key].addEventListener('input', function() {
                valueDisplays[key].textContent = this.value;
                updateTotalWeight();
                saveWeights(); // Save weights whenever they change
            });
        }
    });

    // Reset button functionality
    const resetButton = document.getElementById('reset-defaults');
    if (resetButton) {
        resetButton.addEventListener('click', resetToDefaults);
    }

    // Generate map button functionality
    const generateButton = document.getElementById('generate-suitability');
    if (generateButton) {
        generateButton.addEventListener('click', generateSuitabilityMap);
    }

    // Initialize preset management
    initPresetManagement();
    
    // Initial weight calculation
    updateTotalWeight();
}

function updateTotalWeight() {
    const sliders = document.querySelectorAll('.suitability-slider');
    let total = 0;
    
    sliders.forEach(slider => {
        total += parseInt(slider.value);
    });
    
    const totalDisplay = document.getElementById('total-weight');
    if (totalDisplay) {
        totalDisplay.textContent = total;
    }
}

function resetToDefaults() {
    // Default values from analysis2.py
    const defaults = {
        'fertility-slider': 30,
        'moisture-slider': 25,
        'soc-slider': 12,
        'ndvi-slider': 12,
        'nitrogen-slider': 8,
        'phosphorus-slider': 7,
        'potassium-slider': 6,
        'ph-slider': 6,
        'texture-slider': 3,
        'sulphur-slider': 1
    };

    Object.keys(defaults).forEach(id => {
        const slider = document.getElementById(id);
        const valueSpan = document.getElementById(id.replace('-slider', '-value'));
        
        if (slider && valueSpan) {
            slider.value = defaults[id];
            valueSpan.textContent = defaults[id];
        }
    });

    updateTotalWeight();
    saveWeights(); // Save the reset weights
    hideNormalizationIndicator();
    
    // Update status
    const statusSpan = document.getElementById('suitability-status');
    if (statusSpan) {
        statusSpan.textContent = 'Weights reset to defaults';
        statusSpan.style.color = '#28a745';
        
        setTimeout(() => {
            statusSpan.textContent = 'Ready to generate map';
            statusSpan.style.color = '#4fc3f7';
        }, 2000);
    }
}

async function generateSuitabilityMap() {
    const generateButton = document.getElementById('generate-suitability');
    const statusSpan = document.getElementById('suitability-status');
    
    if (!generateButton || !statusSpan) return;
    
    // Disable button and show processing
    generateButton.disabled = true;
    generateButton.textContent = '🔄 Processing...';
    statusSpan.textContent = 'Preparing analysis...';
    statusSpan.style.color = '#ffc107';
    
    try {
        // Get current weights
        const weights = getCurrentWeights();
        
        // Get analysis name (from last saved preset or prompt user)
        let analysisName = window.lastPresetName || prompt('Enter a name for this analysis:', 'My Custom Analysis');
        
        if (!analysisName || analysisName.trim() === '') {
            statusSpan.textContent = 'Analysis cancelled - name required';
            statusSpan.style.color = '#dc3545';
            return;
        }
        
        // Save current weights
        saveWeights();
        
        // Call backend API
        statusSpan.textContent = 'Calling analysis server...';
        
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                weights: weights,
                name: analysisName
            })
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'started') {
            // Poll for status updates
            statusSpan.textContent = 'Analysis started, checking progress...';
            await pollAnalysisStatus(statusSpan);
        } else {
            throw new Error(result.message || 'Unknown error starting analysis');
        }
        
    } catch (error) {
        console.error('Analysis error:', error);
        statusSpan.textContent = `Error: ${error.message}`;
        statusSpan.style.color = '#dc3545';
        
        // Use client-side analysis as fallback (or primary method for Netlify)
        statusSpan.textContent = 'Running client-side analysis...';
        await runClientSideAnalysis(weights, analysisName, statusSpan);
    } finally {
        // Re-enable button
        generateButton.disabled = false;
        generateButton.textContent = '🔄 Generate Suitability Map';
    }
}

function getCurrentWeights() {
    const weights = {};
    const sliders = document.querySelectorAll('.suitability-slider');
    
    sliders.forEach(slider => {
        const factorName = slider.id.replace('-slider', '');
        weights[factorName] = parseInt(slider.value);
    });
    
    return weights;
}

async function pollAnalysisStatus(statusSpan) {
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            
            const response = await fetch('http://localhost:5000/status');
            const status = await response.json();
            
            statusSpan.textContent = status.message || 'Processing...';
            
            if (status.status === 'completed') {
                statusSpan.textContent = `Map "${status.custom_name || 'Custom Analysis'}" generated successfully!`;
                statusSpan.style.color = '#28a745';
                
                // Store the new layer info for the map
                const layerInfo = {
                    filename: status.filename,
                    display_name: status.custom_name || status.layer_name,
                    layer_name: status.layer_name,
                    created: new Date().toISOString()
                };
                
                // Save to localStorage for the map page to pick up
                localStorage.setItem('newSuitabilityLayer', JSON.stringify(layerInfo));
                
                // Notify user and offer navigation
                setTimeout(() => {
                    const shouldNavigate = confirm(`Suitability layer "${layerInfo.display_name}" created! Would you like to go to the Map page to view it?`);
                    
                    if (shouldNavigate) {
                        navigateToMap();
                    }
                    
                    // Reset status after delay
                    setTimeout(() => {
                        statusSpan.textContent = 'Ready to generate map';
                        statusSpan.style.color = '#4fc3f7';
                    }, 1000);
                }, 500);
                
                return;
                
            } else if (status.status === 'error') {
                throw new Error(status.message || 'Analysis failed');
            }
            
            // Update progress if available
            if (status.progress) {
                statusSpan.textContent = `${status.message} (${status.progress}%)`;
            }
            
        } catch (error) {
            console.error('Status polling error:', error);
            statusSpan.textContent = 'Error checking progress, continuing...';
        }
        
        attempts++;
    }
    
    // Timeout
    statusSpan.textContent = 'Analysis timeout - may still be processing';
    statusSpan.style.color = '#ffc107';
}

async function simulateProcessing(statusSpan) {
    // Fallback simulation if backend is not available
    statusSpan.textContent = 'Processing locally (fallback mode)...';
    statusSpan.style.color = '#ffc107';
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    statusSpan.textContent = 'Map generated (simulated)!';
    statusSpan.style.color = '#28a745';
    
    setTimeout(() => {
        const shouldNavigate = confirm('Suitability map processing completed! Would you like to go to the Map page?');
        
        if (shouldNavigate) {
            navigateToMap();
        }
        
        // Reset status after delay
        setTimeout(() => {
            statusSpan.textContent = 'Ready to generate map';
            statusSpan.style.color = '#4fc3f7';
        }, 1000);
    }, 500);
}

function navigateToMap() {
    // Send message to parent window to navigate
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            action: 'navigate',
            page: 'map'
        }, '*');
    } else {
        // Direct navigation if not in iframe
        window.location.href = 'map.html';
    }
}

function saveWeights() {
    const weights = {};
    const sliders = document.querySelectorAll('.suitability-slider');
    
    sliders.forEach(slider => {
        weights[slider.id] = parseInt(slider.value);
    });
    
    // Save to localStorage
    localStorage.setItem('suitabilityWeights', JSON.stringify(weights));
}

function loadSavedWeights() {
    const savedWeights = localStorage.getItem('suitabilityWeights');
    
    if (savedWeights) {
        try {
            const weights = JSON.parse(savedWeights);
            
            Object.keys(weights).forEach(sliderId => {
                const slider = document.getElementById(sliderId);
                const valueSpan = document.getElementById(sliderId.replace('-slider', '-value'));
                
                if (slider && valueSpan) {
                    slider.value = weights[sliderId];
                    valueSpan.textContent = weights[sliderId];
                }
            });
            
            updateTotalWeight();
        } catch (error) {
            console.error('Error loading saved weights:', error);
        }
    }
}

// Preset Management Functions
function initPresetManagement() {
    // Load presets dropdown
    loadPresetsDropdown();
    
    // Add event listeners for preset buttons
    document.getElementById('load-preset').addEventListener('click', loadSelectedPreset);
    document.getElementById('save-preset').addEventListener('click', saveNewPreset);
    document.getElementById('delete-preset').addEventListener('click', deleteSelectedPreset);
    
    // Auto-normalize checkbox (removed functionality - normalization only on save)
    // const autoNormalize = document.getElementById('auto-normalize');
    // Normalization now happens only when saving presets
}

function normalizeWeights(excludeKey = null) {
    const sliders = document.querySelectorAll('.suitability-slider');
    const values = {};
    let total = 0;
    
    // Get current values
    sliders.forEach(slider => {
        const value = parseInt(slider.value);
        values[slider.id] = value;
        total += value;
    });
    
    // If total is already 100, no need to normalize
    if (total === 100) {
        hideNormalizationIndicator();
        return;
    }
    
    // Calculate normalization factor
    const factor = 100 / total;
    let adjustedTotal = 0;
    const adjustedValues = {};
    
    // Apply normalization
    Object.keys(values).forEach(key => {
        adjustedValues[key] = Math.max(1, Math.round(values[key] * factor));
        adjustedTotal += adjustedValues[key];
    });
    
    // Fine-tune to exactly 100
    let difference = 100 - adjustedTotal;
    const sortedKeys = Object.keys(adjustedValues).sort((a, b) => adjustedValues[b] - adjustedValues[a]);
    
    for (let i = 0; i < Math.abs(difference) && i < sortedKeys.length; i++) {
        const key = sortedKeys[i % sortedKeys.length];
        if (difference > 0) {
            adjustedValues[key] += 1;
        } else if (adjustedValues[key] > 1) {
            adjustedValues[key] -= 1;
        }
    }
    
    // Update sliders and displays
    Object.keys(adjustedValues).forEach(key => {
        const slider = document.getElementById(key);
        const valueSpan = document.getElementById(key.replace('-slider', '-value'));
        
        if (slider && valueSpan) {
            slider.value = adjustedValues[key];
            valueSpan.textContent = adjustedValues[key];
        }
    });
    
    showNormalizationIndicator();
}

function normalizeAllWeights() {
    normalizeWeights();
}

function normalizeAllWeightsForSaving() {
    const sliders = document.querySelectorAll('.suitability-slider');
    const values = {};
    let total = 0;
    
    // Get current values
    sliders.forEach(slider => {
        const value = parseInt(slider.value);
        values[slider.id] = value;
        total += value;
    });
    
    // Calculate normalization factor
    const factor = 100 / total;
    let adjustedTotal = 0;
    const adjustedValues = {};
    
    // Apply normalization
    Object.keys(values).forEach(key => {
        adjustedValues[key] = Math.max(1, Math.round(values[key] * factor));
        adjustedTotal += adjustedValues[key];
    });
    
    // Fine-tune to exactly 100
    let difference = 100 - adjustedTotal;
    const sortedKeys = Object.keys(adjustedValues).sort((a, b) => adjustedValues[b] - adjustedValues[a]);
    
    for (let i = 0; i < Math.abs(difference) && i < sortedKeys.length; i++) {
        const key = sortedKeys[i % sortedKeys.length];
        if (difference > 0) {
            adjustedValues[key] += 1;
        } else if (adjustedValues[key] > 1) {
            adjustedValues[key] -= 1;
        }
    }
    
    // Update sliders and displays
    Object.keys(adjustedValues).forEach(key => {
        const slider = document.getElementById(key);
        const valueSpan = document.getElementById(key.replace('-slider', '-value'));
        
        if (slider && valueSpan) {
            slider.value = adjustedValues[key];
            valueSpan.textContent = adjustedValues[key];
        }
    });
}

function showNormalizationIndicator() {
    const indicator = document.getElementById('normalization-indicator');
    if (indicator) {
        indicator.style.display = 'block';
        indicator.textContent = '⚖️ Normalizing to 100%...';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 3000);
    }
}

function hideNormalizationIndicator() {
    const indicator = document.getElementById('normalization-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

function loadPresetsDropdown() {
    const dropdown = document.getElementById('preset-dropdown');
    const presets = getSavedPresets();
    
    // Clear existing options except the first one
    dropdown.innerHTML = '<option value="">Select a preset...</option>';
    
    // Add default preset
    const defaultOption = document.createElement('option');
    defaultOption.value = 'default';
    defaultOption.textContent = 'Default Weights';
    dropdown.appendChild(defaultOption);
    
    // Add saved presets
    Object.keys(presets).forEach(presetName => {
        const option = document.createElement('option');
        option.value = presetName;
        option.textContent = presetName;
        dropdown.appendChild(option);
    });
}

function getSavedPresets() {
    const saved = localStorage.getItem('suitabilityPresets');
    return saved ? JSON.parse(saved) : {};
}

function savePresets(presets) {
    localStorage.setItem('suitabilityPresets', JSON.stringify(presets));
}

function loadSelectedPreset() {
    const dropdown = document.getElementById('preset-dropdown');
    const selectedPreset = dropdown.value;
    
    if (!selectedPreset) {
        alert('Please select a preset to load.');
        return;
    }
    
    if (selectedPreset === 'default') {
        resetToDefaults();
        return;
    }
    
    const presets = getSavedPresets();
    const preset = presets[selectedPreset];
    
    if (!preset) {
        alert('Preset not found.');
        return;
    }
    
    // Load the preset weights
    Object.keys(preset).forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(sliderId.replace('-slider', '-value'));
        
        if (slider && valueSpan) {
            slider.value = preset[sliderId];
            valueSpan.textContent = preset[sliderId];
        }
    });
    
    updateTotalWeight();
    saveWeights();
    
    // Update status
    const statusSpan = document.getElementById('suitability-status');
    if (statusSpan) {
        statusSpan.textContent = `Loaded preset: ${selectedPreset}`;
        statusSpan.style.color = '#28a745';
        
        setTimeout(() => {
            statusSpan.textContent = 'Ready to generate map';
            statusSpan.style.color = '#4fc3f7';
        }, 2000);
    }
}

async function saveNewPreset() {
    const presetName = prompt('Enter a name for this preset:');
    
    if (!presetName || presetName.trim() === '') {
        return;
    }
    
    const cleanName = presetName.trim();
    
    if (cleanName === 'default') {
        alert('Cannot use "default" as preset name.');
        return;
    }
    
    // Get current weights
    const currentWeights = {};
    const sliders = document.querySelectorAll('.suitability-slider');
    
    sliders.forEach(slider => {
        const factorName = slider.id.replace('-slider', '');
        currentWeights[factorName] = parseInt(slider.value);
    });
    
    // Store the preset name for later use in map generation
    window.lastPresetName = cleanName;
    
    // Check if normalization is needed
    const total = Object.values(currentWeights).reduce((sum, val) => sum + val, 0);
    if (total !== 100) {
        // Show normalization message
        const statusSpan = document.getElementById('suitability-status');
        if (statusSpan) {
            statusSpan.textContent = `Normalizing weights from ${total}% to 100%...`;
            statusSpan.style.color = '#ffc107';
        }
        
        // Show normalization indicator
        showNormalizationIndicator();
        
        // Wait a moment to show the message
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Perform normalization
        normalizeAllWeightsForSaving();
        updateTotalWeight();
        
        // Recalculate weights after normalization
        sliders.forEach(slider => {
            currentWeights[slider.id] = parseInt(slider.value);
        });
    }
    
    // Save the preset
    const presets = getSavedPresets();
    presets[cleanName] = currentWeights;
    savePresets(presets);
    
    // Refresh dropdown
    loadPresetsDropdown();
    
    // Select the new preset
    document.getElementById('preset-dropdown').value = cleanName;
    
    // Update status
    const statusSpan = document.getElementById('suitability-status');
    if (statusSpan) {
        statusSpan.textContent = `Preset "${cleanName}" saved successfully!`;
        statusSpan.style.color = '#28a745';
        
        setTimeout(() => {
            statusSpan.textContent = 'Ready to generate map';
            statusSpan.style.color = '#4fc3f7';
        }, 2000);
    }
}

function deleteSelectedPreset() {
    const dropdown = document.getElementById('preset-dropdown');
    const selectedPreset = dropdown.value;
    
    if (!selectedPreset || selectedPreset === 'default') {
        alert('Please select a custom preset to delete.');
        return;
    }
    
    const confirmed = confirm(`Are you sure you want to delete the preset "${selectedPreset}"?`);
    
    if (!confirmed) {
        return;
    }
    
    const presets = getSavedPresets();
    delete presets[selectedPreset];
    savePresets(presets);
    
    // Refresh dropdown
    loadPresetsDropdown();
    
    // Update status
    const statusSpan = document.getElementById('suitability-status');
    if (statusSpan) {
        statusSpan.textContent = `Preset "${selectedPreset}" deleted`;
        statusSpan.style.color = '#dc3545';
        
        setTimeout(() => {
            statusSpan.textContent = 'Ready to generate map';
            statusSpan.style.color = '#4fc3f7';
        }, 2000);
    }
}

// Client-side analysis function for Netlify deployment
async function runClientSideAnalysis(weights, analysisName, statusSpan) {
    try {
        // Initialize client-side analyzer
        const analyzer = new ClientSuitabilityAnalyzer();
        
        // Update status
        statusSpan.textContent = 'Loading geospatial data...';
        statusSpan.style.color = '#ffc107';
        
        // Run analysis
        statusSpan.textContent = 'Processing environmental factors...';
        const result = await analyzer.calculateSuitability(weights);
        
        // Create downloadable file
        statusSpan.textContent = 'Generating analysis file...';
        const { blob, filename } = await analyzer.createDownloadableGeoTIFF(result, analysisName);
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Success
        statusSpan.textContent = `Analysis complete! Downloaded "${filename}"`;
        statusSpan.style.color = '#28a745';
        
    } catch (error) {
        console.error('Client-side analysis failed:', error);
        statusSpan.textContent = `Client analysis failed: ${error.message}`;
        statusSpan.style.color = '#dc3545';
    }
}