// IMPORTANT: tracing must be initialized before any other imports
import './tracing';

import express, { Request, Response } from 'express';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';

const app = express();
const PORT = process.env.PORT || 3001;

const tracer = trace.getTracer('order-service');
const meter = metrics.getMeter('order-service');

// Metrics
const ordersCreated = meter.createCounter('orders_created_total', {
  description: 'Total number of orders created',
});
const orderProcessingDuration = meter.createHistogram('order_processing_duration_ms', {
  description: 'Order processing duration in milliseconds',
  unit: 'ms',
});

// In-memory order store (demo purposes)
interface Order {
  id: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  total: number;
  createdAt: string;
}

const orders: Order[] = [
  {
    id: 'order-001',
    customerId: 'cust-abc',
    items: [{ productId: 'prod-x1', quantity: 2, price: 29.99 }],
    status: 'confirmed',
    total: 59.98,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'order-002',
    customerId: 'cust-def',
    items: [{ productId: 'prod-y2', quantity: 1, price: 149.99 }],
    status: 'shipped',
    total: 149.99,
    createdAt: new Date().toISOString(),
  },
];

app.use(express.json());

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'order-service', uptime: process.uptime() });
});

app.get('/ready', (_req: Request, res: Response) => {
  res.json({ status: 'ready' });
});

// List orders
app.get('/orders', (_req: Request, res: Response) => {
  const span = tracer.startSpan('order-service.list-orders');
  try {
    span.setAttribute('orders.count', orders.length);
    span.setStatus({ code: SpanStatusCode.OK });
    res.json({ orders, total: orders.length });
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});

// Get order by ID
app.get('/orders/:id', (req: Request, res: Response) => {
  const span = tracer.startSpan('order-service.get-order');
  span.setAttribute('order.id', req.params.id);
  try {
    const order = orders.find((o) => o.id === req.params.id);
    if (!order) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Order not found' });
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    span.setStatus({ code: SpanStatusCode.OK });
    res.json(order);
  } finally {
    span.end();
  }
});

// Create order
app.post('/orders', (req: Request, res: Response) => {
  const span = tracer.startSpan('order-service.create-order');
  const start = Date.now();
  try {
    const { customerId, items } = req.body as {
      customerId: string;
      items: Array<{ productId: string; quantity: number; price: number }>;
    };

    if (!customerId || !items?.length) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid payload' });
      res.status(400).json({ error: 'customerId and items are required' });
      return;
    }

    const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
    const newOrder: Order = {
      id: `order-${Date.now()}`,
      customerId,
      items,
      status: 'pending',
      total,
      createdAt: new Date().toISOString(),
    };

    orders.push(newOrder);
    ordersCreated.add(1, { customer_id: customerId });
    orderProcessingDuration.record(Date.now() - start);

    span.setAttribute('order.id', newOrder.id);
    span.setAttribute('order.total', total);
    span.setStatus({ code: SpanStatusCode.OK });
    res.status(201).json(newOrder);
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    span.end();
  }
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});

export default app;
