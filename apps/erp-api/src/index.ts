import express from 'express'

type OrderItem = {
  description: string
  quantity: number
  unitPrice: number
}

type ErpPurchaseOrder = {
  id: string
  erpPurchaseOrderId: string
  purchaseOrderNumber: string
  supplierId: string
  items: OrderItem[]
  status: 'CREATED' | 'PARTIALLY_RECEIVED' | 'RECEIVED'
  createdAt: string
}

type GoodsReceipt = {
  id: string
  erpPurchaseOrderId: string
  quantityReceived: number
  notes?: string
  receivedAt: string
}

type CreatePurchaseOrderBody = {
  purchaseOrderNumber?: string
  supplierId?: string
  items?: OrderItem[]
}

type CreateGoodsReceiptBody = {
  erpPurchaseOrderId?: string
  quantityReceived?: number
  notes?: string
}

const PORT = Number(process.env.PORT ?? 4011)
const app = express()
const purchaseOrders = new Map<string, ErpPurchaseOrder>()
const goodsReceipts: GoodsReceipt[] = []
let nextPoSequence = 1
let nextGrSequence = 1

app.use(express.json())

function nextErpPoId(): string {
  const year = new Date().getFullYear()
  const id = `ERP-PO-${year}-${String(nextPoSequence).padStart(5, '0')}`
  nextPoSequence += 1
  return id
}

function nextGoodsReceiptId(): string {
  const id = `ERP-GR-${String(nextGrSequence).padStart(5, '0')}`
  nextGrSequence += 1
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

function orderedQuantity(order: ErpPurchaseOrder): number {
  return order.items.reduce((sum, item) => sum + Number(item.quantity), 0)
}

function receivedQuantity(erpPurchaseOrderId: string): number {
  return goodsReceipts
    .filter((receipt) => receipt.erpPurchaseOrderId === erpPurchaseOrderId)
    .reduce((sum, receipt) => sum + Number(receipt.quantityReceived), 0)
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'erp-api' })
})

app.post('/api/purchase-orders', (req, res) => {
  const body = req.body as CreatePurchaseOrderBody
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

  const erpPurchaseOrderId = nextErpPoId()
  const order: ErpPurchaseOrder = {
    id: erpPurchaseOrderId,
    erpPurchaseOrderId,
    purchaseOrderNumber,
    supplierId,
    items: items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice)
    })),
    status: 'CREATED',
    createdAt: new Date().toISOString()
  }

  purchaseOrders.set(order.id, order)

  res.status(201).json({
    erpPurchaseOrderId: order.erpPurchaseOrderId,
    status: order.status
  })
})

app.get('/api/purchase-orders/:id', (req, res) => {
  const order = purchaseOrders.get(req.params.id)

  if (!order) {
    res.status(404).json({ error: 'Purchase order not found' })
    return
  }

  res.json({
    ...order,
    quantityOrdered: orderedQuantity(order),
    quantityReceived: receivedQuantity(order.id)
  })
})

app.post('/api/goods-receipts', (req, res) => {
  const body = req.body as CreateGoodsReceiptBody
  const erpPurchaseOrderId = body.erpPurchaseOrderId?.trim()
  const quantityReceived = Number(body.quantityReceived)

  if (!erpPurchaseOrderId) {
    res.status(400).json({ error: 'erpPurchaseOrderId is required' })
    return
  }

  if (!Number.isFinite(quantityReceived) || quantityReceived <= 0) {
    res.status(400).json({ error: 'quantityReceived must be greater than zero' })
    return
  }

  const order = purchaseOrders.get(erpPurchaseOrderId)

  if (!order) {
    res.status(404).json({ error: 'Purchase order not found' })
    return
  }

  const alreadyReceived = receivedQuantity(order.id)
  const remaining = orderedQuantity(order) - alreadyReceived

  if (quantityReceived > remaining) {
    res.status(400).json({
      error: `quantityReceived ${quantityReceived} exceeds remaining quantity ${remaining}`
    })
    return
  }

  const receipt: GoodsReceipt = {
    id: nextGoodsReceiptId(),
    erpPurchaseOrderId: order.id,
    quantityReceived,
    notes: body.notes?.trim(),
    receivedAt: new Date().toISOString()
  }

  goodsReceipts.push(receipt)

  const totalReceived = alreadyReceived + quantityReceived
  order.status =
    totalReceived >= orderedQuantity(order) ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
  purchaseOrders.set(order.id, order)

  res.status(201).json({
    goodsReceiptId: receipt.id,
    erpPurchaseOrderId: order.erpPurchaseOrderId,
    quantityReceived: receipt.quantityReceived,
    purchaseOrderStatus: order.status
  })
})

app.listen(PORT, () => {
  console.log(`ERP API listening on http://localhost:${PORT}`)
})