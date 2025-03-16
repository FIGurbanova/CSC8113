import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 },  // Ramp up to 100 users in 1 min
    { duration: '3m', target: 1000 },  // Hold at 500 users for 3 mins
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% requests should be < 500ms
  },
};

export default function () {
 // your catalog-service external ip
   let res = http.get('http://35.246.15.37/api/products'); 
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);

}
