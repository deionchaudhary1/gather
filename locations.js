// City centers support approximate discovery without a geocoding service.
export const cities = {
 Berkeley: [37.8715, -122.2730], Oakland: [37.8044, -122.2712],
 Alameda: [37.7652, -122.2416], 'San Francisco': [37.7749, -122.4194],
 Richmond: [37.9358, -122.3477], 'Walnut Creek': [37.9101, -122.0652],
 Fremont: [37.5483, -121.9886], 'San Jose': [37.3382, -121.8863],
 'Santa Clara': [37.3541, -121.9552], Fairfield: [38.2494, -122.0400],
};
export function coordinates(value) {
 if (!value || value.latitude === null || value.longitude === null || value.latitude === '' || value.longitude === '') return null;
 const latitude = Number(value.latitude), longitude = Number(value.longitude);
 return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude)<=90 && Math.abs(longitude)<=180 ? {latitude,longitude} : null;
}
export function cityCoordinates(city) {
 const entry=Object.entries(cities).find(([name])=>name.toLowerCase()===String(city).toLowerCase());
 return entry ? {latitude:entry[1][0],longitude:entry[1][1]} : null;
}
export function profileLocation(profile) {
 return profile.locationMode==='device' ? coordinates(profile) : cityCoordinates(profile.baseCity || 'Berkeley');
}
export function distanceMiles(event,profile) {
 const origin=profileLocation(profile);
 const destination=coordinates(event.coordinates) || destinationCoordinates(event.city);
 if (!origin || !destination) return null;
 const radians=x=>x*Math.PI/180;
 const deltaLat=radians(destination.latitude-origin.latitude),deltaLon=radians(destination.longitude-origin.longitude);
 const a=Math.sin(deltaLat/2)**2+Math.cos(radians(origin.latitude))*Math.cos(radians(destination.latitude))*Math.sin(deltaLon/2)**2;
 return 3958.7613*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
}
export function locationLabel(profile) {
 return profile.locationMode==='device' ? 'your saved location' : profile.baseCity || 'Berkeley';
}
// Destination centers are separate from supported home-city choices.
export const destinationCenters={...cities,'Los Angeles':[34.0522,-118.2437],'Fairfax County':[38.8462,-77.3064]};
export function destinationCoordinates(city){
 const entry=Object.entries(destinationCenters).find(([name])=>name.toLowerCase()===String(city).toLowerCase());
 return entry?{latitude:entry[1][0],longitude:entry[1][1]}:null;
}
export function geographicStatus(event,profile){
 const distance=distanceMiles(event,profile);
 if(distance===null||event.locationQuality==='title'||event.locationConflict)return 'unknown';
 if(distance>Number(profile.radius))return 'outside';
 return 'inside';
}
export function visibleNearby(event,profile,includeUnknown=false){
 const status=geographicStatus(event,profile);return status==='inside'||includeUnknown&&status==='unknown';
}
