import express from 'express'

type AccountingInvoice = {
  id: string
  externalInvoiceId: string
  invoiceNumber: string
  purchaseOrderNumber: string
  supplierId: string
  amount: number
  currency: string
  status: 'PROCESSING' | 'POSTED' | 'REJECTED'
  createdAt: string
}

type CreateInvoiceBody = {
  invoiceNumber?: string
  purchaseOrderNumber?: string
  supplierId?: string
  amount?: number
  currency?: string
}

const PORT = Number(process.env.PORT ?? 4012)
const app = express()
const invoices = new Map<string, AccountingInvoice>()
let nextSequence = 1

app.use(express.json())

function nextExternalInvoiceId(): string {
  const id = `ACC-INV-${String(nextSequence).padStart(3, '0')}`
  nextSequence += 1
  return id
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'accounting-api' })
})

app.post('/api/invoices', (req, res) => {
  const body = req.body as CreateInvoiceBody
  const invoiceNumber = body.invoiceNumber?.trim()
  const purchaseOrderNumber = body.purchaseOrderNumber?.trim()
  const supplierId = body.supplierId?.trim()
  const amount = Number(body.amount)
  const currency = body.currency?.trim() || 'USD'

  if (!invoiceNumber || !purchaseOrderNumber || !supplierId) {
    res.status(400).json({
      error: 'invoiceNumber, purchaseOrderNumber, and supplierId are required'
    })
    return
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'amount must be greater than zero' })
    return
  }

  const externalInvoiceId = nextExternalInvoiceId()
  const invoice: AccountingInvoice = {
    id: externalInvoiceId,
    externalInvoiceId,
    invoiceNumber,
    purchaseOrderNumber,
    supplierId,
    amount,
    currency,
    status: 'PROCESSING',
    createdAt: new Date().toISOString()
  }

  invoices.set(invoice.id, invoice)

  res.status(201).json({
    externalInvoiceId: invoice.externalInvoiceId,
    status: invoice.status
  })
})

app.get('/api/invoices/:id', (req, res) => {
  const invoice = invoices.get(req.params.id)

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' })
    return
  }

  res.json(invoice)
})

app.listen(PORT, () => {
  console.log(`Accounting API listening on http://localhost:${PORT}`)
})