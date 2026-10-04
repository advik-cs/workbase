import fs from 'fs';
import path from 'path';

function check(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
  } else {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  }
}

async function verify() {
  const componentPath = path.join(process.cwd(), 'src/components/before/BeforeDashboardView.tsx');
  const cacheServicePath = path.join(process.cwd(), 'src/offline/cacheService.ts');
  
  const componentCode = fs.readFileSync(componentPath, 'utf8');
  const cacheCode = fs.readFileSync(cacheServicePath, 'utf8');
  
  // A. DATA SOURCE TEST
  check(!componentCode.includes('4.8m (Warning: 5.0m)'), 'Hardcoded 4.8m river gauge value is removed');
  check(componentCode.includes('Data unavailable'), 'River Gauge correctly implements "Data unavailable" state');
  check(!componentCode.includes('34 mm/hr'), 'Hardcoded 34 mm/hr precipitation value is removed');
  check(!componentCode.includes('78% Verified'), 'Hardcoded 78% verified value is removed');
  
  // B. LOCATION TEST
  check(componentCode.includes('offlineCacheService.getHazardSnapshotWithFallback(hh.latitude, hh.longitude)'), 'Hazard request uses authenticated Citizen coordinates');
  
  // C. PRECIPITATION TEST
  check(componentCode.includes('Math.max(...weatherData.hourly.map((h) => h.precip || 0))'), 'Precipitation calculates max forecast hourly precipitation');
  check(cacheCode.includes('forecast_hours=12'), 'Cache service correctly requests 12 hours of forecast data');
  check(cacheCode.includes('hourly.precipitation || []'), 'Cache service extracts precipitation from Open-Meteo hourly response');
  
  console.log('\nAll targeted Zone Sensor Intelligence verifications passed successfully!');
}

verify().catch(console.error);
