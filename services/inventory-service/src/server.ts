// IMPORTANT: tracing must be initialized before any other imports
import './tracing';

import express, { Request, Response } from 'express';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';

const app = express();
const PORT = process.env.PORT || 3002;

const tracer = trace.getTracer('inventory-service');
const meter = metrics.getMeter('inventory-service');

// Metrics
const inventoryChecks = meter.createCounter('inventory_checks_total', {
  description: 'Total number of inventory checks performed',
});
const stockLevel = meter.createObservableGauge('inventory_stock_level', {
  description: 'Current stock level per product',
});

// In-memory inventory store (demo purposes)
interface InventoryItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  reserved: number;
  location: string;
  lastUpdated: string;
}

const inventory: InventoryItem[] = [
  {
    productId: 'prod-x1',
    name: 'Widget Alpha',
    sku: 'WGT-A-001',
    quantity: 150,
    reserved: 10,
    location: 'Warehouse A',
    lastUpdated: new Date().toISOString(),
  },
  {
    productId: 'prod-y2',
    name: 'Gadget Beta',
    sku: 'GDT-B-002',
    quantity: 75,
    reserved: 5,
    location: 'Warehouse B',
    lastUpdated: new Date().toISOString(),
  },
  {
    productId: 'prod-z3',
    name: 'Device Gamma',
    sku: 'DVC-G-003',
    quantity: 30,
    reserved: 2,
    location: 'Warehouse A',
    lastUpdated: new Date().toISOString(),
  },
];

// Observable gauge callback
stockLevel.addCallback((result) => {
  for (const item of inventory) {
    result.observe(item.quantity - item.reserved, { product_id: item.productId, sku: item.sku });
  }
});

app.use(express.json());

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'inventory-service', uptime: process.uptime() });
});

app.get('/ready', (_req: Request, res: Response) => {
  res.json({ status: 'ready' });
});

// List all inventory
app.get('/inventory', (_req: Request, res: Response) => {
  const span = tracer.startSpan('inventory-service.list-inventory');
  try {
    span.setAttribute('inventory.item_count', inventory.length);
    span.setStatus({ code: SpanStatusCode.OK });
    res.json({ inventory, total: inventory.length });
  } finally {
    span.end();
  }
});

// Get inventory for a specific product
app.get('/inventory/:productId', (req: Request, res: Response) => {
  const span = tracer.startSpan('inventory-service.get-inventory');
  span.setAttribute('product.id', req.params.productId);
  inventoryChecks.add(1, { product_id: req.params.productId });
  try {
    const item = inventory.find((i) => i.productId === req.params.productId);
    if (!item) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Product not found' });
      res.status(404).json({ error: 'Product not found in inventory' });
      return;
    }
    span.setAttribute('inventory.available', item.quantity - item.reserved);
    span.setStatus({ code: SpanStatusCode.OK });
    res.json(item);
  } finally {
    span.end();
  }
});

// Reserve inventory
app.post('/inventory/:productId/reserve', (req: Request, res: Response) => {
  const span = tracer.startSpan('inventory-service.reserve-inventory');
  span.setAttribute('product.id', req.params.productId);
  try {
    const { quantity } = req.body as { quantity: number };
    const item = inventory.find((i) => i.productId === req.params.productId);
    if (!item) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const available = item.quantity - item.reserved;
    if (quantity > available) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Insufficient stock' });
      res.status(409).json({ error: 'Insufficient stock', available });
      return;
    }
    item.reserved += quantity;
    item.lastUpdated = new Date().toISOString();
    span.setAttribute('reserved.quantity', quantity);
    span.setStatus({ code: SpanStatusCode.OK });
    res.json({ message: 'Reservation successful', item });
  } finally {
    span.end();
  }
});

app.listen(PORT, () => {
  console.log(`Inventory Service running on port ${PORT}`);
});

export default app;
