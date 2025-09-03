Map.addLayer(geometry)
// 1. Load Ethiopia boundary
var ethiopia = ee.FeatureCollection('FAO/GAUL/2015/level0')
                 .filter(ee.Filter.eq('ADM0_NAME', 'Ethiopia'));
//Map.addLayer(ethiopia, {color: 'black'}, 'Ethiopia Boundary');

// 2. Load HydroBASINS level 4
var basins = ee.FeatureCollection('WWF/HydroSHEDS/v1/Basins/hybas_4');

// 3. Filter basins within/around Ethiopia
var ethiopiaBasins = basins.filterBounds(ethiopia);

// 4. Define your three points
var point1 = ee.Geometry.Point([39.278077900852374, 4.102983590643979]);
var point2 = ee.Geometry.Point([37.663087666477374, 4.365935473792171]);
var point3 = ee.Geometry.Point([40.585450947727374, 5.919665488128887]);

// Optional: display the points
//Map.addLayer(point1, {color: 'red'}, 'Point 1');
//Map.addLayer(point2, {color: 'green'}, 'Point 2');
//Map.addLayer(point3, {color: 'blue'}, 'Point 3');

// 5. Select HydroBASINS features that intersect the points
var basin1 = ethiopiaBasins.filterBounds(point1);
var basin2 = ethiopiaBasins.filterBounds(point2);
var basin3 = ethiopiaBasins.filterBounds(point3);

// 6. Merge selected basins and remove duplicates
var ganaleDawaBasin = basin1.merge(basin2).merge(basin3).distinct(['HYBAS_ID']);

// 7. Union the basin polygons into one geometry
var ganaleDawaGeometry = ganaleDawaBasin.union().geometry();

// 8. Clip to Ethiopia boundary
var ethiopiaGeometry = ethiopia.geometry();
var clippedGanaleDawa = ganaleDawaGeometry.intersection(ethiopiaGeometry, ee.ErrorMargin(1));

// 9. Display final clipped basin
//Map.centerObject(clippedGanaleDawa, 7);
//Map.addLayer(clippedGanaleDawa, {color: 'blue'}, 'Clipped Ganale Dawa Basin');
//Map.addLayer(ethiopia, {color: 'black'}, 'Ethiopia Boundary');

// ✅ Step 1: Define Region of Interest (Dire Dawa, Ethiopia)
//var region = ee.FeatureCollection("FAO/GAUL/2015/level1")
//               .filter(ee.Filter.eq('ADM1_NAME', 'Dire Dawa'));
var region = clippedGanaleDawa
// ✅ Load Dynamic World LULC Dataset (2015–2021)
function getYearImage(y) {
  var year = ee.Number(y).int();
  var start = ee.Date.fromYMD(year, 1, 1);
  var end   = ee.Date.fromYMD(year, 12, 31);
  
  return ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
           .filterDate(start, end)
           .median()
           .clip(region)
           .select('label')
           .set('year', year);
}

// ✅ Create ImageCollection for 2015–2021
var years = ee.List.sequence(2015, 2021);
var lulcCol = ee.ImageCollection.fromImages(
  years.map(function(y){ return getYearImage(y); })
);

// ✅ Select Baseline Year (2021)
var lulc2021 = lulcCol.filter(ee.Filter.eq('year', 2021)).first();

// ✅ Class codes
var GRASS = 2;
var TREE = 1;
var SHRUB = 5;

// ✅ Scenario 1: Convert Grass + Trees → Shrub
var condition1 = lulc2021.eq(GRASS).or(lulc2021.eq(TREE));
var scenario1 = lulc2021.where(condition1, SHRUB);

// ✅ Scenario 2: Convert HALF of Shrub → Grass
var shrubMask = lulc2021.eq(SHRUB);
var randomMask = ee.Image.random().lt(0.5); // ~50%
var shrubToGrass = shrubMask.and(randomMask);
var scenario2 = lulc2021.where(shrubToGrass, GRASS);

// ✅ SCENARIO 3 ADDED: Convert 100% Shrubland to Grassland
var shrubMask3 = lulc2021.eq(SHRUB);
var scenario3 = lulc2021.where(shrubMask3, GRASS);

// ✅ Visualization parameters
var dynamicVis = {
  bands: ['label'],
  min: 0,
  max: 8,
  palette: [
    '419BDF','397D49','88B053','7A87C6','E49635',
    'DFC35A','C4281B','A59B8F','B39FE1'
  ]
};

// ✅ Display Layers
Map.centerObject(region, 10);
Map.addLayer(lulc2021, dynamicVis, 'Baseline 2021');
Map.addLayer(scenario1, dynamicVis, 'Scenario 1: Grass+Tree → Shrub');
Map.addLayer(scenario2, dynamicVis, 'Scenario 2: Half Shrub → Grass');
Map.addLayer(scenario3, dynamicVis, 'Scenario 3: 100% Shrub → Grass'); // Added to map
//Map.addLayer(region.style({color: 'blue', fillColor: '00000000'}), {}, 'Dire Dawa Region');

// ✅ Legend Panel
// ✅ Create Legend (Bottom-Left with Bigger Text)
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '10px',
    backgroundColor: 'white'
  }
});
legend.add(ui.Label('Dynamic World Classes', {
  fontWeight: 'bold',
  fontSize: '16px',    // ✅ Increased Title Font Size
  margin: '0 0 6px 0'
}));

// ✅ Class Names & Colors (Snow/Ice Removed)
var classNames = ['Water','Trees','Grass','Flooded Veg.','Crops','Shrub & Scrub','Built Area','Bare Ground'];
var classColors = ['419BDF','397D49','88B053','7A87C6','E49635','DFC35A','C4281B','A59B8F'];

// ✅ Arrange Legend Items in 4 Columns
var columns = 4;
for (var i = 0; i < classNames.length; i += columns) {
  var row = ui.Panel({layout: ui.Panel.Layout.flow('horizontal')});

  for (var j = 0; j < columns; j++) {
    var index = i + j;
    if (index < classNames.length) {
      var item = ui.Panel({
        widgets: [
          ui.Label({
            style: {
              backgroundColor: '#' + classColors[index],
              width: '18px',       // ✅ Slightly Bigger Square
              height: '18px',
              margin: '0 6px 0 0'
            }
          }),
          ui.Label(classNames[index], {
            fontSize: '14px',     // ✅ Bigger Font for Class Names
            margin: '0 10px 0 0'
          })
        ],
        layout: ui.Panel.Layout.flow('horizontal'),
        style: {margin: '3px 8px'}
      });
      row.add(item);
    }
  }
  legend.add(row);
}

Map.add(legend);


// ✅ Function to compute area by class (ha)
function computeArea(img, name){
  var pixelArea = ee.Image.pixelArea().divide(10000); // ha
  var stats = pixelArea.addBands(img).reduceRegion({
    reducer: ee.Reducer.sum().group({groupField:1, groupName:'class'}),
    geometry: region,
    scale: 10,
    maxPixels: 1e13
  });
  
  var result = ee.List(stats.get('groups')).map(function(el){
    el = ee.Dictionary(el);
    return ee.Dictionary({
      'Scenario': name,
      'Class': el.get('class'),
      'Area_ha': el.get('sum')
    });
  });
  return result;
}

// ✅ Compute for Baseline & Scenarios (Scenario 3 added)
var areas = computeArea(lulc2021, 'Baseline 2021')
              .cat(computeArea(scenario1, 'Scenario 1'))
              .cat(computeArea(scenario2, 'Scenario 2'))
              .cat(computeArea(scenario3, 'Scenario 3')); // Added to area calculation

print('Area (ha) by class for all scenarios', areas);

// ✅ Export Baseline
Export.image.toDrive({
  image: lulc2021,
  description: 'Baseline_2021',
  folder: 'GEE_Exports',       // Change folder name
  fileNamePrefix: 'Baseline_2021',
  region: region,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

// ✅ Export Scenario 1
Export.image.toDrive({
  image: scenario1,
  description: 'Scenario1_GrassTree_to_Shrub',
  folder: 'GEE_Exports',
  fileNamePrefix: 'Scenario1_GrassTree_to_Shrub',
  region: region,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

// ✅ Export Scenario 2
Export.image.toDrive({
  image: scenario2,
  description: 'Scenario2_Half_Shrub_to_Grass',
  folder: 'GEE_Exports',
  fileNamePrefix: 'Scenario2_Half_Shrub_to_Grass',
  region: region,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

// ✅ EXPORT SCENARIO 3 ADDED
Export.image.toDrive({
  image: scenario3,
  description: 'Scenario3_All_Shrub_to_Grass',
  folder: 'GEE_Exports',
  fileNamePrefix: 'Scenario3_All_Shrub_to_Grass',
  region: region,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});