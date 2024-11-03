// Initialize the map and zoom to Kansas
let myMap = L.map("map", {
    center: [38.74532, -97.90073],
    zoom: 7
  });
  
  // Add event listener to the reset button
  document.getElementById("resetZoom").addEventListener("click", () => {
    myMap.setView([38.74532, -97.90073], 7); // Reset to Kansas view
    countySelect.value = ""; // Clear dropdown selection
    if (selectedCountyLayer) selectedCountyLayer.removeFrom(myMap); // Remove highlighted county layer
    selectedCountyLayer = null; // Clear reference to the selected layer
  });
  
  // Define and add the Thunderforest base layer
  let baseLayer = L.tileLayer('https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=739b4254a9964186a16c957b8b1b52dd', {
    attribution: '© Thunderforest'
  }).addTo(myMap);
  
  // Define buffer radii in meters
  const radius = 403; // For analysis calculations (1/4 mile)
  const displayRadius = 10000; // For visual display (6.2 mile)
  
  let selectedCountyLayer; // Track selected county layer for removal
  
  // Custom pane to ensure Census Demographic Map is always on the bottom
  myMap.createPane("censusPane");
  myMap.getPane("censusPane").style.zIndex = 200; // Low zIndex to ensure it appears beneath other layers
  
  // Load hospitals and cemeteries data
  let hospitals = [];
  let cemeteries = [];
  
  // Load hospitals data
  d3.json("https://raw.githubusercontent.com/Cenbull70/Group_Project_3/main/Data/hospitals.json")
    .then(data => hospitals = data.map(hospital => ({
      name: hospital.name,
      latitude: hospital.lat,
      longitude: hospital.long
    })))
    .catch(() => console.log("Failed to load hospital data"));
  
  // Load cemeteries data
  d3.json("https://raw.githubusercontent.com/Cenbull70/Group_Project_3/main/Data/cemetery.json")
    .then(data => cemeteries = data.map(cemetery => ({
      name: cemetery.name,
      latitude: cemetery.latitude,
      longitude: cemetery.longitude
    })))
    .catch(() => console.log("Failed to load cemetery data"));
  
  // Sidebar update function for nearby places
  function updateSidebar(hauntedLocation, nearbyHospitals, nearbyCemeteries) {
    const locationInfo = document.getElementById("locationInfo");
    locationInfo.innerHTML = `<h3>${hauntedLocation}</h3>`;
    
    // Add hospitals within 5 miles
    if (nearbyHospitals.length) {
      locationInfo.innerHTML += `<h4>Hospitals within 5 miles:</h4><ul>`;
      nearbyHospitals.forEach(hospital => locationInfo.innerHTML += `<li>${hospital.name || "Unnamed Hospital"}</li>`);
      locationInfo.innerHTML += `</ul>`;
    } else {
      locationInfo.innerHTML += `<p>No hospitals within 5 miles.</p>`;
    }
    
    // Add cemeteries within 5 miles
    if (nearbyCemeteries.length) {
      locationInfo.innerHTML += `<h4>Cemeteries within 5 miles:</h4><ul>`;
      nearbyCemeteries.forEach(cemetery => locationInfo.innerHTML += `<li>${cemetery.name || "Unnamed Cemetery"}</li>`);
      locationInfo.innerHTML += `</ul>`;
    } else {
      locationInfo.innerHTML += `<p>No cemeteries within 5 miles.</p>`;
    }
  }
  
  // Load haunted places, county boundaries, census data, and historical sites
  Promise.all([
    d3.json("https://raw.githubusercontent.com/Cenbull70/Group_Project_3/main/Data/haunted_places.geojson"),
    d3.json("https://raw.githubusercontent.com/Cenbull70/Group_Project_3/main/Data/kansas-with-county-boundaries_1099.geojson"),
    d3.json("https://raw.githubusercontent.com/Cenbull70/Group_Project_3/main/Data/us_census_data_2024.json"),
    d3.json("https://raw.githubusercontent.com/Cenbull70/Group_Project_3/main/Data/historical_sites.geojson")
  ]).then(([hauntedData, countyData, censusData, historicalData]) => {
    
    // Haunted Places Heat Layer
    const heatData = hauntedData.features.map(feature => [feature.geometry.coordinates[1], feature.geometry.coordinates[0], 0.5]);
    const heatLayer = L.heatLayer(heatData, { radius: 25, blur: 15, maxZoom: 8 });
    
    // Haunted Places Layer with Click Event to Show Nearby Places
    const hauntedLayer = L.geoJSON(hauntedData, {
      onEachFeature: (feature, layer) => {
        const { location, city, state, description } = feature.properties;
        const hauntedPopup = `<h4>Haunted Place: ${location}</h4><hr><p>${city}, ${state}</p><p>Incident: ${description}</p>`;
        layer.bindPopup(hauntedPopup);
  
        // Add click event to display nearby hospitals and cemeteries
        layer.on("click", () => {
          const hauntedPoint = turf.point(feature.geometry.coordinates);
  
          // Filter hospitals within 5 miles
          const nearbyHospitals = hospitals.filter(hospital => {
            const hospitalPoint = turf.point([hospital.longitude, hospital.latitude]);
            const distance = turf.distance(hauntedPoint, hospitalPoint, { units: "miles" });
            return distance <= 5;
          });
  
          // Filter cemeteries within 5 miles
          const nearbyCemeteries = cemeteries.filter(cemetery => {
            const cemeteryPoint = turf.point([cemetery.longitude, cemetery.latitude]);
            const distance = turf.distance(hauntedPoint, cemeteryPoint, { units: "miles" });
            return distance <= 5;
          });
  
          // Update sidebar with information about the nearby hospitals and cemeteries
          updateSidebar(location, nearbyHospitals, nearbyCemeteries);
        });
      },
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 8, color: "white", fillColor: "purple", fillOpacity: 0.5, weight: 1 }),
      pane: "markerPane" // Ensure it's on a pane above the county layer
    }).addTo(myMap);
  
    // Create custom pane for county boundaries
    myMap.createPane("countyPane");
    myMap.getPane("countyPane").style.zIndex = 350; // Set a lower z-index for county boundaries
  
    // Load county boundaries
    const countyLayer = L.geoJSON(countyData, {
      style: { color: "gray", weight: 1.5, fillOpacity: 0 },
      pane: "countyPane",
      interactive: false // Prevents the county layer from capturing clicks
    }).addTo(myMap);
  
    // Populate county dropdown
    const countySelect = document.getElementById("countySelect");
    countyData.features.map(feature => feature.properties.name).sort().forEach(countyName => {
      const option = document.createElement("option");
      option.value = countyName;
      option.text = countyName;
      countySelect.add(option);
    });
  
    countySelect.addEventListener("change", () => {
      const selectedCounty = countySelect.value;
      const county = countyData.features.find(feature => feature.properties.name === selectedCounty);
  
      if (county) {
        if (selectedCountyLayer) selectedCountyLayer.removeFrom(myMap); // Remove previous selected county
        selectedCountyLayer = L.geoJSON(county, {
          style: { color: "blue", weight: 2, fillOpacity: 0.1 }, // Reduced fill opacity
          pane: "countyPane",
          interactive: false // Prevents county selection layer from blocking clicks
        }).addTo(myMap);
        myMap.fitBounds(selectedCountyLayer.getBounds());
      }
    });
  
    // Census demographic Layer
    const kansasData = censusData
      .filter(item => item.state === "Kansas")
      .map(item => ({
        ...item,
        county: item.county.replace(" County", "").trim(),
        population: parseInt(item.population.replace(/,/g, ""), 10)
      }));
  
    kansasData.forEach(county => {
      const countyFeature = countyData.features.find(
        feature => feature.properties.name === county.county
      );
      if (countyFeature) {
        countyFeature.properties.population = county.population;
      } else {
        console.log(`No match for county: ${county.county}`);
      }
    });
  
    const getColor = (population) => {
      return population > 100000 ? '#800026' :
             population > 50000  ? '#BD0026' :
             population > 20000  ? '#E31A1C' :
             population > 10000  ? '#FC4E2A' :
             population > 5000   ? '#FD8D3C' :
             population > 2000   ? '#FEB24C' :
             population > 1000   ? '#FED976' :
                                    '#FFEDA0';
    };
  
    const heatmapLayer = L.geoJSON(countyData, {
      style: (feature) => {
        const population = feature.properties.population || 0;
        return {
          fillColor: getColor(population),
          weight: 1,
          opacity: 1,
          color: 'white',
          fillOpacity: 0.7
        };
      },
      onEachFeature: (feature, layer) => {
        const population = feature.properties.population || "Data not available";
        layer.bindPopup(
          `<strong>${feature.properties.name} County</strong><br>Population: ${population}`
        );
      }, 
      pane: "censusPane" // Ensures this layer appears at the bottom
    });
  
    // Historical Sites Layer
    const historicalLayer = L.geoJSON(historicalData, {
      onEachFeature: (feature, layer) => {
        const { Place_Name, City, State = "Unknown State" } = feature.properties;
        layer.bindPopup(`<h4>Historical Site: ${Place_Name}</h4><hr><p>${City}, ${State}</p>`);
      },
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 7, color: "white", fillColor: "blue", fillOpacity: 0.4, weight: 1 })
    });
  
    const bufferLayerGroup = L.layerGroup(); 
    const displayBufferLayerGroup = L.layerGroup();
  
    const hauntedPlaces = turf.featureCollection(hauntedData.features);
    const historicalSites = turf.featureCollection(historicalData.features);
    let countWithinRadius = 0;
  
    historicalSites.features.forEach(site => {
      const siteBuffer = turf.buffer(site, radius, { units: 'meters' });
      const bufferLayer = L.geoJSON(siteBuffer, { style: { color: 'white', fillColor: 'gray', weight: 1, fillOpacity: 0.3 }});
      bufferLayerGroup.addLayer(bufferLayer);
  
      const hauntedWithinBuffer = turf.pointsWithinPolygon(hauntedPlaces, siteBuffer);
      countWithinRadius += hauntedWithinBuffer.features.length;
  
      const displayBuffer = turf.buffer(site, displayRadius, { units: 'meters' });
      const displayBufferLayer = L.geoJSON(displayBuffer, { style: { color: "rgb(128, 125, 186)", weight: 1, fillOpacity: 0.5 }}).bindPopup(`Display Buffer Radius: ${displayRadius} meters`);
      displayBufferLayerGroup.addLayer(displayBufferLayer);
    });
  
    const totalHauntedPlaces = hauntedPlaces.features.length;
    const percentageNearHistorical = (countWithinRadius / totalHauntedPlaces) * 100;
    console.log(`Number of haunted places within 1/4 mile of a historical site: ${countWithinRadius}`);
    console.log(`Percentage of haunted places near historical sites: ${percentageNearHistorical.toFixed(2)}%`);
  
    // Add color ramp legend for Census demographic map
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "info legend");
      div.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'; // white background for the legend
      div.style.padding = '8px'; // Padding around the legend 
      div.style.borderRadius = '10px'; // Optional rounded corners
      const populationRanges = [0, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
      const colors = ["#FFEDA0", "#FED976", "#FEB24C", "#FD8D3C", "#FC4E2A", "#E31A1C", "#BD0026", "#800026"];
      
  
      // Create legend labels with the corresponding color ramp
      for (let i = 0; i < populationRanges.length; i++) {
        const from = populationRanges[i];
        const to = populationRanges[i + 1];
        div.innerHTML += `
          <i style="background:${colors[i]}; width: 18px; height: 18px; display: inline-block; margin-right: 5px;"></i>
          ${from}${to ? '&ndash;' + to : '+'}<br>
        `;
      }
  
      return div;
    };
  
    // Initially hide the legend
    legend.addTo(myMap);
    legend.getContainer().style.display = 'none';
  
    // Show or hide the legend based on the census heatmap layer toggle
    myMap.on('overlayadd', function (eventLayer) {
      if (eventLayer.name === 'Census Demographic Map') { 
        legend.getContainer().style.display = 'block';
      }
    });
    myMap.on('overlayremove', function (eventLayer) {
      if (eventLayer.name === 'Census Demographic Map') { 
        legend.getContainer().style.display = 'none';
      }
    });
  
    // Layer Controls
    const overlayMaps = {
      "Haunted Places": hauntedLayer,
      "Historical Sites": historicalLayer,
      "Heat Map of Haunted Places": heatLayer,
      "Census Demographic Map": heatmapLayer,
      "Display Only Analysis Buffers": displayBufferLayerGroup
    };
  
    L.control.layers({ "Base Map": baseLayer }, overlayMaps, { collapsed: false }).addTo(myMap);
  
    // Add only haunted layer on initial load
    hauntedLayer.addTo(myMap);
  }).catch(error => console.log("Failed to load one of the data files:", error));
  