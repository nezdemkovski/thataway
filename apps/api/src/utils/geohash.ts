// Geohash: the world cut into cells whose keys sort by location. Enough of it for tiles:
// encode, the cell's bounds, and the eight neighbours. No dependency, a few dozen lines.

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export const encodeGeohash = (latitude: number, longitude: number, precision: number): string => {
  let minLat = -90;
  let maxLat = 90;
  let minLon = -180;
  let maxLon = 180;
  let hash = "";
  let bits = 0;
  let value = 0;
  let evenBit = true;
  while (hash.length < precision) {
    if (evenBit) {
      const mid = (minLon + maxLon) / 2;
      if (longitude >= mid) {
        value = value * 2 + 1;
        minLon = mid;
      } else {
        value = value * 2;
        maxLon = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (latitude >= mid) {
        value = value * 2 + 1;
        minLat = mid;
      } else {
        value = value * 2;
        maxLat = mid;
      }
    }
    evenBit = !evenBit;
    bits += 1;
    if (bits === 5) {
      hash += BASE32[value];
      bits = 0;
      value = 0;
    }
  }
  return hash;
};

export const geohashBounds = (hash: string): BoundingBox => {
  let minLat = -90;
  let maxLat = 90;
  let minLon = -180;
  let maxLon = 180;
  let evenBit = true;
  for (const char of hash) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error(`Not a geohash: ${hash}`);
    for (let bit = 4; bit >= 0; bit -= 1) {
      const set = (index >> bit) & 1;
      if (evenBit) {
        const mid = (minLon + maxLon) / 2;
        if (set) minLon = mid;
        else maxLon = mid;
      } else {
        const mid = (minLat + maxLat) / 2;
        if (set) minLat = mid;
        else maxLat = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { south: minLat, west: minLon, north: maxLat, east: maxLon };
};

export const geohashCenter = (hash: string) => {
  const b = geohashBounds(hash);
  return { latitude: (b.south + b.north) / 2, longitude: (b.west + b.east) / 2 };
};

/** The cell and its eight neighbours, by stepping one cell in each direction. */
export const geohashNeighbourhood = (hash: string): string[] => {
  const b = geohashBounds(hash);
  const height = b.north - b.south;
  const width = b.east - b.west;
  const center = geohashCenter(hash);
  const cells = new Set<string>();
  for (const dy of [-1, 0, 1]) {
    for (const dx of [-1, 0, 1]) {
      const latitude = Math.max(-90, Math.min(90, center.latitude + dy * height));
      const longitude = ((center.longitude + dx * width + 540) % 360) - 180;
      cells.add(encodeGeohash(latitude, longitude, hash.length));
    }
  }
  return [...cells];
};

/** Every cell of `precision` characters that touches the box. */
export const geohashesCovering = (box: BoundingBox, precision: number): string[] => {
  const sample = geohashBounds(encodeGeohash(box.south, box.west, precision));
  const height = sample.north - sample.south;
  const width = sample.east - sample.west;
  const cells = new Set<string>();
  for (let latitude = box.south; latitude <= box.north + height; latitude += height) {
    for (let longitude = box.west; longitude <= box.east + width; longitude += width) {
      const hash = encodeGeohash(Math.min(latitude, 90), Math.min(longitude, 180), precision);
      const b = geohashBounds(hash);
      if (
        b.north >= box.south &&
        b.south <= box.north &&
        b.east >= box.west &&
        b.west <= box.east
      ) {
        cells.add(hash);
      }
    }
  }
  return [...cells];
};
