import { Container, Heading, Table, Badge, Text, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useRoleGuard } from "../../../utils/useRoleGuard"
import MarkShippedDialog from "../../../components/MarkShippedDialog"

type OrderItem = {
  id: string
  title: string
  quantity: number
  unit_price: number
  subtotal: number
  total: number
  thumbnail?: string
}

type OrderDetail = {
  id: string
  display_id: number
  status: string
  payment_status: string
  fulfillment_status: string
  total: number
  subtotal: number
  item_subtotal?: number
  tax_total: number
  shipping_total: number
  discount_total: number
  email: string
  created_at: string
  items?: OrderItem[]
  shipping_address?: {
    first_name: string
    last_name: string
    address_1: string
    address_2?: string | null
    city: string
    province: string
    postal_code: string
    phone?: string
    company?: string | null
  }
  payment_collections?: {
    id: string
    status: string
    amount: number
    captured_amount: number
    payments?: {
      id: string
      amount: number
      captured_at?: string | null
    }[]
  }[]
  fulfillments?: {
    id: string
    shipped_at?: string | null
    delivered_at?: string | null
    metadata?: Record<string, any> | null
    labels?: {
      tracking_number: string
      tracking_url: string
    }[]
  }[]
}

const statusColors: Record<string, "grey" | "orange" | "green"> = {
  Pending: "grey",
  Processing: "orange",
  Shipped: "green",
}

const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
)

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { authorized, loading: authLoading } = useRoleGuard()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [shipDialogOpen, setShipDialogOpen] = useState(false)

  const loadOrder = () => {
    setLoading(true)
    fetch(`/admin/orders/${id}?fields=*items,*items.detail,*shipping_address,*payment_collections,*payment_collections.payments,*fulfillments,*fulfillments.labels`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Order not found or access denied")
        return r.json()
      })
      .then((data) => {
        setOrder(data.order)
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (authLoading || !authorized) return
    loadOrder()
  }, [authLoading, authorized, id])

  const mapStatus = (fulfillment: string, payment: string): string => {
    if (fulfillment === "fulfilled" || fulfillment === "shipped") return "Shipped"
    if (fulfillment === "partially_fulfilled" || payment === "captured") return "Processing"
    return "Pending"
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount)
  }

  const handleUpdateStatus = async (status: "Processing" | "Delivered") => {
    if (!order) return
    const confirmMessage = 
      status === "Processing" 
        ? "Capture payment for this order and transition status to Processing?" 
        : "Fulfill all items, enter courier & tracking details and mark this order as Shipped?"
        
    if (!confirm(confirmMessage)) return

    setActionPending(true)
    try {
      const res = await fetch(`/admin/client-dashboard/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || "Failed to update status on server.")
      }

      loadOrder()
    } catch (err: any) {
      alert(err.message || "An error occurred updating order status")
    } finally {
      setActionPending(false)
    }
  }

  const handleConfirmShip = async (courierName: string, trackingNumber: string) => {
    if (!order) return

    setActionPending(true)
    try {
      const res = await fetch(`/admin/client-dashboard/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Delivered", courierName, trackingNumber }),
        credentials: "include",
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || "Failed to update status on server.")
      }

      setShipDialogOpen(false)
      loadOrder()
    } catch (err: any) {
      alert(err.message || "An error occurred updating order status")
    } finally {
      setActionPending(false)
    }
  }

  if (authLoading) {
    return (
      <Container className="p-8">
        <Text>Checking authorization...</Text>
      </Container>
    )
  }

  if (!authorized) {
    return (
      <Container className="p-8">
        <Heading level="h1" className="text-xl font-bold text-rose-500 mb-2">Access Denied</Heading>
        <Text className="text-slate-400">This page is only accessible for administrators.</Text>
      </Container>
    )
  }

  if (loading) {
    return (
      <Container className="p-8">
        <Text>Loading order details...</Text>
      </Container>
    )
  }

  if (error || !order) {
    return (
      <Container className="p-8">
        <Heading level="h1" className="text-xl font-bold text-rose-500 mb-2">Error</Heading>
        <Text className="text-slate-400">{error || "Order not found."}</Text>
        <Button variant="secondary" className="mt-4" onClick={() => navigate("/app/order-management")}>
          <ArrowLeftIcon /> Back to Orders
        </Button>
      </Container>
    )
  }

  const customStatus = mapStatus(order.fulfillment_status, order.payment_status)

  const trackingFulfillment = order.fulfillments?.find((f) =>
    f.labels?.some((l) => l.tracking_number)
  )
  const trackingLabel = trackingFulfillment?.labels?.find((l) => l.tracking_number)
  const trackingCourier = trackingFulfillment?.metadata?.courier_name || null

  const displaySubtotal = order.items?.reduce((sum, item) => sum + item.total, 0) || order.item_subtotal || order.subtotal || 0;
  // GST (included) mirrors the customer-facing checkout calculation: all INR
  // prices are tax-inclusive at 18%, so the included tax is derived per
  // component (items + shipping) instead of trusting order.tax_total, which
  // can be incomplete for orders placed before the default GST rate existed.
  const itemGst = Math.round(displaySubtotal * (1 - 1 / 1.18));
  const shippingGst = Math.round((order.shipping_total || 0) * (1 - 1 / 1.18));
  const gstIncluded = itemGst + shippingGst;

  return (
    <div className="flex flex-col gap-y-6 p-4">
      {/* Header and Back Button */}
      <div className="flex flex-col gap-y-2">
        <button 
          onClick={() => navigate("/app/order-management")}
          className="flex items-center text-xs text-slate-400 hover:text-slate-200 transition-colors w-fit mb-2 bg-transparent border-none cursor-pointer p-0"
        >
          <ArrowLeftIcon /> Back to Order Management
        </button>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-x-3">
            <Heading level="h1" className="text-2xl font-bold">#{order.display_id}</Heading>
            <Badge color={statusColors[customStatus] || "grey"}>{customStatus}</Badge>
          </div>
          <Text className="text-xs text-slate-400">
            Placed on: {new Date(order.created_at).toLocaleString("en-IN")}
          </Text>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns (Items and Summary) */}
        <div className="lg:col-span-2 flex flex-col gap-y-6">
          {/* Order Items */}
          <Container className="flex flex-col gap-y-4">
            <Heading level="h2" className="text-base font-semibold">Items</Heading>
            <div className="overflow-x-auto">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Product</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Price</Table.HeaderCell>
                    <Table.HeaderCell className="text-center">Quantity</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {order.items?.map((item) => (
                    <Table.Row key={item.id}>
                      <Table.Cell>
                        <div className="flex items-center gap-x-3">
                          {item.thumbnail ? (
                            <img 
                              src={item.thumbnail} 
                              alt={item.title} 
                              className="w-10 h-10 object-cover rounded bg-slate-800"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-slate-500 text-xs">
                              No image
                            </div>
                          )}
                          <span className="font-medium text-sm text-slate-200">{item.title}</span>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-right text-sm">
                        {formatCurrency(item.unit_price)}
                      </Table.Cell>
                      <Table.Cell className="text-center text-sm font-semibold">
                        {item.quantity}
                      </Table.Cell>
                      <Table.Cell className="text-right text-sm font-medium">
                        {formatCurrency(item.total)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Container>

          {/* Payments & Transactions */}
          <Container className="flex flex-col gap-y-4">
            <Heading level="h2" className="text-base font-semibold font-bold">Payments & Capture</Heading>
            <div className="flex flex-col gap-y-3">
              <div className="flex justify-between items-center text-sm">
                <Text className="text-slate-400">Payment Status:</Text>
                <Badge color={order.payment_status === "captured" ? "green" : "orange"}>
                  {order.payment_status}
                </Badge>
              </div>

              {order.payment_status !== "captured" && (
                <div className="mt-2 border border-dashed border-slate-700 rounded-lg p-4 bg-slate-900/50 flex flex-col gap-y-3">
                  <Text className="text-xs text-slate-400">
                    Payment is authorized and waiting to be captured manually.
                  </Text>
                  <Button 
                    variant="primary" 
                    disabled={actionPending}
                    onClick={() => handleUpdateStatus("Processing")}
                    className="w-full flex justify-center py-2"
                  >
                    {actionPending ? "Capturing..." : "Capture Payment"}
                  </Button>
                </div>
              )}
              {order.payment_status === "captured" && (
                <div className="mt-1 border border-solid border-slate-800 rounded-lg p-3 bg-emerald-950/20 text-emerald-400 text-xs flex items-center gap-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Payment has been captured successfully.
                </div>
              )}
            </div>
          </Container>

          {/* Fulfillment Status */}
          <Container className="flex flex-col gap-y-4">
            <Heading level="h2" className="text-base font-semibold">Fulfillment</Heading>
            <div className="flex flex-col gap-y-3">
              <div className="flex justify-between items-center text-sm">
                <Text className="text-slate-400">Fulfillment Status:</Text>
                <Badge color={order.fulfillment_status === "fulfilled" ? "green" : "grey"}>
                  {order.fulfillment_status}
                </Badge>
              </div>

              {order.payment_status === "captured" && order.fulfillment_status !== "fulfilled" && (
                <div className="mt-2 border border-dashed border-slate-700 rounded-lg p-4 bg-slate-900/50 flex flex-col gap-y-3">
                  <Text className="text-xs text-slate-400">
                    All items are paid. Enter the courier's AWB / tracking number to ship this package and
                    email the customer a live tracking link.
                  </Text>
                  <Button 
                    variant="primary" 
                    disabled={actionPending}
                    onClick={() => setShipDialogOpen(true)}
                    className="w-full flex justify-center py-2"
                  >
                    {actionPending ? "Processing..." : "Mark Shipped — Enter Courier & Tracking"}
                  </Button>
                </div>
              )}
              {order.fulfillment_status === "fulfilled" && (
                <div className="mt-1 border border-solid border-slate-800 rounded-lg p-3 bg-emerald-950/20 text-emerald-400 text-xs flex flex-col gap-y-2">
                  <span className="flex items-center gap-x-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Order has been shipped. The customer receives a shipped email with the tracking link.
                  </span>
                  {trackingLabel?.tracking_number && (
                    <div className="pl-0 flex flex-col gap-y-1 text-slate-300">
                      <span className="font-mono">
                        {trackingCourier ? `${trackingCourier} · ` : ""}#{trackingLabel.tracking_number}
                      </span>
                      {trackingLabel.tracking_url && trackingLabel.tracking_url !== "#" && (
                        <a
                          href={trackingLabel.tracking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 font-semibold break-all"
                        >
                          Open courier tracking →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Container>

          <MarkShippedDialog
            open={shipDialogOpen}
            onOpenChange={setShipDialogOpen}
            onConfirm={handleConfirmShip}
            pending={actionPending}
            orderDisplayId={order.display_id}
          />
        </div>

        {/* Right Column (Summary totals & Customer) */}
        <div className="flex flex-col gap-y-6">
          {/* Order Summary Calculations */}
          <Container className="flex flex-col gap-y-4">
            <Heading level="h2" className="text-base font-semibold">Order Summary</Heading>
            <div className="flex flex-col gap-y-2.5 text-sm">
              <div className="flex justify-between">
                <Text className="text-slate-400">Subtotal</Text>
                <Text className="font-medium">{formatCurrency(displaySubtotal)}</Text>
              </div>
              <div className="flex justify-between">
                <Text className="text-slate-400">Shipping</Text>
                <Text className="font-medium">{formatCurrency(order.shipping_total)}</Text>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <Text>GST (included)</Text>
                <Text>{formatCurrency(gstIncluded)}</Text>
              </div>
              {order.discount_total > 0 && (
                <div className="flex justify-between text-rose-400">
                  <Text>Discount</Text>
                  <Text>- {formatCurrency(order.discount_total)}</Text>
                </div>
              )}
              <div className="border-t border-solid border-slate-800 my-2 pt-2.5 flex justify-between text-base font-bold">
                <Text className="text-slate-200">Total</Text>
                <Text className="text-emerald-400">{formatCurrency(order.total)}</Text>
              </div>
              
              <div className="border-t border-solid border-slate-800 pt-2.5 flex flex-col gap-y-2 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Captured Amount</span>
                  <span className="font-medium text-slate-200">
                    {formatCurrency(
                      order.payment_collections?.[0]?.captured_amount || 
                      (order.payment_status === "captured" ? order.total : 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Outstanding Amount</span>
                  <span className="font-semibold text-amber-400">
                    {formatCurrency(
                      order.payment_status === "captured" 
                        ? 0 
                        : (order.total - (order.payment_collections?.[0]?.captured_amount || 0))
                    )}
                  </span>
                </div>
              </div>
            </div>
          </Container>

          {/* Customer Details */}
          <Container className="flex flex-col gap-y-4">
            <Heading level="h2" className="text-base font-semibold">Customer</Heading>
            <div className="flex flex-col gap-y-3 text-sm">
              <div>
                <Text className="text-xs text-slate-500 font-semibold block mb-0.5">Contact Details</Text>
                <Text className="text-slate-200 font-medium block">{order.shipping_address ? `${order.shipping_address.first_name} ${order.shipping_address.last_name}` : "Guest Customer"}</Text>
                <Text className="text-xs text-slate-400 block font-mono mt-0.5">{order.email}</Text>
                {order.shipping_address?.phone && (
                  <Text className="text-xs text-slate-400 block mt-1">Phone: {order.shipping_address.phone}</Text>
                )}
              </div>
              
              {order.shipping_address && (
                <div className="border-t border-solid border-slate-800 pt-3">
                  <Text className="text-xs text-slate-500 font-semibold block mb-1">Shipping Address</Text>
                  <Text className="text-xs text-slate-300 leading-relaxed block">
                    {order.shipping_address.first_name} {order.shipping_address.last_name}<br />
                    {order.shipping_address.company && <>{order.shipping_address.company}<br /></>}
                    {order.shipping_address.address_1}<br />
                    {order.shipping_address.address_2 && <>{order.shipping_address.address_2}<br /></>}
                    {order.shipping_address.city}, {order.shipping_address.province} - {order.shipping_address.postal_code}<br />
                    India
                  </Text>
                </div>
              )}
            </div>
          </Container>
        </div>
      </div>
    </div>
  )
}
