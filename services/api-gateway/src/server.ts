// IMPORTANT: tracing must be initialized before any other imports
import './tracing';

import express from 'express';
import { trace, metrics } from '@opentelemetry/api';
import ordersRouter from './routes/orders';
import healthRouter from './routes/health';

const app = express();
const PORT = process.env.PORT || 3000;

const tracer = trace.getTracer('api-gateway');
const meter = metrics.getMeter('api-gateway');

// Metrics
const requestCounter = meter.createCounter('api_gateway_requests_total', {
  description: 'Total number of requests handled by the API gateway',
});
const requestDuration = meter.createHistogram('api_gateway_request_duration_ms', {
  description: 'Request duration in milliseconds',
  unit: 'ms',
});

app.use(express.json());

// Request instrumentation middleware
app.use((req, _res, next) => {
  const start = Date.now();
  requestCounter.add(1, { method: req.method, path: req.path });
  _res.on('finish', () => {
    requestDuration.record(Date.now() - start, {
      method: req.method,
      path: req.path,
      status_code: String(_res.statusCode),
    });
  });
  next();
});

// Routes
app.use('/', healthRouter);
app.use('/api/orders', ordersRouter);

// Root
app.get('/', (_req, res) => {
  res.json({
    service: 'api-gateway',
    version: '1.0.0',
    endpoints: ['/health', '/ready', '/api/orders'],
  });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

export default app;
