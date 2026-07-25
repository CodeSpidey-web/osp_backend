import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Badge, Text, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"

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

const statusColor: Record<string, "grey" | "orange" | "green"> = {
  Pending: "grey",
  Processing: "orange",
  Delivered: "green",
}

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/admin/orders", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setOrders(data.orders))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Container><Text>Loading orders...</Text></Container>

  return (
    <Container>
      <Heading level="h1" className="mb-4">Order Management</Heading>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>#</Table.HeaderCell>
            <Table.HeaderCell>Customer</Table.HeaderCell>
            <Table.HeaderCell>Items</Table.HeaderCell>
            <Table.HeaderCell>Total</Table.HeaderCell>
            <Table.HeaderCell>Date</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {orders.map((order) => (
            <Table.Row key={order.id}>
              <Table.Cell>#{order.display_id}</Table.Cell>
              <Table.Cell>
                {order.shipping_address
                  ? `${order.shipping_address.first_name} ${order.shipping_address.last_name}`
                  : order.email}
              </Table.Cell>
              <Table.Cell>{order.items?.length || 0} items</Table.Cell>
              <Table.Cell>
                {new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: order.currency_code?.toUpperCase() || "INR",
                }).format((order.total || 0) / 100)}
              </Table.Cell>
              <Table.Cell>
                {new Date(order.created_at).toLocaleDateString("en-IN")}
              </Table.Cell>
              <Table.Cell>
                <Badge color={statusColor[order.custom_status] || "grey"}>
                  {order.custom_status}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <Button variant="secondary" size="small" onClick={() => window.open(`/app/orders/${order.id}`, "_blank")}>
                  View
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Container>
  )
}

const ShoppingCartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="21" r="1"></circle>
    <circle cx="20" cy="21" r="1"></circle>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
  </svg>
);

export const config = defineRouteConfig({
  label: "Order Management",
  icon: ShoppingCartIcon,
})

export default OrdersPage

