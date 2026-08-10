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
        <Button onClick={handleOpenCreate}>Add New Category</Button>
      </div>

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
