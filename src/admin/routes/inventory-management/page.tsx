import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Badge, Text, Button, Input } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useRoleGuard } from "../../utils/useRoleGuard"

const getImageUrl = (url?: string) => {
  if (!url) return ""
  if (url.startsWith("/")) {
    return `http://localhost:3000${url}`
  }
  return url
}

type VariantDetail = {
  id: string
  title: string
  sku: string
  barcode: string
  manage_inventory: boolean
  inventory_item_id: string | null
  quantity: number
  location_id: string | null
}

type ProductDetail = {
  id: string
  title: string
  status: string
  handle: string
  thumbnail: string
  categories: string[]
  variants: VariantDetail[]
  total_quantity: number
}

type InventoryLog = {
  id: number
  inventory_item_id: string
  sku: string
  product_title: string
  change_amount: number
  new_quantity: number
  updated_by: string
  created_at: string
}

type CategoryItem = {
  id: string
  name: string
  parent_category_id: string | null
}

type HierarchyCategory = {
  id: string
  name: string
  parent_category_id: string | null
  displayName: string
}

function getHierarchicalCategories(cats: CategoryItem[]): HierarchyCategory[] {
  const result: HierarchyCategory[] = []
  
  const buildTree = (parentId: string | null, depth: number) => {
    const children = cats.filter(c => c.parent_category_id === parentId)
    children.sort((a, b) => a.name.localeCompare(b.name))
    
    children.forEach(child => {
      const prefix = depth > 0 ? "— ".repeat(depth) : ""
      result.push({
        id: child.id,
        name: child.name,
        parent_category_id: child.parent_category_id,
        displayName: `${prefix}${child.name}`
      })
      buildTree(child.id, depth + 1)
    })
  }

  buildTree(null, 0)

  // Append any categories that weren't captured in the tree (orphans)
  cats.forEach(c => {
    if (!result.find(r => r.id === c.id)) {
      result.push({
        id: c.id,
        name: c.name,
        parent_category_id: c.parent_category_id,
        displayName: c.name
      })
    }
  })

  return result;
}

const InventoryPage = () => {
  const { authorized, loading: authLoading } = useRoleGuard()
  const [products, setProducts] = useState<ProductDetail[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [loading, setLoading] = useState(true)

  // Filters State
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Modal Adjustment State
  const [selectedVariant, setSelectedVariant] = useState<{
    productId: string
    productTitle: string
    inventoryItemId: string
    sku: string
    currentQty: number
  } | null>(null)
  const [adjustType, setAdjustType] = useState<"set" | "add" | "reduce">("set")
  const [inputValue, setInputValue] = useState<number | "">("")
  const [submitting, setSubmitting] = useState(false)

  // Low Stock Config Threshold
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10)

  const loadData = async () => {
    try {
      const summaryRes = await fetch(`/admin/client-dashboard/summary?_cb=${Date.now()}`, { credentials: "include" })
      const summaryData = await summaryRes.json()
      setProducts(summaryData.products || [])

      setCategories(summaryData.categories || [])

      const historyRes = await fetch(`/admin/client-dashboard/inventory-history?_cb=${Date.now()}`, { credentials: "include" })
      const historyData = await historyRes.json()
      setLogs(historyData.logs || [])
    } catch (err) {
      console.error("Error loading inventory page data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading || !authorized) return
    loadData()
  }, [authLoading, authorized])

  const handleOpenAdjustModal = (product: ProductDetail, variant: VariantDetail) => {
    if (!variant.inventory_item_id) {
      alert("This variant does not have inventory tracking enabled.")
      return
    }
    setSelectedVariant({
      productId: product.id,
      productTitle: product.title,
      inventoryItemId: variant.inventory_item_id,
      sku: variant.sku || "N/A",
      currentQty: variant.quantity,
    })
    setAdjustType("set")
    setInputValue(variant.quantity)
  }

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVariant) return

    setSubmitting(true)
    const numValue = inputValue === "" ? 0 : inputValue
    let targetQuantity = numValue

    if (adjustType === "add") {
      targetQuantity = selectedVariant.currentQty + numValue
    } else if (adjustType === "reduce") {
      targetQuantity = Math.max(0, selectedVariant.currentQty - numValue)
    }

    try {
      const res = await fetch("/admin/client-dashboard/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory_item_id: selectedVariant.inventoryItemId,
          quantity: targetQuantity,
        }),
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error("Failed to save changes on server.")
      }

      setSelectedVariant(null)
      await loadData()
    } catch (err: any) {
      alert(err.message || "An error occurred during adjustment")
    } finally {
      setSubmitting(false)
    }
  }

  // Filter products list
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.variants?.some((v) => (v.sku || "").toLowerCase().includes(searchQuery.toLowerCase()))

    let matchesStatus = true
    if (statusFilter === "instock") {
      matchesStatus = p.total_quantity > lowStockThreshold
    } else if (statusFilter === "lowstock") {
      matchesStatus = p.total_quantity > 0 && p.total_quantity <= lowStockThreshold
    } else if (statusFilter === "outofstock") {
      matchesStatus = p.total_quantity === 0
    }

    let matchesCategory = true
    if (categoryFilter !== "all") {
      matchesCategory = p.categories?.includes(categoryFilter)
    }

    return matchesSearch && matchesStatus && matchesCategory
  })

  // Pagination calculation
  const totalPages = Math.ceil(filteredProducts.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex)

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

  if (loading) {
    return (
      <Container className="p-8">
        <Text>Loading inventory data...</Text>
      </Container>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <Heading level="h1" className="text-2xl font-bold mb-1">
            Inventory
          </Heading>
        </div>
        <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] px-3 py-1.5 rounded-lg">
          <span className="text-xs font-semibold text-slate-400">Low Stock Alert Threshold:</span>
          <Input
            type="number"
            value={lowStockThreshold}
            onChange={(e) => {
              setLowStockThreshold(parseInt(e.target.value) || 0)
              setCurrentPage(1)
            }}
            className="w-16 h-7 text-center font-bold bg-[#09090b]/50 border-[#27272a] text-xs"
          />
        </div>
      </div>

      {/* Filter and Search Actions Row */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-[#18181b] border border-[#27272a] rounded-md px-3 h-8 text-xs focus:outline-none focus:border-slate-600 text-slate-300"
          >
            <option value="all">All Stock Statuses</option>
            <option value="instock">In Stock</option>
            <option value="lowstock">Low Stock Alerts</option>
            <option value="outofstock">Out of Stock</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-[#18181b] border border-[#27272a] rounded-md px-3 h-8 text-xs focus:outline-none focus:border-slate-600 text-slate-300"
          >
            <option value="all">All Categories</option>
            {getHierarchicalCategories(categories).map((c) => (
              <option key={c.id} value={c.name}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="w-64">
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Product List Table */}
      <Container className="p-0 overflow-hidden border border-[#27272a] bg-[#18181b]/10">
        <div className="w-full overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row className="border-b border-[#27272a] hover:bg-transparent">
                <Table.HeaderCell className="pl-4">Product</Table.HeaderCell>
                <Table.HeaderCell>SKU / Barcode</Table.HeaderCell>
                <Table.HeaderCell>Stock Status</Table.HeaderCell>
                <Table.HeaderCell>Quantity</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell className="text-right pr-4">Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {paginatedProducts.map((p) => {
                const primaryVariant = p.variants?.[0]
                const manages = primaryVariant?.manage_inventory ?? false

                let statusText = "In Stock"
                let statusColor: "green" | "orange" | "red" = "green"

                if (p.total_quantity === 0) {
                  statusText = "Out of Stock"
                  statusColor = "red"
                } else if (p.total_quantity <= lowStockThreshold) {
                  statusText = "Low Stock"
                  statusColor = "orange"
                }

                return (
                  <Table.Row key={p.id} className="border-b border-[#27272a]/60 hover:bg-[#18181b]/30">
                    {/* Product Details with Thumbnail */}
                    <Table.Cell className="pl-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                          {p.thumbnail ? (
                            <img src={getImageUrl(p.thumbnail)} alt={p.title} className="object-cover w-full h-full" />
                          ) : (
                            <span className="text-slate-600 font-bold text-[10px]">Box</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-slate-200 block text-xs truncate max-w-[280px]">{p.title}</span>
                          <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">{p.id}</span>
                        </div>
                      </div>
                    </Table.Cell>

                    {/* SKU Details */}
                    <Table.Cell className="text-xs font-mono">
                      <span className="text-slate-300 block">{primaryVariant?.sku || "-"}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{primaryVariant?.barcode || ""}</span>
                    </Table.Cell>

                    {/* Stock Level Circle Status */}
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          statusColor === 'green' ? 'bg-emerald-500' :
                          statusColor === 'orange' ? 'bg-amber-500' : 'bg-rose-500'
                        }`}></span>
                        <span className="text-xs font-medium text-slate-300">{statusText}</span>
                      </div>
                    </Table.Cell>

                    {/* Stock Quantity */}
                    <Table.Cell className="font-bold text-slate-200 text-xs">
                      {p.total_quantity} qty
                    </Table.Cell>

                    {/* Medusa status badge */}
                    <Table.Cell>
                      <Badge color={p.status === "published" ? "green" : "grey"}>
                        {p.status}
                      </Badge>
                    </Table.Cell>

                    {/* Action adjust stock button */}
                    <Table.Cell className="text-right pr-4">
                      {primaryVariant && manages ? (
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleOpenAdjustModal(p, primaryVariant)}
                          className="h-7 text-xs font-semibold"
                        >
                          Adjust Stock
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No Tracking</span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
              {paginatedProducts.length === 0 && (
                <Table.Row>
                  <Table.Cell {...({ colSpan: 6 } as any)} className="text-center italic py-8 text-slate-500">
                    No products found.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>

        {/* Table Footer with Pagination Controls */}
        <div className="flex justify-between items-center px-4 py-3 bg-[#18181b]/10 border-t border-[#27272a] text-xs text-slate-400">
          <div>
            {filteredProducts.length > 0 ? (
              <span>
                {startIndex + 1} – {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} results
              </span>
            ) : (
              <span>0 results</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              Page {currentPage} of {totalPages || 1}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="small"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="h-7 px-3 text-xs"
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                size="small"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                className="h-7 px-3 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </Container>

      {/* History Log Section */}
      <Container className="p-6 border-[#27272a] bg-[#18181b]/10">
        <Heading level="h2" className="text-lg font-bold mb-1">
          Stock Adjustment Audit Trail
        </Heading>
        <Text className="text-xs text-slate-500 mb-4 block">Logs of all manual inventory updates.</Text>
        
        <div className="w-full overflow-x-auto table-scroll-all">
          <Table>
            <Table.Header>
              <Table.Row className="border-b border-[#27272a] hover:bg-transparent">
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>SKU</Table.HeaderCell>
                <Table.HeaderCell>Change</Table.HeaderCell>
                <Table.HeaderCell>New Balance</Table.HeaderCell>
                <Table.HeaderCell>Updated By</Table.HeaderCell>
                <Table.HeaderCell>Date & Time</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {logs.slice(0, 15).map((log) => (
                <Table.Row key={log.id} className="border-b border-[#27272a]/60 hover:bg-[#18181b]/30">
                  <Table.Cell className="font-medium text-xs text-slate-300">{log.product_title}</Table.Cell>
                  <Table.Cell className="font-mono text-xs text-slate-400">{log.sku}</Table.Cell>
                  <Table.Cell>
                    <span className={`font-bold text-xs ${log.change_amount > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="font-semibold text-slate-300 text-xs">{log.new_quantity}</Table.Cell>
                  <Table.Cell className="text-xs text-slate-400">{log.updated_by}</Table.Cell>
                  <Table.Cell className="text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleString("en-IN")}
                  </Table.Cell>
                </Table.Row>
              ))}
              {logs.length === 0 && (
                <Table.Row>
                  <Table.Cell {...({ colSpan: 6 } as any)} className="text-center italic py-4 text-slate-500">
                    No inventory adjustment logs recorded.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </Container>

      {/* Adjust Modal */}
      {selectedVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[#18181b] border border-[#27272a] w-full max-w-md p-6 rounded-lg shadow-xl text-slate-200 relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <Heading level="h2" className="text-base font-semibold text-slate-100">Adjust Quantity</Heading>
                <div className="text-xs text-slate-400 mt-2 space-y-1.5 leading-relaxed">
                  <div>Update stock level for product:</div>
                  <div className="font-semibold text-slate-200 truncate max-w-[340px]">{selectedVariant.productTitle}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">SKU:</div>
                  <div className="font-mono text-[10px] text-slate-300 bg-[#09090b]/80 px-2 py-1 rounded border border-[#27272a] break-all select-all">
                    {selectedVariant.sku}
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedVariant(null)} 
                className="text-slate-500 hover:text-slate-300 shrink-0 p-1 rounded-md hover:bg-slate-800/50 transition-all"
              >
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              {/* Current stock status row */}
              <div className="py-2.5 px-3 bg-[#09090b]/50 border border-[#27272a] rounded-md flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Current Stock</span>
                <span className="font-bold text-slate-200">{selectedVariant.currentQty} Units</span>
              </div>

              {/* Action tabs segment controller */}
              <div className="flex bg-[#09090b]/50 p-1 border border-[#27272a] rounded-md gap-1">
                {[
                  { id: "set", label: "Set" },
                  { id: "add", label: "Add" },
                  { id: "reduce", label: "Reduce" }
                ].map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => {
                      setAdjustType(act.id as any)
                      setInputValue("")
                    }}
                    className={`flex-1 py-1 text-xs font-medium rounded-sm transition-all ${
                      adjustType === act.id
                        ? "bg-[#18181b] text-slate-100 border border-[#27272a] shadow-sm font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>

              {/* Numerical adjust quantity input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold block text-slate-400">
                  {adjustType === "set" ? "New quantity" : adjustType === "add" ? "Quantity to add" : "Quantity to reduce"}
                </label>
                <Input
                  type="number"
                  min="0"
                  value={inputValue}
                  onChange={(e) => {
                    const val = e.target.value
                    setInputValue(val === "" ? "" : parseInt(val) || 0)
                  }}
                  className="h-8 bg-[#09090b]/50 border-[#27272a] text-slate-200 focus:border-slate-500 text-xs"
                  required
                />
              </div>

              {/* Submit footer actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-[#27272a]">
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="small" 
                  onClick={() => setSelectedVariant(null)}
                  className="h-8 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="small" 
                  disabled={submitting}
                  className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 border-none text-white"
                >
                  {submitting ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
)

const BoxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
)

export const config = defineRouteConfig({
  label: "Inventory",
  icon: BoxIcon,
})

export default InventoryPage
