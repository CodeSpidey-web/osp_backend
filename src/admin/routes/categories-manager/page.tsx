import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Button, Text, Input, Label, FocusModal } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useRoleGuard } from "../../utils/useRoleGuard"

type Category = {
  id: string
  name: string
  handle: string
  parent_category_id: string | null
  parent_category?: { name: string } | null
}

type HierarchicalCategory = {
  id: string
  name: string
  handle: string
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
        handle: child.handle,
        parent_category_id: child.parent_category_id,
        level,
        path: pathStr,
        label: level === 0 
          ? `📦 ${child.name}` 
          : `${prefix}${icon} ${child.name} (${pathStr})`,
      })

      traverse(child.id, level + 1, fullPath)
    }
  }

  traverse(null, 0, [])

  const traversedIds = new Set(result.map((r) => r.id))
  categories.forEach((cat) => {
    if (!traversedIds.has(cat.id)) {
      result.push({
        id: cat.id,
        name: cat.name,
        handle: cat.handle,
        parent_category_id: cat.parent_category_id,
        level: 0,
        path: cat.name,
        label: `📦 ${cat.name}`,
      })
    }
  })

  return result
}

const CategoriesPage = () => {
  const { authorized, loading: authLoading } = useRoleGuard()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Modal / Drawer state
  const [isOpen, setIsOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)

  // Popular Categories Tab State
  const [activeTab, setActiveTab] = useState<"all" | "popular">("all")
  const [popularCategories, setPopularCategories] = useState<{ id: string; image_url: string }[]>([])
  const [popularSaving, setPopularSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [selectedAddId, setSelectedAddId] = useState("")

  const getAdminImageUrl = (url?: string | null) => {
    if (!url) return ""
    if (url.startsWith("http://localhost:9000/static") || url.startsWith("http://localhost:8000/static")) {
      return url.replace(/^http:\/\/localhost:\d+\/static/, "/static")
    }
    return url
  }

  const loadPopularCategories = async () => {
    try {
      const res = await fetch("/admin/client-dashboard/popular-categories", { credentials: "include" })
      const data = await res.json()
      setPopularCategories(data.popular_categories || [])
    } catch (err) {
      console.error("Failed to load popular categories:", err)
    }
  }

  const handleAddPopular = () => {
    if (!selectedAddId) return
    if (popularCategories.some((c) => c.id === selectedAddId)) {
      alert("This category is already selected as popular.")
      return
    }
    if (popularCategories.length >= 20) {
      alert("You can select a maximum of 20 categories as popular categories.")
      return
    }
    setPopularCategories((prev) => [...prev, { id: selectedAddId, image_url: "" }])
    setSelectedAddId("")
  }

  const handleRemovePopular = (id: string) => {
    setPopularCategories((prev) => prev.filter((c) => c.id !== id))
  }

  const handleMovePopular = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === popularCategories.length - 1) return

    const newItems = [...popularCategories]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    const temp = newItems[index]
    newItems[index] = newItems[targetIndex]
    newItems[targetIndex] = temp
    setPopularCategories(newItems)
  }

  const handlePopularImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, catId: string) => {
    if (!e.target.files || e.target.files.length === 0) return
    setUploadingId(catId)
    try {
      const file = e.target.files[0]
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
        const url = data.files[0].url
        setPopularCategories((prev) =>
          prev.map((c) => c.id === catId ? { ...c, image_url: url } : c)
        )
      }
    } catch (err) {
      alert("Failed to upload image. Please try again.")
    } finally {
      setUploadingId(null)
    }
  }

  const handleRemovePopularImage = (catId: string) => {
    setPopularCategories((prev) =>
      prev.map((c) => c.id === catId ? { ...c, image_url: "" } : c)
    )
  }

  const handleSavePopular = async () => {
    setPopularSaving(true)
    try {
      const res = await fetch("/admin/client-dashboard/popular-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ popular_categories: popularCategories }),
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error("Failed to save selection.")
      }
      alert("Popular categories saved successfully!")
    } catch (err: any) {
      alert(err.message || "Failed to save selection.")
    } finally {
      setPopularSaving(false)
    }
  }

  // Form Fields
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [parentId, setParentId] = useState("")

  const loadCategories = async () => {
    setLoading(true)
    try {
      const res = await fetch("/admin/product-categories?limit=500&include_descendants_tree=true", { credentials: "include" })
      const data = await res.json()
      setCategories(data.product_categories || [])
    } catch (err) {
      console.error("Failed to load categories:", err)
    } finally {
      setLoading(false)
    }
  }

  const hierarchicalCategories = buildHierarchicalCategoryList(categories)

  useEffect(() => {
    if (authLoading || !authorized) return
    loadCategories()
    loadPopularCategories()
  }, [authLoading, authorized])

  const handleOpenCreate = () => {
    setEditingCategory(null)
    setName("")
    setHandle("")
    setParentId("")
    setIsOpen(true)
  }

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat)
    setName(cat.name || "")
    setHandle(cat.handle || "")
    setParentId(cat.parent_category_id || "")
    setIsOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return alert("Category Name is required")

    setSaving(true)
    try {
      const handleVal = handle || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      const payload = {
        name,
        handle: handleVal,
        parent_category_id: parentId || null,
      }

      if (editingCategory) {
        const res = await fetch(`/admin/product-categories/${editingCategory.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        })
        if (!res.ok) throw new Error("Failed to update category")
      } else {
        const res = await fetch("/admin/product-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        })
        if (!res.ok) throw new Error("Failed to create category")
      }

      setIsOpen(false)
      loadCategories()
    } catch (err: any) {
      alert(err.message || "An error occurred during save.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (catId: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return
    setLoading(true)
    try {
      const res = await fetch(`/admin/product-categories/${catId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete category")
      loadCategories()
    } catch (err: any) {
      alert(err.message || "Failed to delete category")
      setLoading(false)
    }
  }

  if (authLoading) return <Container className="p-8"><Text>Checking authorization...</Text></Container>
  if (!authorized) return <Container className="p-8"><Heading level="h1" className="text-xl font-bold text-rose-500 mb-2">Access Denied</Heading></Container>

  const filteredCategories = categories.filter((c) => {
    const term = search.toLowerCase()
    return c.name.toLowerCase().includes(term) || c.handle.toLowerCase().includes(term)
  })

  // Filter other categories to prevent parenting loops
  const eligibleParents = categories.filter((c) => !editingCategory || c.id !== editingCategory.id)

  // Map category ID to Name for quick lookup
  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]))

  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Heading level="h1" className="text-xl font-bold">Categories Manager</Heading>
          <Text className="text-xs text-slate-400 mt-0.5">Manage store categories and product mappings.</Text>
        </div>
        {activeTab === "all" && (
          <Button onClick={handleOpenCreate}>Add New Category</Button>
        )}
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
          All Categories
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("popular")}
          className={`pb-2.5 text-sm font-semibold transition-all border-b-2 bg-transparent cursor-pointer px-2 ${
            activeTab === "popular"
              ? "border-emerald-500 text-emerald-400 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Popular Categories
        </button>
      </div>

      {activeTab === "all" ? (
        <>
          <div className="mb-4">
            <Input 
              placeholder="Search categories by name or handle..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="py-8 text-center"><Text>Loading categories...</Text></div>
          ) : (
            <div className="w-full overflow-x-auto table-scroll-all">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Category Name</Table.HeaderCell>
                    <Table.HeaderCell>Handle</Table.HeaderCell>
                    <Table.HeaderCell>Parent Category</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filteredCategories.map((c) => (
                    <Table.Row key={c.id}>
                      <Table.Cell className="font-semibold text-slate-200">{c.name}</Table.Cell>
                      <Table.Cell className="font-mono text-xs">{c.handle}</Table.Cell>
                      <Table.Cell>
                        {c.parent_category_id ? (
                          <span className="text-slate-400">{categoryNameMap.get(c.parent_category_id) || "Parent Category"}</span>
                        ) : (
                          <span className="text-slate-500 italic">None (Root)</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-right space-x-2">
                        <Button variant="secondary" size="small" onClick={() => handleOpenEdit(c)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="small" onClick={() => handleDelete(c.id)}>
                          Delete
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  {filteredCategories.length === 0 && (
                    <Table.Row>
                      <Table.Cell {...({ colSpan: 4 } as any)} className="text-center italic py-4 text-slate-500">
                        No categories found.
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-6 space-y-4">
            <Heading level="h2" className="text-sm font-semibold">Add Category to Popular Selection ({popularCategories.length} / 20)</Heading>
            
            <div className="flex gap-4">
              <select 
                value={selectedAddId}
                onChange={(e) => setSelectedAddId(e.target.value)}
                className="flex-grow bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              >
                <option value="">Choose a category to add...</option>
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
              <Button onClick={handleAddPopular} disabled={!selectedAddId}>Add Category</Button>
            </div>
          </div>

          <div className="w-full overflow-x-auto table-scroll-all">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Order</Table.HeaderCell>
                  <Table.HeaderCell>Category Name</Table.HeaderCell>
                  <Table.HeaderCell>Popular Image</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {popularCategories.map((p, idx) => {
                  const catName = categoryNameMap.get(p.id) || "Unknown Category"
                  
                  return (
                    <Table.Row key={p.id}>
                      <Table.Cell className="font-semibold text-slate-400">#{idx + 1}</Table.Cell>
                      <Table.Cell className="font-semibold text-slate-200">{catName}</Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-4">
                          {p.image_url ? (
                            <div className="relative border border-slate-800 p-1 rounded bg-slate-900 w-16 h-16 flex items-center justify-center">
                              <img src={getAdminImageUrl(p.image_url)} alt={catName} className="max-w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-500 text-[10px] text-center">No Image</div>
                          )}
                          
                          <div className="space-y-1.5">
                            <input 
                              type="file" 
                              id={`pop-img-upload-${p.id}`}
                              accept="image/*"
                              className="hidden" 
                              onChange={(e) => handlePopularImageUpload(e, p.id)} 
                            />
                            <label 
                              htmlFor={`pop-img-upload-${p.id}`}
                              className="cursor-pointer inline-flex items-center justify-center px-3 py-1.5 bg-slate-900 border border-slate-800 text-[10px] font-semibold rounded text-slate-200 hover:bg-slate-800 transition"
                            >
                              {uploadingId === p.id ? "Uploading..." : p.image_url ? "Replace Image" : "Upload Image"}
                            </label>
                            
                            {p.image_url && (
                              <button 
                                type="button" 
                                onClick={() => handleRemovePopularImage(p.id)}
                                className="block text-[10px] text-rose-400 hover:text-rose-300 font-semibold bg-transparent border-0 cursor-pointer"
                              >
                                Remove Image
                              </button>
                            )}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-right space-x-2">
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={idx === 0}
                          onClick={() => handleMovePopular(idx, "up")}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={idx === popularCategories.length - 1}
                          onClick={() => handleMovePopular(idx, "down")}
                        >
                          ↓
                        </Button>
                        <Button variant="danger" size="small" onClick={() => handleRemovePopular(p.id)}>
                          Remove
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
                {popularCategories.length === 0 && (
                  <Table.Row>
                    <Table.Cell {...({ colSpan: 4 } as any)} className="text-center italic py-8 text-slate-500">
                      No popular categories selected. Use the selector above to add up to 20 categories.
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <Button onClick={handleSavePopular} disabled={popularSaving} variant="primary">
              {popularSaving ? "Saving Selection..." : "Save Selection"}
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
                  {editingCategory ? `Edit Category: ${editingCategory.name}` : "Add New Category"}
                </Heading>
                <div className="space-x-2">
                  <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Category"}</Button>
                </div>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="p-8 space-y-6 overflow-y-auto max-w-xl mx-auto w-full">
              
              {/* Category Name */}
              <div className="space-y-2">
                <Label htmlFor="cat-name">Category Name</Label>
                <Input 
                  id="cat-name" 
                  placeholder="e.g. Arduino Boards" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required
                />
              </div>

              {/* Category Handle */}
              <div className="space-y-2">
                <Label htmlFor="cat-handle">URL Handle (Optional)</Label>
                <Input 
                  id="cat-handle" 
                  placeholder="e.g. arduino-boards (auto-generated if left empty)" 
                  value={handle} 
                  onChange={(e) => setHandle(e.target.value)} 
                />
              </div>

              {/* Parent Category */}
              <div className="space-y-2">
                <Label htmlFor="cat-parent">Parent Category (Optional)</Label>
                <select 
                  id="cat-parent"
                  value={parentId} 
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                >
                  <option value="">None (Root Category)</option>
                  {hierarchicalCategories
                    .filter((c) => !editingCategory || c.id !== editingCategory.id)
                    .map((cat) => (
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
                  Select a parent category to nest this item as a sub-category or grandchild.
                </Text>
              </div>

            </FocusModal.Body>
          </form>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
)

export const config = defineRouteConfig({
  label: "Categories",
  icon: ListIcon,
})

export default CategoriesPage
