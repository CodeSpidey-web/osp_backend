import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Badge, Text, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useRoleGuard } from "../useRoleGuard"

type Order = {
  id: string
  display_id: number
  email: string
  total: number
  currency_code: string
  created_at: string
  custom_status: string
  shipping_address?: { first_name: string; last_name: string; city: string }
  items?: { title: string; quantity: number }[]
}

const statusColors: Record<string, "grey" | "orange" | "green"> = {
  Pending: "grey",
  Processing: "orange",
  Delivered: "green",
}

const OrdersPage = () => {
  const { authorized, loading: authLoading } = useRoleGuard()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [actionPending, setActionPending] = useState(false)

  const loadOrders = () => {
    setLoading(true)
    fetch("/admin/orders", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data.orders || []).sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setOrders(sorted)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (authLoading || !authorized) return
    loadOrders()
  }, [authLoading, authorized])

  const handleUpdateStatus = async (orderId: string, status: "Processing" | "Delivered") => {
    const confirmMessage = 
      status === "Processing" 
        ? "Capture payment for this order and transition status to Processing?" 
        : "Fulfill all items, register shipment and mark this order as Delivered?"
        
    if (!confirm(confirmMessage)) return

    setActionPending(true)
    try {
      const res = await fetch(`/admin/client-dashboard/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error("Failed to update status on server.")
      }

      loadOrders()
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
        <Text className="text-slate-400">This customized client page is only available for the administrator profile.</Text>
      </Container>
    )
  }

  if (loading) return <Container><Text>Loading orders...</Text></Container>

  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Heading level="h1" className="text-xl font-bold">Order Management</Heading>
          <Text className="text-xs text-slate-400 mt-0.5">Track payments and manage fulfillment workflows.</Text>
        </div>
      </div>
      
      <div className="w-full overflow-x-auto table-scroll-all">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>#</Table.HeaderCell>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Items</Table.HeaderCell>
              <Table.HeaderCell>Total</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {orders.map((order) => (
              <Table.Row key={order.id}>
                <Table.Cell className="font-bold">#{order.display_id}</Table.Cell>
                <Table.Cell>
                  <span className="font-semibold text-slate-200 block">
                    {order.shipping_address
                      ? `${order.shipping_address.first_name} ${order.shipping_address.last_name}`
                      : "Store Customer"}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono mt-0.5">{order.email}</span>
                </Table.Cell>
                <Table.Cell>{order.items?.length || 0} items</Table.Cell>
                <Table.Cell className="font-semibold">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: order.currency_code?.toUpperCase() || "INR",
                  }).format((order.total || 0) / 100)}
                </Table.Cell>
                <Table.Cell>
                  {new Date(order.created_at).toLocaleDateString("en-IN")}
                </Table.Cell>
                <Table.Cell>
                  <Badge color={statusColors[order.custom_status] || "grey"}>
                    {order.custom_status}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="text-right space-x-2">
                  <Button variant="secondary" size="small" onClick={() => window.open(`/app/orders/${order.id}`, "_blank")}>
                    Details
                  </Button>
                  {order.custom_status === "Pending" && (
                    <Button 
                      variant="primary" 
                      size="small" 
                      disabled={actionPending}
                      onClick={() => handleUpdateStatus(order.id, "Processing")}
                    >
                      Capture Payment
                    </Button>
                  )}
                  {order.custom_status === "Processing" && (
                    <Button 
                      variant="primary" 
                      size="small" 
                      disabled={actionPending}
                      onClick={() => handleUpdateStatus(order.id, "Delivered")}
                    >
                      Mark Shipped
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
            {orders.length === 0 && (
              <Table.Row>
                <Table.Cell {...({ colSpan: 7 } as any)} className="text-center italic py-4 text-slate-500">
                  No orders found.
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </div>
    </Container>
  )
}

const ShoppingCartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="9" cy="21" r="1"></circle>
    <circle cx="20" cy="21" r="1"></circle>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
  </svg>
)

export const config = defineRouteConfig({
  label: "Order Management",
  icon: ShoppingCartIcon,
})

export default OrdersPage
