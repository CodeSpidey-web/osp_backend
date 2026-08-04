import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Badge, Text, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useRoleGuard } from "../useRoleGuard"

type DashboardStats = {
  totalProducts: number
  inStock: number
  lowStock: number
  outOfStock: number
}

type DashboardOrder = {
  id: string
  display_id: number
  email: string
  total: number
  currency_code: string
  created_at: string
  custom_status: string
  shipping_address?: { first_name: string; last_name: string }
}

const statusColors: Record<string, "grey" | "orange" | "green"> = {
  Pending: "grey",
  Processing: "orange",
  Delivered: "green",
}

const DashboardPage = () => {
  const { authorized, loading: authLoading } = useRoleGuard()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<DashboardOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusText, setStatusText] = useState("Initializing...")

  useEffect(() => {
    if (authLoading || !authorized) return

    try {
      setStatusText("Sending summary request...")
      // Fetch stats and then orders in a single optimized promise chain
      fetch(`/admin/client-dashboard/summary?stats_only=true&_cb=${Date.now()}`, { credentials: "include" })
        .then((r) => {
          setStatusText(`Summary received (status: ${r.status}). Parsing JSON...`)
          if (!r.ok) throw new Error(`Failed to fetch dashboard summary (Status: ${r.status})`)
          return r.json()
        })
        .then((data) => {
          setStatusText("Summary parsed. Sending orders request...")
          setStats(data.stats)
          return fetch("/admin/orders", { credentials: "include" })
        })
        .then((r) => {
          setStatusText(`Orders received (status: ${r.status}). Parsing JSON...`)
          if (!r.ok) throw new Error(`Failed to fetch orders (Status: ${r.status})`)
          return r.json()
        })
        .then((data) => {
          setStatusText("Orders parsed. Processing data...")
          const sorted = (data.orders || []).sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          setRecentOrders(sorted.slice(0, 5))
          setStatusText("Completed!")
          setLoading(false)
        })
        .catch((err) => {
          console.error("Error loading dashboard data:", err)
          setError(err.message || String(err))
          setLoading(false)
        })
    } catch (e: any) {
      setError(e.message || String(e))
      setLoading(false)
    }
  }, [authLoading, authorized])

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

  if (error) {
    return (
      <Container className="p-8 border border-rose-900 bg-rose-950/20 text-rose-400 rounded-xl">
        <Heading level="h2" className="text-sm font-bold uppercase tracking-wider mb-2">Error Loading Dashboard Data</Heading>
        <Text className="text-xs">{error}</Text>
        <Button variant="secondary" size="small" className="mt-4" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </Container>
    )
  }

  if (loading) {
    return (
      <Container className="p-8">
        <Text>Loading dashboard data...</Text>
      </Container>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <Heading level="h1" className="text-2xl font-bold mb-1">
          Store Dashboard
        </Heading>
        <Text className="text-slate-400 text-sm">
          A high-level snapshot of your catalog, inventory metrics, and recent sales.
        </Text>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Products", val: stats?.totalProducts ?? 0, bg: "bg-slate-900/50 border-slate-800" },
          { label: "In Stock Items", val: stats?.inStock ?? 0, bg: "bg-green-950/20 border-green-900/30 text-green-400" },
          { label: "Low Stock Alert", val: stats?.lowStock ?? 0, bg: "bg-amber-950/20 border-amber-900/30 text-amber-400" },
          { label: "Out of Stock", val: stats?.outOfStock ?? 0, bg: "bg-rose-950/20 border-rose-900/30 text-rose-400" },
        ].map((item) => (
          <Container key={item.label} className={`p-6 border rounded-xl ${item.bg}`}>
            <Text className="text-xs uppercase tracking-wider font-semibold opacity-80">{item.label}</Text>
            <Text className="text-3xl font-black mt-2">{item.val}</Text>
          </Container>
        ))}
      </div>

      {/* Recent Orders table */}
      <Container className="p-6">
        <div className="flex justify-between items-center mb-4">
          <Heading level="h2" className="text-lg font-bold">
            Recent Orders
          </Heading>
          <Button variant="secondary" size="small" onClick={() => window.location.href = "/app/order-management"}>
            View All Orders
          </Button>
        </div>

        <div className="w-full overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Order ID</Table.HeaderCell>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Total</Table.HeaderCell>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {recentOrders.map((order) => (
                <Table.Row key={order.id}>
                  <Table.Cell className="font-bold">#{order.display_id}</Table.Cell>
                  <Table.Cell>
                    {order.shipping_address
                      ? `${order.shipping_address.first_name} ${order.shipping_address.last_name}`
                      : order.email}
                  </Table.Cell>
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
                    <Badge color={statusColors[order.custom_status] || "grey"}>
                      {order.custom_status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Button variant="secondary" size="small" onClick={() => window.open(`/app/orders/${order.id}`, "_blank")}>
                      View Detail
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
              {recentOrders.length === 0 && (
                <Table.Row>
                  <Table.Cell {...({ colSpan: 6 } as any)} className="text-center italic py-4 text-slate-500">
                    No orders found.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </Container>
    </div>
  )
}

const ChartPieIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
    <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
  </svg>
)

export const config = defineRouteConfig({
  label: "Dashboard",
  icon: ChartPieIcon,
})

export default DashboardPage
