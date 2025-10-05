// Dynamic Layer Management for LUMINA Suitability Analysis
// Handles adding new custom suitability layers to the map

// 🔄 Dynamic layer management
function checkForNewLayers() {
  // Check if there's a new layer from the analysis
  const newLayerData = localStorage.getItem('newSuitabilityLayer');
  
  if (newLayerData) {
    try {
      const layerInfo = JSON.parse(newLayerData);
      
      // Add the new layer to RASTERS if not already present
      const existingLayer = RASTERS.find(r => r.file === `../data/${layerInfo.filename}`);
      
      if (!existingLayer) {
        console.log(`Adding new suitability layer: ${layerInfo.display_name}`);
        
        // Create new layer object
        const newLayer = {
          key: `Suitability_${layerInfo.layer_name}`,
          name: layerInfo.display_name,
          file: `../data/${layerInfo.filename}`,
          type: 'suitability',
          isCustom: true,
          created: layerInfo.created
        };
        
        // Add to RASTERS array
        RASTERS.push(newLayer);
        
        // Add to METRIC_DESCRIPTIONS if it exists
        if (typeof METRIC_DESCRIPTIONS !== 'undefined') {
          METRIC_DESCRIPTIONS[newLayer.key] = {
            title: `🎯 ${layerInfo.display_name}`,
            text: `Custom suitability analysis based on your selected environmental factor weights. This layer reflects your specific criteria for agricultural land evaluation.`
          };
        }
        
        // Add new layer button to sidebar
        addLayerToSidebar(newLayer);
        
        // Clear the localStorage entry
        localStorage.removeItem('newSuitabilityLayer');
        
        // Optionally load the new layer automatically
        setTimeout(() => {
          if (confirm(`New layer "${layerInfo.display_name}" is available! Would you like to load it now?`)) {
            loadRaster(newLayer.key);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error processing new layer:', error);
      localStorage.removeItem('newSuitabilityLayer');
    }
  }
}

function addLayerToSidebar(layer) {
  const layerListEl = document.getElementById('layer-list');
  if (!layerListEl) return;
  
  // Create layer button
  const btn = document.createElement('button');
  btn.className = 'layer-btn';
  btn.onclick = () => loadRaster(layer.key);
  
  // Add custom styling for custom layers
  btn.style.backgroundColor = '#1a3d5c';
  btn.style.border = '2px solid #4fc3f7';
  btn.style.position = 'relative';
  
  // Create content with custom indicator
  const content = document.createElement('div');
  content.style.display = 'flex';
  content.style.alignItems = 'center';
  content.style.justifyContent = 'space-between';
  
  const nameSpan = document.createElement('span');
  nameSpan.textContent = layer.name;
  
  const customBadge = document.createElement('span');
  customBadge.textContent = '⭐';
  customBadge.style.color = '#ffc107';
  customBadge.title = 'Custom Analysis Layer';
  
  content.appendChild(nameSpan);
  content.appendChild(customBadge);
  btn.appendChild(content);
  
  // Insert at the top of the layer list (after any existing suitability layers)
  const existingSuitabilityBtns = layerListEl.querySelectorAll('.layer-btn');
  let insertPosition = 0;
  
  // Find where to insert (after other suitability layers)
  for (let i = 0; i < existingSuitabilityBtns.length; i++) {
    const btnText = existingSuitabilityBtns[i].textContent.toLowerCase();
    if (btnText.includes('suitability')) {
      insertPosition = i + 1;
    } else {
      break;
    }
  }
  
  if (insertPosition < existingSuitabilityBtns.length) {
    layerListEl.insertBefore(btn, existingSuitabilityBtns[insertPosition]);
  } else {
    layerListEl.appendChild(btn);
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(checkForNewLayers, 1000);
    setInterval(checkForNewLayers, 30000); // Check every 30 seconds
  });
} else {
  // Page already loaded
  setTimeout(checkForNewLayers, 1000);
  setInterval(checkForNewLayers, 30000);
}