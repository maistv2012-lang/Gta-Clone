// Deliberately synthetic topology for integration testing, NOT geographic data.
// Never write this fixture to data/christchurch.json or ship it as an OSM extract.
export const syntheticMap = {
  version: 1, source: 'Synthetic test fixture — not OpenStreetMap', timestamp: null,
  bounds: { minX: -150, maxX: 150, minZ: -150, maxZ: 150 },
  roads: [
    { id: 1, nodes: [1, 2], points: [[0, -20], [0, 20]], width: 16, tags: { highway: 'pedestrian', name: 'Cathedral Square' } },
    { id: 2, nodes: [3, 2, 4], points: [[0, 150], [0, 20], [0, -150]], width: 12, tags: { highway: 'residential', name: 'Colombo Street' } },
    { id: 3, nodes: [4, 5, 6, 3], points: [[0, -150], [150, -150], [150, 150], [0, 150]], width: 12, tags: { highway: 'residential', oneway: 'yes' } },
    { id: 4, nodes: [2, 7, 8], points: [[0, 20], [-120, 20], [-120, -100]], width: 4, tags: { highway: 'footway' } },
  ],
  areas: [
    { id: 5, points: [[-150, -150], [-90, -150], [-90, 100], [-150, 100], [-150, -150]], tags: { leisure: 'park', name: 'Hagley Park' } },
    { id: 6, points: [[35, -40], [65, -40], [65, -10], [35, -10], [35, -40]], height: 20, tags: { building: 'yes' } },
  ],
};
