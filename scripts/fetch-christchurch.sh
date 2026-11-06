#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data
raw=$(mktemp)
trap 'rm -f "$raw"' EXIT
# A fixed central-city extract, including both halves of Hagley Park.
# Keep HTTPS verification and the inherited platform proxy enabled.
if ! curl --fail --show-error --silent --max-time 180 --get \
  --data-urlencode 'data=[out:json][timeout:120];(way[highway](-43.545,172.605,-43.515,172.650);way[building](-43.545,172.605,-43.515,172.650);way[leisure~"park|garden"](-43.545,172.605,-43.515,172.650);way[natural=water](-43.545,172.605,-43.515,172.650);relation[type=multipolygon][leisure~"park|garden"](-43.545,172.605,-43.515,172.650););out geom;' \
  https://overpass-api.de/api/interpreter -o "$raw"; then
  echo 'Overpass unavailable; fetching the same extent from the official OSM map API.'
  node scripts/fetch-osm-api.mjs "$raw"
fi
node scripts/prepare-christchurch.mjs "$raw" data/christchurch.json
