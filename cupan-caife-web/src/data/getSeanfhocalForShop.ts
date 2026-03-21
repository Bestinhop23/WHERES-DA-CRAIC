import seanfhocailTownMap from '../../seanfhocail_town_map.json';

export function getSeanfhocalForShop(shop) {
  // Try to match by name and coordinates (rounded for floating point safety)
  const key = `${shop.name}|${shop.latitude.toFixed(5)}|${shop.longitude.toFixed(5)}`;
  // Fallback: try by name only
  const entry = Object.entries(seanfhocailTownMap).find(([k, v]) => v.town === shop.name);
  if (seanfhocailTownMap[key]) return seanfhocailTownMap[key];
  if (entry) return entry[1];
  return null;
}
