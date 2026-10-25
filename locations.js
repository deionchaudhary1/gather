// City centers support approximate discovery without a geocoding service.
export const cities = {
 Berkeley: [37.8715, -122.2730], Oakland: [37.8044, -122.2712],
 Alameda: [37.7652, -122.2416], 'San Francisco': [37.7749, -122.4194],
 Richmond: [37.9358, -122.3477], 'Walnut Creek': [37.9101, -122.0652],
 Fremont: [37.5483, -121.9886], 'San Jose': [37.3382, -121.8863],
 'Santa Clara': [37.3541, -121.9552], Fairfield: [38.2494, -122.0400],
 Concord:[37.9780,-122.0311], Pleasanton:[37.6624,-121.8747], Dublin:[37.7022,-121.9358],
 Livermore:[37.6819,-121.7680], Hayward:[37.6688,-122.0808], 'San Leandro':[37.7249,-122.1561],
 'San Mateo':[37.5630,-122.3255], 'Redwood City':[37.4852,-122.2364], 'Palo Alto':[37.4419,-122.1430],
 'Mountain View':[37.3861,-122.0839], Sunnyvale:[37.3688,-122.0363], 'San Rafael':[37.9735,-122.5311],
 Petaluma:[38.2324,-122.6367], 'Santa Rosa':[38.4404,-122.7141], Napa:[38.2975,-122.2869],
 Vallejo:[38.1041,-122.2566], Benicia:[38.0494,-122.1586], Martinez:[38.0194,-122.1341],
 Lafayette:[37.8858,-122.1180], Orinda:[37.8771,-122.1797], 'El Cerrito':[37.9161,-122.3108],
 'San Pablo':[37.9621,-122.3455], Albany:[37.8869,-122.2977], 'Half Moon Bay':[37.4636,-122.4286],
 'San Bruno':[37.6305,-122.4111], 'South San Francisco':[37.6547,-122.4077],
 'San Carlos':[37.5072,-122.2605], 'San Ramon':[37.7799,-121.9780], 'Union City':[37.5934,-122.0438],
 'Los Gatos':[37.2358,-121.9624], Campbell:[37.2872,-121.9500], Saratoga:[37.2638,-122.0230],
 'Mill Valley':[37.9060,-122.5450], Sausalito:[37.8591,-122.4853], Novato:[38.1074,-122.5697],
 Sonoma:[38.2919,-122.4580], Sebastopol:[38.4021,-122.8239], Vacaville:[38.3566,-121.9877],
 'Morgan Hill':[37.1305,-121.6544], Gilroy:[37.0058,-121.5683],
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
 if(event.live&&event.region==='outside-bay-area')return 'outside';
 const distance=distanceMiles(event,profile);
 if(distance===null||event.locationQuality==='title'||event.locationConflict)return 'unknown';
 if(distance>Number(profile.radius))return 'outside';
 return 'inside';
}
export function visibleNearby(event,profile,includeUnknown=false){
 const status=geographicStatus(event,profile);return status==='inside'||includeUnknown&&status==='unknown';
}
