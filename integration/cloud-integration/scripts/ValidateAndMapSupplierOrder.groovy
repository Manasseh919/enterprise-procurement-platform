import com.sap.gateway.ip.core.customdev.util.Message
import groovy.json.JsonOutput
import groovy.json.JsonSlurper

Message processData(Message message) {
  def body = message.getBody(String) ?: ""
  def json = new JsonSlurper().parseText(body)

  if (!json.purchaseOrderNumber) {
    throw new IllegalArgumentException("purchaseOrderNumber is required")
  }
  if (!json.supplierId) {
    throw new IllegalArgumentException("supplierId is required")
  }
  if (!(json.items instanceof List) || json.items.isEmpty()) {
    throw new IllegalArgumentException("At least one item is required")
  }

  def mapped = [
    purchaseOrderNumber: json.purchaseOrderNumber.toString(),
    supplierId         : json.supplierId.toString(),
    items              : json.items.collect { item ->
      [
        description: item.description?.toString(),
        quantity   : (item.quantity as Number).intValue(),
        unitPrice  : item.unitPrice as Number
      ]
    },
    channel            : "SAP_CLOUD_INTEGRATION"
  ]

  def out = JsonOutput.toJson(mapped)
  message.setBody(out)
  message.setHeader("Content-Type", "application/json")
  message.setHeader("Accept", "application/json")

  def messageLog = messageLogFactory.getMessageLog(message)
  if (messageLog) {
    messageLog.addAttachmentAsString("SupplierOrder", out, "application/json")
  }

  return message
}