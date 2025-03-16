import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics (DO NOT redefine http_req_duration)
export let latency = new Trend('csc8113_http_req_duration'); // ✅ Use a different name
export let errors = new Rate('http_errors');
export let requests = new Counter('http_requests');

export let options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 1000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // ✅ Use built-in metric correctly
  },
};

export default function () {
  let res = http.get('http://35.246.15.37/api/products');

  latency.add(res.timings.duration); // ✅ Use custom metric instead
  requests.add(1);
  errors.add(res.status !== 200);

  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
