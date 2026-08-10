import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, Input } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useRoleGuard } from "../../utils/useRoleGuard"

interface Review {
  id: string
  product_id: string
  author: string
  rating: number
  title: string
  content: string
  verified: boolean
  created_at: string
  product_title?: string
}

const ProductReviewsPage = () => {
  const { authorized, loading: authLoading } = useRoleGuard()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const fetchReviews = () => {
    setLoading(true)
    fetch("/admin/client-dashboard/reviews", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch reviews")
        return r.json()
      })
      .then((data) => {
        setReviews(data.reviews || [])
      })
      .catch((err) => {
        console.error("Error loading reviews:", err)
        setMessage({ text: "Failed to load product reviews.", type: "error" })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (authLoading || !authorized) return
    fetchReviews()
  }, [authLoading, authorized])

  const handleDeleteReview = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this review?")) return

    setDeletingId(id)
    setMessage(null)

    try {
      const res = await fetch(`/admin/client-dashboard/reviews?id=${id}`, {
        method: "DELETE",
        credentials: "include"
      })

      if (!res.ok) throw new Error("Failed to delete review")

      setMessage({ text: "Review deleted successfully.", type: "success" })
      fetchReviews()
    } catch (err: any) {
      console.error(err)
      setMessage({ text: err.message || "Failed to delete review.", type: "error" })
    } finally {
      setDeletingId(null)
    }
  }

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    } catch (e) {
      return dateStr
    }
  }

  // Render stars helper using unicode symbols
  const renderStars = (rating: number) => {
    return (
      <div className="flex text-amber-500 font-bold text-sm tracking-tighter" title={`${rating} Stars`}>
        {"★".repeat(rating)}{"☆".repeat(5 - rating)}
      </div>
    )
  }

  // Filter reviews based on search term
  const filteredReviews = reviews.filter((r) => {
    const term = searchTerm.toLowerCase()
    return (
      (r.product_title || "").toLowerCase().includes(term) ||
      r.author.toLowerCase().includes(term) ||
      r.title.toLowerCase().includes(term) ||
      r.content.toLowerCase().includes(term)
    )
  })

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Text className="text-ui-fg-subtle text-sm">Loading reviews dashboard...</Text>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="p-8">
        <Text className="text-ui-fg-error font-medium">Access Denied: Unauthorized account role.</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-y-4">
        <div>
          <Heading level="h1" className="text-2xl font-bold text-ui-fg-base">
            Product Reviews
          </Heading>
          <Text className="text-ui-fg-subtle text-xs mt-1">
            Moderate and organize customer reviews left on store products.
          </Text>
        </div>

        <div className="w-full sm:w-72">
          <Input
            type="search"
            placeholder="Search by product, author, or content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            size="small"
          />
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-xs font-medium ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <Container className="p-0 overflow-hidden border border-ui-border-base rounded-lg bg-ui-bg-base">
        {filteredReviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Text className="text-ui-fg-muted text-sm italic">
              {searchTerm ? "No reviews match your search query." : "No product reviews registered in database."}
            </Text>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-ui-bg-subtle text-ui-fg-subtle font-semibold text-xs border-b border-ui-border-base">
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">Author</th>
                  <th className="px-6 py-3">Rating</th>
                  <th className="px-6 py-3">Review</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base">
                {filteredReviews.map((rev) => (
                  <tr key={rev.id} className="text-xs hover:bg-ui-bg-subtle/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-ui-fg-base max-w-[200px] truncate">
                      {rev.product_title || <span className="text-ui-fg-muted italic">Unknown Product (ID: {rev.product_id})</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-ui-fg-base font-semibold">{rev.author}</span>
                        {rev.verified && (
                          <span className="text-[10px] text-emerald-600 font-medium">✓ Verified Purchaser</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">{renderStars(rev.rating)}</td>
                    <td className="px-6 py-4 max-w-[320px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-ui-fg-base font-semibold">{rev.title}</span>
                        <span className="text-ui-fg-subtle leading-relaxed line-clamp-3">{rev.content}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-ui-fg-subtle">{formatDate(rev.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="transparent"
                        size="small"
                        disabled={deletingId === rev.id}
                        onClick={() => handleDeleteReview(rev.id)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 text-[11px] font-bold"
                      >
                        {deletingId === rev.id ? "Deleting..." : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </div>
  )
}

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
)

export const config = defineRouteConfig({
  label: "Product Reviews",
  icon: ChatIcon,
})

export default ProductReviewsPage
