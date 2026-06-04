import { Router, Request, Response } from 'express';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import http from 'http';

const router = Router();
const tracer = trace.getTracer('api-gateway');

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3001';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://inventory-service:3002';

function httpGet(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// GET /api/orders - fetch all orders (fan-out to order + inventory services)
router.get('/', async (_req: Request, res: Response) => {
  const span = tracer.startSpan('api-gateway.get-orders');
  try {
    const [orders, inventory] = await Promise.all([
      httpGet(`${ORDER_SERVICE_URL}/orders`),
      httpGet(`${INVENTORY_SERVICE_URL}/inventory`),
    ]);
    span.setStatus({ code: SpanStatusCode.OK });
    res.json({ orders, inventory });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
    res.status(502).json({ error: 'Upstream service unavailable' });
  } finally {
    span.end();
  }
});

// POST /api/orders - create a new order
router.post('/', async (req: Request, res: Response) => {
  const span = tracer.startSpan('api-gateway.create-order');
  span.setAttribute('order.payload', JSON.stringify(req.body));
  try {
    // Forward to order service
    const order = await httpGet(`${ORDER_SERVICE_URL}/orders`);
    span.setStatus({ code: SpanStatusCode.OK });
    res.status(201).json({ message: 'Order created', order });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
    res.status(502).json({ error: 'Failed to create order' });
  } finally {
    span.end();
  }
});

export default router;
