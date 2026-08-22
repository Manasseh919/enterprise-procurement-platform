import express from 'express'

type OrderItem = {
  description: string
  quantity: number
  unitPrice: number
}

type SupplierOrder = {
  id: string
  externalOrderId: string
  purchaseOrderNumber: string
  supplierId: string
  items: OrderItem[]
  status: 'ACCEPTED' | 'CONFIRMED'
  createdAt: string
  confirmedAt?: string
}

type CreateOrderBody = {
  purchaseOrderNumber?: string
  supplierId?: string
  items?: OrderItem[]
}

const PORT = Number(process.env.PORT ?? 4010)
const app = express()
const orders = new Map<string, SupplierOrder>()
let nextSequence = 10001

app.use(express.json())

function nextExternalOrderId(): string {
  const id = `SUP-ORD-${nextSequence}`
  nextSequence += 1
  return id
}

function isValidItem(item: OrderItem): boolean {
  return (
    typeof item.description === 'string' &&
    item.description.trim().length > 0 &&
    Number(item.quantity) > 0 &&
    Number(item.unitPrice) > 0
  )
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'supplier-api' })
})

app.post('/api/orders', (req, res) => {
  const body = req.body as CreateOrderBody
  const purchaseOrderNumber = body.purchaseOrderNumber?.trim()
  const supplierId = body.supplierId?.trim()
  const items = body.items ?? []

  if (!purchaseOrderNumber || !supplierId) {
    res.status(400).json({
      error: 'purchaseOrderNumber and supplierId are required'
    })
    return
  }

  if (!items.length || !items.every(isValidItem)) {
    res.status(400).json({
      error: 'At least one item with description, quantity > 0, and unitPrice > 0 is required'
    })
    return
  }

  const externalOrderId = nextExternalOrderId()
  const order: SupplierOrder = {
    id: externalOrderId,
    externalOrderId,
    purchaseOrderNumber,
    supplierId,
    items: items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice)
    })),
    status: 'ACCEPTED',
    createdAt: new Date().toISOString()
  }

  orders.set(order.id, order)

  res.status(201).json({
    externalOrderId: order.externalOrderId,
    status: order.status
  })
})

app.get('/api/orders/:id', (req, res) => {
  const order = orders.get(req.params.id)

  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }

  res.json(order)
})

app.post('/api/orders/:id/confirm', (req, res) => {
  const order = orders.get(req.params.id)

  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }

  order.status = 'CONFIRMED'
  order.confirmedAt = new Date().toISOString()
  orders.set(order.id, order)

  res.json({
    externalOrderId: order.externalOrderId,
    status: order.status,
    confirmedAt: order.confirmedAt
  })
})

app.listen(PORT, () => {
  console.log(`Supplier API listening on http://localhost:${PORT}`)
})