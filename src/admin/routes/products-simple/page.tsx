import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Button, Text, Input, Label, Textarea, FocusModal } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useRoleGuard } from "../../utils/useRoleGuard"

type MedusaProduct = {
  id: string
  title: string
  handle: string
  description: string
  thumbnail: string
  images: { id: string; url: string }[]
  categories?: { id: string; name: string }[]
  variants?: {
    id: string
    title: string
    sku: string
    manage_inventory: boolean
    prices?: { id: string; amount: number; currency_code: string }[]
  }[]
}

type Category = {
  id: string
  name: string
  parent_category_id: string | null
  category_children?: Category[]
}

type HierarchicalCategory = {
  id: string
  name: string
  parent_category_id: string | null
  level: number
  path: string
  label: string
}

function buildHierarchicalCategoryList(categories: Category[]): HierarchicalCategory[] {
  const childrenMap = new Map<string | null, Category[]>()
  
  categories.forEach((cat) => {
    const pId = cat.parent_category_id || null
    if (!childrenMap.has(pId)) {
      childrenMap.set(pId, [])
    }
    childrenMap.get(pId)!.push(cat)
  })

  // Sort groups alphabetically
  childrenMap.forEach((list) => {
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  })

  const result: HierarchicalCategory[] = []

  function traverse(parentId: string | null, level: number, currentPath: string[]) {
    const children = childrenMap.get(parentId) || []
    for (const child of children) {
      const fullPath = [...currentPath, child.name]
      const pathStr = fullPath.join(" > ")
      
      let prefix = ""
      let icon = "📦"

      if (level === 0) {
        icon = "📦"
        prefix = ""
      } else if (level === 1) {
        icon = "📂"
        prefix = "\u00A0\u00A0\u00A0\u00A0└── "
      } else if (level === 2) {
        icon = "🔹"
        prefix = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0└── "
      } else {
        icon = "🔸"
        prefix = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0└── "
      }

      result.push({
        id: child.id,
        name: child.name,
        parent_category_id: child.parent_category_id,
        level,
        path: pathStr,
        label: level === 0 
          ? `📦 ${child.name}` 
          : `${prefix}${icon} ${child.name} (${pathStr})`,
      })

      // Recurse into children and grandchildren
      traverse(child.id, level + 1, fullPath)
    }
  }

  traverse(null, 0, [])

  // Include any orphan categories
  const traversedIds = new Set(result.map((r) => r.id))
  categories.forEach((cat) => {
    if (!traversedIds.has(cat.id)) {
      result.push({
        id: cat.id,
        name: cat.name,
        parent_category_id: cat.parent_category_id,
        level: 0,
        path: cat.name,
        label: `📦 ${cat.name}`,
      })
    }
  })

  return result
}

const SimpleProductsPage = () => {
  const { authorized, loading: authLoading } = useRoleGuard()
  const [products, setProducts] = useState<MedusaProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [totalProducts, setTotalProducts] = useState(0)

  // Latest Products Tab State
  const [activeTab, setActiveTab] = useState<"all" | "latest">("all")
  const [latestProducts, setLatestProducts] = useState<MedusaProduct[]>([])
  const [latestSearch, setLatestSearch] = useState("")
  const [latestSearchResults, setLatestSearchResults] = useState<MedusaProduct[]>([])
  const [latestSaving, setLatestSaving] = useState(false)
  
  // Modal / Drawer state
  const [isOpen, setIsOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<MedusaProduct | null>(null)
  const [saving, setSaving] = useState(false)

  // Form Fields
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [price, setPrice] = useState("")
  const [sku, setSku] = useState("")
  const [stock, setStock] = useState("")
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [stockMap, setStockMap] = useState<Record<string, { inventory_item_id: string | null; quantity: number }>>({})

  const getAdminImageUrl = (url?: string | null) => {
    if (!url) return ""
    if (url.startsWith("http://localhost:9000/static") || url.startsWith("http://localhost:8000/static")) {
      return url.replace(/^http:\/\/localhost:\d+\/static/, "/static")
    }
    return url
  }

  // Defaults fetched from backend
  const [defaultShippingProfileId, setDefaultShippingProfileId] = useState("")
  const [defaultSalesChannelId, setDefaultSalesChannelId] = useState("")

  const loadCategories = async () => {
    try {
      const catRes = await fetch("/admin/product-categories?limit=500&include_descendants_tree=true", { credentials: "include" })
      const catData = await catRes.json()
      setCategories(catData.product_categories || [])
    } catch (err) {
      console.error("Failed to load categories:", err)
    }
  }

  const loadProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", String(pageSize))
      params.set("offset", String((page - 1) * pageSize))
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
      const prodRes = await fetch(`/admin/products?${params.toString()}`, { credentials: "include" })
      const prodData = await prodRes.json()
      setProducts(prodData.products || [])
      setTotalProducts(typeof prodData.count === "number" ? prodData.count : (prodData.products || []).length)

      // Fetch stock for the variants on this page
      const variantIds = (prodData.products || [])
        .map((p: any) => p.variants?.[0]?.id)
        .filter(Boolean)
      if (variantIds.length > 0) {
        const stkRes = await fetch(`/admin/client-dashboard/variant-stock?variant_ids=${encodeURIComponent(variantIds.join(","))}`, { credentials: "include" })
        const stkData = await stkRes.json()
        setStockMap(stkData.variants || {})
      } else {
        setStockMap({})
      }
    } catch (err) {
      console.error("Failed to load products:", err)
    } finally {
      setLoading(false)
    }
  }

  const loadLatestProducts = async () => {
    try {
      const res = await fetch("/admin/client-dashboard/latest-products", { credentials: "include" })
      const data = await res.json()
      setLatestProducts(data.products || [])
    } catch (err) {
      console.error("Failed to load latest products:", err)
    }
  }

  const handleAddLatest = (prod: MedusaProduct) => {
    if (latestProducts.some((p) => p.id === prod.id)) {
      alert("This product is already added to latest products.")
      return
    }
    if (latestProducts.length >= 10) {
      alert("You can select a maximum of 10 products as latest products.")
      return
    }
    setLatestProducts((prev) => [...prev, prod])
    setLatestSearch("")
    setLatestSearchResults([])
  }

  const handleRemoveLatest = (id: string) => {
    setLatestProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const handleMoveLatest = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === latestProducts.length - 1) return

    const newItems = [...latestProducts]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    const temp = newItems[index]
    newItems[index] = newItems[targetIndex]
    newItems[targetIndex] = temp
    setLatestProducts(newItems)
  }

  const handleSaveLatest = async () => {
    setLatestSaving(true)
    try {
      const res = await fetch("/admin/client-dashboard/latest-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_ids: latestProducts.map((p) => p.id),
        }),
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error("Failed to save selection.")
      }
      alert("Latest products saved successfully!")
    } catch (err: any) {
      alert(err.message || "Failed to save selection.")
    } finally {
      setLatestSaving(false)
    }
  }

  useEffect(() => {
    if (authLoading || !authorized) return
    loadLatestProducts()
  }, [authLoading, authorized])

  useEffect(() => {
    if (!latestSearch.trim()) {
      setLatestSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/admin/products?q=${encodeURIComponent(latestSearch.trim())}&limit=10`, { credentials: "include" })
        const data = await res.json()
        setLatestSearchResults(data.products || [])
      } catch (err) {
        console.error("Error searching products for latest:", err)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [latestSearch])

  const hierarchicalCategories = buildHierarchicalCategoryList(categories)

  useEffect(() => {
    if (authLoading || !authorized) return
    loadCategories()

    // Fetch defaults for new products
    fetch("/admin/shipping-profiles", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.shipping_profiles?.length > 0) {
          setDefaultShippingProfileId(data.shipping_profiles[0].id)
        }
      })

    fetch("/admin/sales-channels", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.sales_channels?.length > 0) {
          setDefaultSalesChannelId(data.sales_channels[0].id)
        }
      })
  }, [authLoading, authorized])

  useEffect(() => {
    if (authLoading || !authorized) return
    loadProducts()
  }, [authLoading, authorized, page, debouncedSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setDebouncedSearch(search)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const handleOpenCreate = () => {
    setEditingProduct(null)
    setTitle("")
    setDescription("")
    setCategoryId("")
    setPrice("")
    setSku("")
    setStock("")
    setUploadedUrls([])
    setIsOpen(true)
  }

  const handleOpenEdit = (p: MedusaProduct) => {
    setEditingProduct(p)
    setTitle(p.title || "")
    setDescription(p.description || "")
    setCategoryId(p.categories?.[0]?.id || "")
    
    const variant = p.variants?.[0]
    setSku(variant?.sku || "")
    setStock(variant?.id && stockMap[variant.id] ? String(stockMap[variant.id].quantity) : "")
    
    const inrPrice = variant?.prices?.find((pr) => pr.currency_code === "inr") || variant?.prices?.[0]
    setPrice(inrPrice ? String(inrPrice.amount) : "")
    setUploadedUrls(p.images?.map((img) => img.url) || [])
    setIsOpen(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setUploading(true)
    try {
      const files = Array.from(e.target.files)
      const urls: string[] = []
      
      for (const file of files) {
        const formData = new FormData()
        formData.append("files", file)
        
        const res = await fetch("/admin/uploads", {
          method: "POST",
          body: formData,
          credentials: "include",
        })
        if (!res.ok) throw new Error("Upload failed")
        const data = await res.json()
        if (data.files?.[0]?.url) {
          urls.push(data.files[0].url)
        }
      }
      
      setUploadedUrls((prev) => [...prev, ...urls])
    } catch (err) {
      alert("Failed to upload image(s). Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = (index: number) => {
    setUploadedUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return alert("Title is required")
    if (!price || isNaN(Number(price))) return alert("Valid price is required")

    const stockNum = stock.trim() === "" ? null : Number(stock)
    if (stockNum !== null && (isNaN(stockNum) || stockNum < 0)) return alert("Stock count must be 0 or a positive number")

    setSaving(true)
    try {
      const priceNum = Number(price)
      const categoryIds = categoryId ? [categoryId] : []
      const categoryAssociations = categoryIds.map((id) => ({ id }))
      const imagesArr = uploadedUrls.map((url) => ({ url }))
      const thumbnailVal = uploadedUrls[0] || ""

      const setStockForVariant = async (variantId?: string) => {
        if (stockNum === null || !variantId) return
        const stkRes = await fetch("/admin/client-dashboard/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variant_id: variantId,
            quantity: stockNum,
          }),
          credentials: "include",
        })
        if (!stkRes.ok) throw new Error("Failed to save stock count")
      }

      if (editingProduct) {
        // 1. Update basic product fields
        const prodUpdateRes = await fetch(`/admin/products/${editingProduct.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            categories: categoryAssociations,
            thumbnail: thumbnailVal,
            images: imagesArr,
          }),
          credentials: "include",
        })
        if (!prodUpdateRes.ok) throw new Error("Failed to update product details")

        // 2. Update variant SKU & price
        const variant = editingProduct.variants?.[0]
        if (variant) {
          const varUpdateRes = await fetch(`/admin/products/${editingProduct.id}/variants/${variant.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sku: sku || variant.sku,
              prices: [
                {
                  currency_code: "inr",
                  amount: priceNum,
                },
              ],
            }),
            credentials: "include",
          })
          if (!varUpdateRes.ok) throw new Error("Failed to update variant price/SKU")

          // 3. Set stock count
          await setStockForVariant(variant.id)
        }
      } else {
        // Create standard product
        const handleVal = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
        
        const createRes = await fetch("/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            handle: handleVal,
            description,
            categories: categoryAssociations,
            thumbnail: thumbnailVal,
            images: imagesArr,
            status: "published",
            shipping_profile_id: defaultShippingProfileId,
            sales_channels: defaultSalesChannelId ? [{ id: defaultSalesChannelId }] : undefined,
            options: [
              {
                title: "Specification",
                values: ["Standard"],
              },
            ],
            variants: [
              {
                title: "Standard",
                sku: sku || `sku-${Date.now()}`,
                manage_inventory: true,
                options: {
                  Specification: "Standard",
                },
                prices: [
                  {
                    currency_code: "inr",
                    amount: priceNum,
                  },
                ],
              },
            ],
          }),
          credentials: "include",
        })
        if (!createRes.ok) {
          const errBody = await createRes.json()
          throw new Error(errBody.message || "Failed to create product")
        }

        // Set stock count on the freshly created variant
        const createdProduct = await createRes.json()
        await setStockForVariant(createdProduct.product?.variants?.[0]?.id || createdProduct.variants?.[0]?.id)
      }

      setIsOpen(false)
      loadProducts()
    } catch (err: any) {
      alert(err.message || "An error occurred during save.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return
    setLoading(true)
    try {
      const res = await fetch(`/admin/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete product")
      loadProducts()
    } catch (err: any) {
      alert(err.message || "Failed to delete product")
      setLoading(false)
    }
  }

  if (authLoading) return <Container className="p-8"><Text>Checking authorization...</Text></Container>
  if (!authorized) return <Container className="p-8"><Heading level="h1" className="text-xl font-bold text-rose-500 mb-2">Access Denied</Heading></Container>

  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize))
  const startItem = totalProducts === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalProducts)

  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Heading level="h1" className="text-xl font-bold">Products Manager</Heading>
          <Text className="text-xs text-slate-400 mt-0.5">Add, edit, or remove catalog items.</Text>
        </div>
        <Button onClick={handleOpenCreate}>Add New Product</Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-x-4">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`pb-2.5 text-sm font-semibold transition-all border-b-2 bg-transparent cursor-pointer px-2 ${
            activeTab === "all"
              ? "border-emerald-500 text-emerald-400 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          All Products
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("latest")}
          className={`pb-2.5 text-sm font-semibold transition-all border-b-2 bg-transparent cursor-pointer px-2 ${
            activeTab === "latest"
              ? "border-emerald-500 text-emerald-400 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Latest Products Selection
        </button>
      </div>

      {activeTab === "all" ? (
        <>
          <div className="mb-4">
            <Input 
              placeholder="Search products by title, SKU, description..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Text className="text-xs text-slate-400 mt-1">
              {debouncedSearch ? `Showing products matching "${debouncedSearch}"` : "Showing all products"} · {totalProducts.toLocaleString()} total
            </Text>
          </div>

          {loading ? (
            <div className="py-8 text-center"><Text>Loading catalog...</Text></div>
          ) : (
            <div className="w-full overflow-x-auto table-scroll-all">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Image</Table.HeaderCell>
                    <Table.HeaderCell>Title</Table.HeaderCell>
                    <Table.HeaderCell>SKU</Table.HeaderCell>
                    <Table.HeaderCell>Category</Table.HeaderCell>
                    <Table.HeaderCell>Price</Table.HeaderCell>
                    <Table.HeaderCell>Stock</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {products.map((p) => {
                    const variant = p.variants?.[0]
                    const inrPrice = variant?.prices?.find((pr) => pr.currency_code === "inr") || variant?.prices?.[0]
                    
                    return (
                      <Table.Row key={p.id}>
                        <Table.Cell>
                          {p.thumbnail ? (
                            <img src={getAdminImageUrl(p.thumbnail)} alt={p.title} className="w-12 h-12 rounded object-contain bg-slate-900 border border-slate-800" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-slate-500 text-xs">No Image</div>
                          )}
                        </Table.Cell>
                        <Table.Cell className="font-semibold text-slate-200">{p.title}</Table.Cell>
                        <Table.Cell className="font-mono text-xs">{variant?.sku || "-"}</Table.Cell>
                        <Table.Cell>{p.categories?.map((c) => c.name).join(", ") || "-"}</Table.Cell>
                        <Table.Cell className="font-bold text-emerald-400">
                          {inrPrice 
                            ? new Intl.NumberFormat("en-IN", { style: "currency", currency: inrPrice.currency_code }).format(inrPrice.amount)
                            : "-"
                          }
                        </Table.Cell>
                        <Table.Cell className="font-semibold">
                          {variant?.id && stockMap[variant.id] !== undefined
                            ? <span className={stockMap[variant.id].quantity > 0 ? "text-slate-200" : "text-rose-400"}>{stockMap[variant.id].quantity}</span>
                            : "-"
                          }
                        </Table.Cell>
                        <Table.Cell className="text-right space-x-2">
                          <Button variant="secondary" size="small" onClick={() => handleOpenEdit(p)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="small" onClick={() => handleDelete(p.id)}>
                            Delete
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                  {products.length === 0 && (
                    <Table.Row>
                      <Table.Cell {...({ colSpan: 7 } as any)} className="text-center italic py-4 text-slate-500">
                        No products found matching the criteria.
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </div>
          )}

          {/* Pagination controls */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <Text className="text-xs text-slate-400">
                Showing {startItem.toLocaleString()}–{endItem.toLocaleString()} of {totalProducts.toLocaleString()} products
              </Text>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Text className="text-xs text-slate-400 min-w-24 text-center">
                  Page {page} / {totalPages}
                </Text>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-6 space-y-4">
            <Heading level="h2" className="text-sm font-semibold">Add Product to Latest Selection ({latestProducts.length} / 10)</Heading>
            
            <div className="relative">
              <Input
                placeholder="Type product title to search and add..."
                value={latestSearch}
                onChange={(e) => setLatestSearch(e.target.value)}
              />
              
              {latestSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
                  {latestSearchResults.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleAddLatest(prod)}
                      className="flex items-center justify-between p-3 hover:bg-slate-900 cursor-pointer border-b border-slate-900 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        {prod.thumbnail ? (
                          <img src={getAdminImageUrl(prod.thumbnail)} alt={prod.title} className="w-8 h-8 rounded object-contain bg-slate-900" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-[10px] text-slate-500">No Img</div>
                        )}
                        <div>
                          <Text className="text-sm font-semibold text-slate-200">{prod.title}</Text>
                          <Text className="text-xs text-slate-400">{prod.variants?.[0]?.sku || "No SKU"}</Text>
                        </div>
                      </div>
                      <Button variant="secondary" size="small">Add</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-full overflow-x-auto table-scroll-all">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Order</Table.HeaderCell>
                  <Table.HeaderCell>Image</Table.HeaderCell>
                  <Table.HeaderCell>Title</Table.HeaderCell>
                  <Table.HeaderCell>SKU</Table.HeaderCell>
                  <Table.HeaderCell>Price</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {latestProducts.map((p, idx) => {
                  const variant = p.variants?.[0]
                  const inrPrice = variant?.prices?.find((pr) => pr.currency_code === "inr") || variant?.prices?.[0]
                  
                  return (
                    <Table.Row key={p.id}>
                      <Table.Cell className="font-semibold text-slate-400">#{idx + 1}</Table.Cell>
                      <Table.Cell>
                        {p.thumbnail ? (
                          <img src={getAdminImageUrl(p.thumbnail)} alt={p.title} className="w-12 h-12 rounded object-contain bg-slate-900 border border-slate-800" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-slate-500 text-xs">No Image</div>
                        )}
                      </Table.Cell>
                      <Table.Cell className="font-semibold text-slate-200">{p.title}</Table.Cell>
                      <Table.Cell className="font-mono text-xs">{variant?.sku || "-"}</Table.Cell>
                      <Table.Cell className="font-bold text-emerald-400">
                        {inrPrice 
                          ? new Intl.NumberFormat("en-IN", { style: "currency", currency: inrPrice.currency_code }).format(inrPrice.amount)
                          : "-"
                        }
                      </Table.Cell>
                      <Table.Cell className="text-right space-x-2">
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={idx === 0}
                          onClick={() => handleMoveLatest(idx, "up")}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={idx === latestProducts.length - 1}
                          onClick={() => handleMoveLatest(idx, "down")}
                        >
                          ↓
                        </Button>
                        <Button variant="danger" size="small" onClick={() => handleRemoveLatest(p.id)}>
                          Remove
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
                {latestProducts.length === 0 && (
                  <Table.Row>
                    <Table.Cell {...({ colSpan: 6 } as any)} className="text-center italic py-8 text-slate-500">
                      No latest products selected. Use the search box above to add up to 10 products.
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <Button onClick={handleSaveLatest} disabled={latestSaving} variant="primary">
              {latestSaving ? "Saving Selection..." : "Save Selection"}
            </Button>
          </div>
        </div>
      )}

      {/* FocusModal for Add / Edit */}
      <FocusModal open={isOpen} onOpenChange={setIsOpen}>
        <FocusModal.Content>
          <form onSubmit={handleSave} className="flex flex-col h-full bg-slate-950">
            <FocusModal.Header>
              <div className="flex justify-between items-center w-full pr-6">
                <Heading level="h2" className="text-lg font-bold">
                  {editingProduct ? `Edit Product: ${editingProduct.title}` : "Add New Product"}
                </Heading>
                <div className="space-x-2">
                  <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Product"}</Button>
                </div>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="p-8 space-y-6 overflow-y-auto max-w-2xl mx-auto w-full">
              
              {/* Product Title */}
              <div className="space-y-2">
                <Label htmlFor="prod-title">Product Title</Label>
                <Input 
                  id="prod-title" 
                  placeholder="e.g. Arduino Uno R3" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  required
                />
              </div>

              {/* Category mapping */}
              <div className="space-y-2">
                <Label htmlFor="prod-category">Category (Parent, Child & Grandchild Hierarchy)</Label>
                <select 
                  id="prod-category"
                  value={categoryId} 
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                >
                  <option value="">Select a category...</option>
                  {hierarchicalCategories.map((cat) => (
                    <option 
                      key={cat.id} 
                      value={cat.id}
                      style={{
                        fontWeight: cat.level === 0 ? 'bold' : 'normal',
                        color: cat.level === 0 ? '#10b981' : cat.level === 1 ? '#f8fafc' : '#94a3b8'
                      }}
                    >
                      {cat.label}
                    </option>
                  ))}
                </select>
                <Text className="text-[11px] text-slate-400">
                  Select any category level. Parent (📁), Subcategory (└──), and Grandchildren are shown with their full breadcrumb path.
                </Text>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="prod-desc">Description</Label>
                <Textarea 
                  id="prod-desc" 
                  placeholder="Write a clear product description..." 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              {/* SKU */}
              <div className="space-y-2">
                <Label htmlFor="prod-sku">SKU (Default SKU)</Label>
                <Input 
                  id="prod-sku" 
                  placeholder="e.g. ARD-UNO-R3" 
                  value={sku} 
                  onChange={(e) => setSku(e.target.value)} 
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="prod-price">Price (INR)</Label>
                <Input 
                  id="prod-price" 
                  placeholder="e.g. 500" 
                  value={price} 
                  onChange={(e) => setPrice(e.target.value)} 
                  required
                />
                <Text className="text-[10px] text-slate-500">Enter standard Rupees directly. Do not multiply.</Text>
              </div>

              {/* Stock Count */}
              <div className="space-y-2">
                <Label htmlFor="prod-stock">Stock Count</Label>
                <Input 
                  id="prod-stock" 
                  type="number"
                  min={0}
                  placeholder="e.g. 100" 
                  value={stock} 
                  onChange={(e) => setStock(e.target.value)} 
                />
                <Text className="text-[10px] text-slate-500">Leave empty to keep the current/zero stock level. Set to 0 for Out of Stock.</Text>
              </div>

              {/* Multiple Images */}
              <div className="space-y-2">
                <Label>Product Images</Label>
                <div className="border border-dashed border-slate-850 p-6 rounded-lg text-center bg-slate-900/20">
                  <input 
                    type="file" 
                    id="file-upload" 
                    multiple 
                    accept="image/*"
                    onChange={handleImageUpload} 
                    className="hidden" 
                  />
                  <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-slate-900 border border-slate-800 text-xs font-semibold rounded text-slate-200 hover:bg-slate-800 transition">
                    {uploading ? "Uploading..." : "Choose Local Images..."}
                  </label>
                  <p className="text-[10px] text-slate-500 mt-2">Upload one or more product pictures. The first image will be set as the main thumbnail.</p>
                </div>

                {/* Uploaded image previews */}
                {uploadedUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    {uploadedUrls.map((url, index) => (
                      <div key={index} className="relative group border border-slate-850 p-2 rounded bg-slate-900/50">
                        <img src={getAdminImageUrl(url)} alt={`preview ${index}`} className="w-full h-24 object-contain" />
                        {index === 0 && (
                          <span className="absolute bottom-2 left-2 bg-emerald-500 text-[8px] font-bold text-slate-950 px-1.5 py-0.5 rounded uppercase">Main</span>
                        )}
                        <button 
                          type="button" 
                          onClick={() => handleRemoveImage(index)}
                          className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] hover:bg-rose-600 transition"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </FocusModal.Body>
          </form>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

const TagIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
    <line x1="7" y1="7" x2="7.01" y2="7"></line>
  </svg>
)

export const config = defineRouteConfig({
  label: "Products",
  icon: TagIcon,
})

export default SimpleProductsPage
