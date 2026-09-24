# Terrain relief feature

Status: design proposal  
Branch: `feature/terrain-relief`

## Goal

Add readable terrain relief to the rally map without breaking the offline-first model or the existing downloaded-area viewport constraints.

The first user-facing version should be **2D hillshade** over the existing vector basemap. The data pipeline should also be suitable for a later optional 3D terrain mode and contour lines.

## Why hillshade first

MapLibre renders hillshade and 3D terrain from a `raster-dem` source. Our current basemap is a vector PMTiles archive, so elevation must be a separate data source.

Hillshade is the best first increment because it:

- makes slopes, valleys and ridges visible while keeping the current top-down navigation;
- does not require changing the normal camera pitch or interaction model;
- preserves readability of rally geometry, roads and labels;
- can use the same DEM tiles that a later 3D mode would use;
- has a smaller UX and rendering risk than making the map 3D immediately.

## Proposed data source

Use a Terrarium-encoded DEM source, initially Mapterhorn:

- global 30 m base coverage;
- public ZXY endpoint and PMTiles archives;
- Terrarium encoding supported directly by MapLibre;
- PMTiles makes it compatible with the same range-request approach already used for the Protomaps basemap.

Do not couple rendering code to Mapterhorn specifically. Keep the terrain endpoint/configuration behind one module so the provider can be replaced later.

Suggested worker route:

`/api/terrain.pmtiles`

Suggested upstream for the first prototype:

`https://download.mapterhorn.com/planet.pmtiles`

The Cloudflare worker should proxy byte ranges exactly like `/api/basemap.pmtiles`.

## Offline storage model

Do **not** store DEM tiles under the same storage id as vector basemap tiles because `saveMapTile(storageId,z,x,y,...)` keys only by storage id and coordinates.

Use a separate terrain namespace derived from the map revision:

```
vector:  <storageId>
terrain: <storageId>@terrain
```

No IndexedDB schema migration is required for the first implementation because both OPFS and the legacy tile store already namespace tiles by the supplied id.

Offline map metadata should evolve toward:

```js
offlineMap: {
  ready: true,
  storageId,
  bounds,
  minZoom,
  maxZoom,
  tileCount,
  bytes,

  terrain: {
    ready: true,
    storageId: `${storageId}@terrain`,
    minZoom,
    maxZoom,
    tileCount,
    bytes,
    encoding: 'terrarium',
    tileSize: 512,
    source: 'Mapterhorn'
  }
}
```

Deleting or replacing a rally map must remove both namespaces atomically/best-effort.

## Download policy

The existing vector download plan uses z6..z14 and caps the total at 2200 tiles.

Terrain should have its **own budget**, because raster DEM tiles are much larger than vector tiles. Do not blindly mirror all vector zooms.

Initial proposal:

- terrain min zoom: 6;
- desired terrain max zoom: 12;
- calculate the plan from the exact same buffered race bounds;
- cap terrain tile count separately;
- expose estimated/actual DEM bytes in download progress;
- if terrain download fails, keep the successfully downloaded vector map and report terrain as unavailable rather than invalidating the whole rally pack.

At z13+ MapLibre can overzoom the z12 DEM for hillshade. For rally viewing this should be tested before spending storage on higher DEM zooms.

## Rendering architecture

Add a small terrain module rather than growing `src/map.js` or `src/map/style.js`.

Suggested modules:

- `src/map/terrain.js`
  - terrain source factory;
  - hillshade layer factory;
  - optional 3D terrain configuration;
  - visibility helpers.
- `src/terrain-offline.js`
  - terrain download plan;
  - DEM download;
  - terrain protocol registration;
  - cleanup helpers.

Suggested MapLibre style shape:

```js
sources['offline-terrain'] = {
  type: 'raster-dem',
  tiles: [`rfmterrain://<terrainStorageId>/{z}/{x}/{y}`],
  encoding: 'terrarium',
  tileSize: 512,
  minzoom: terrain.minZoom,
  maxzoom: terrain.maxZoom,
  bounds: [...]
};

layers.push({
  id: 'terrain-hillshade',
  type: 'hillshade',
  source: 'offline-terrain',
  paint: {
    'hillshade-exaggeration': 0.35
  }
});
```

The hillshade layer should sit above land/background fills but below roads, labels and RallyFans geometry.

## Online/offline behavior

When an offline rally pack with terrain is open:

- use only downloaded terrain tiles;
- never silently fetch missing terrain from the internet;
- keep the current maxBounds/minZoom policy based on the downloaded race area.

When there is no offline pack:

- terrain may use the proxied online source;
- failure of the DEM source must degrade to the normal flat map.

This keeps the map deterministic offline and prevents panning into terrain that was never downloaded.

## UX

MVP control:

**Рельеф: Вкл / Выкл**

Store the preference separately from rally data.

Default proposal:

- enabled when terrain is available;
- hide/disable the toggle when no terrain source is available;
- do not introduce pitch/rotation changes in MVP.

Possible second increment:

**3D-рельеф**

When enabled:

- call `map.setTerrain({source:'...', exaggeration: 1})`;
- allow pitch;
- add a reset-to-2D action.

Do not enable 3D by default.

## Future: contour lines

Contour lines are useful for rally spectator navigation, but should be a separate layer and increment. They can be generated client-side from the same DEM with `maplibre-contour`, avoiding a second elevation dataset.

Potential modes:

- hillshade only;
- hillshade + contour lines;
- 3D terrain.

## Testing

Prefer unit tests.

### Unit

- terrain tile plan respects bounds and tile budget;
- terrain namespace cannot collide with vector namespace;
- terrain metadata normalization;
- cleanup removes vector and terrain revisions;
- style factory puts hillshade below roads/labels/rally overlays;
- unavailable terrain produces a flat map without throwing;
- offline source URLs never fall back to network.

### UI / integration

Keep this small:

- map opens with downloaded terrain and hillshade layer exists;
- toggle hides/shows hillshade;
- offline mode does not request external DEM URLs;
- vector-only legacy rally packs still open correctly.

## Implementation increments

1. **Data plumbing**
   - worker range proxy for terrain PMTiles;
   - terrain storage namespace;
   - terrain download plan/protocol;
   - unit tests.

2. **Hillshade MVP**
   - add DEM source/layer;
   - add toggle + preference;
   - download progress/storage reporting;
   - unit + minimal UI test.

3. **Polish**
   - tune hillshade styling against forest/mountain rally stages;
   - storage/zoom measurements on real packs;
   - error states and legacy-pack behavior.

4. **Optional later work**
   - contour lines;
   - 3D terrain/pitch;
   - elevation at a tapped point;
   - elevation profile for a rally stage.

## Open decisions for the prototype

The main thing to measure before shipping is **terrain pack size**. The code should log/report:

- number of DEM tiles;
- compressed bytes;
- download duration;
- max DEM zoom selected.

That measurement should decide whether z12 is the default ceiling or whether z11 is visually sufficient.
