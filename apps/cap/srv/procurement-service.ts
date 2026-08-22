import cds from '@sap/cds'
import type { Request } from '@sap/cds'

type PurchaseRequestRow = {
  ID: string
  requestNumber: string
  status: string
  currency?: string
  requester_ID?: string
  department_ID?: string
}

type PurchaseRequestItemRow = {
  ID: string
  quantity: number
  unitPrice: number
}

type EmployeeRow = {
  ID: string
  email: string
  role: string
}

function httpError(status: number, message: string): never {
  throw Object.assign(new Error(message), { status, code: String(status) })
}

function asMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function idFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (value && typeof value === 'object' && 'ID' in value) {
    const id = (value as { ID?: string }).ID
    if (id) return id
  }
}

function idFromUrl(url: string | undefined): string | undefined {
  if (!url) return
  const match = decodeURIComponent(url).match(
    /PurchaseRequests\((?:ID=)?(?:"|')?([0-9a-fA-F-]{36})/i
  )
  return match?.[1]
}

function boundId(req: Request): string {
  const fromParams = idFromUnknown(
    Array.isArray(req.params) ? req.params[0] : req.params
  )
  if (fromParams) return fromParams

  const httpReq = cds.context?.http?.req as
    | { originalUrl?: string; url?: string }
    | undefined
  const fromUrl = idFromUrl(httpReq?.originalUrl || httpReq?.url)
  if (fromUrl) return fromUrl

  httpError(400, 'Purchase request ID is required')
}

function assertCanSubmit(req: Request): void {
  const user = req.user
  if (!user || user.is('anonymous')) return
  if (user.is('ADMIN') || user.is('EMPLOYEE') || user.is('authenticated-user')) return
  httpError(403, 'Not authorized to submit purchase requests')
}

export default class ProcurementService extends cds.ApplicationService {
  override async init() {
    const { PurchaseRequests } = this.entities

    this.on('submitPurchaseRequest', PurchaseRequests, async (req) => {
      try {
        return await this.submitPurchaseRequest(req)
      } catch (err) {
        const status = (err as { status?: number }).status
        if (status) throw err
        httpError(500, err instanceof Error ? err.message : 'Submit failed')
      }
    })

    await super.init()
  }

  private async submitPurchaseRequest(req: Request) {
    assertCanSubmit(req)

    const { PurchaseRequests, PurchaseRequestItems, Approvals } = this.entities
    const ID = boundId(req)

    const request = (await SELECT.one
      .from(PurchaseRequests)
      .where({ ID })) as PurchaseRequestRow | null

    if (!request) {
      httpError(404, 'Purchase request not found')
    }

    const requestId = request.ID

    if (request.status !== 'DRAFT') {
      httpError(
        400,
        `Purchase request ${request.requestNumber} cannot be submitted from status ${request.status}`
      )
    }

    const items = (await SELECT.from(PurchaseRequestItems).where({
      purchaseRequest_ID: requestId
    })) as PurchaseRequestItemRow[]

    if (!items.length) {
      httpError(400, 'A purchase request cannot be submitted without items')
    }

    let totalAmount = 0

    for (const item of items) {
      const quantity = Number(item.quantity)
      const unitPrice = Number(item.unitPrice)

      if (!Number.isFinite(quantity) || quantity <= 0) {
        httpError(400, 'Each item quantity must be greater than zero')
      }

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        httpError(400, 'Each item price must be greater than zero')
      }

      const totalPrice = asMoney(quantity * unitPrice)
      totalAmount = asMoney(totalAmount + totalPrice)

      await UPDATE(PurchaseRequestItems).set({ totalPrice }).where({ ID: item.ID })
    }

    const approver = await this.findApprover(
      request.department_ID,
      request.requester_ID
    )

    if (!approver) {
      httpError(400, 'No manager is available to approve this request')
    }

    const submittedAt = new Date().toISOString()

    await UPDATE(PurchaseRequests)
      .set({
        status: 'PENDING_APPROVAL',
        totalAmount,
        submittedAt
      })
      .where({ ID: requestId })

    await INSERT.into(Approvals).entries({
      purchaseRequest_ID: requestId,
      approver_ID: approver.ID,
      status: 'PENDING'
    })

    return {
      ID: requestId,
      requestNumber: request.requestNumber,
      status: 'PENDING_APPROVAL',
      totalAmount,
      currency: request.currency ?? 'USD',
      submittedAt,
      approverEmail: approver.email
    }
  }

  private async findApprover(
    departmentId?: string,
    requesterId?: string
  ): Promise<EmployeeRow | null> {
    const { Employees } = this.entities

    if (departmentId) {
      const departmentManager = (await SELECT.one.from(Employees).where({
        department_ID: departmentId,
        role: 'MANAGER',
        ...(requesterId ? { ID: { '!=': requesterId } } : {})
      })) as EmployeeRow | null

      if (departmentManager) return departmentManager
    }

    return (await SELECT.one
      .from(Employees)
      .where({ role: 'MANAGER' })) as EmployeeRow | null
  }
}