import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, Input } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useRoleGuard } from "../../utils/useRoleGuard"

interface Enquiry {
  id: string
  name: string
  email: string
  phone: string
  college: string
  message: string
  file_name?: string
  file_type?: string
  created_at: string
}

const ProjectEnquiriesPage = () => {
  const { authorized, loading: authLoading } = useRoleGuard()
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const fetchEnquiries = () => {
    setLoading(true)
    fetch("/admin/client-dashboard/enquiries", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch enquiries")
        return r.json()
      })
      .then((data) => {
        setEnquiries(data.enquiries || [])
      })
      .catch((err) => {
        console.error("Error loading enquiries:", err)
        setMessage({ text: "Failed to load project enquiries.", type: "error" })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (authLoading || !authorized) return
    fetchEnquiries()
  }, [authLoading, authorized])

  const handleDeleteEnquiry = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this project enquiry?")) return

    setDeletingId(id)
    setMessage(null)

    try {
      const res = await fetch(`/admin/client-dashboard/enquiries?id=${id}`, {
        method: "DELETE",
        credentials: "include"
      })

      if (!res.ok) throw new Error("Failed to delete enquiry")

      setMessage({ text: "Project enquiry deleted successfully.", type: "success" })
      fetchEnquiries()
    } catch (err: any) {
      console.error(err)
      setMessage({ text: err.message || "Failed to delete enquiry.", type: "error" })
    } finally {
      setDeletingId(null)
    }
  }

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

  const filteredEnquiries = enquiries.filter((e) => {
    const term = searchTerm.toLowerCase()
    return (
      e.name.toLowerCase().includes(term) ||
      e.email.toLowerCase().includes(term) ||
      e.phone.toLowerCase().includes(term) ||
      e.college.toLowerCase().includes(term) ||
      e.message.toLowerCase().includes(term)
    )
  })

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Text className="text-ui-fg-subtle text-sm">Loading enquiries dashboard...</Text>
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
            Project Enquiries
          </Heading>
          <Text className="text-ui-fg-subtle text-xs mt-1">
            Review and download student project enquiries and submissions.
          </Text>
        </div>

        <div className="w-full sm:w-72">
          <Input
            type="search"
            placeholder="Search by student, college, email..."
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
        {filteredEnquiries.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Text className="text-ui-fg-muted text-sm italic">
              {searchTerm ? "No project enquiries match your search query." : "No project enquiries submitted yet."}
            </Text>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-ui-bg-subtle text-ui-fg-subtle font-semibold text-xs border-b border-ui-border-base">
                  <th className="px-6 py-3">Student Details</th>
                  <th className="px-6 py-3">College Name</th>
                  <th className="px-6 py-3">Project Details</th>
                  <th className="px-6 py-3">Attachment</th>
                  <th className="px-6 py-3">Submission Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base">
                {filteredEnquiries.map((enq) => (
                  <tr key={enq.id} className="text-xs hover:bg-ui-bg-subtle/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-ui-fg-base font-semibold">{enq.name}</span>
                        <span className="text-ui-fg-subtle">{enq.email}</span>
                        <span className="text-ui-fg-muted font-medium">{enq.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-ui-fg-base max-w-[200px] truncate">
                      {enq.college}
                    </td>
                    <td className="px-6 py-4 max-w-[320px]">
                      <div className="max-h-24 overflow-y-auto whitespace-pre-wrap text-ui-fg-subtle leading-relaxed pr-2">
                        {enq.message}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {enq.file_name ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-[10px] text-ui-fg-subtle font-medium truncate max-w-[150px]" title={enq.file_name}>
                            📁 {enq.file_name}
                          </span>
                          <a
                            href={`/admin/client-dashboard/enquiries/download?id=${enq.id}`}
                            download={enq.file_name}
                            className="text-emerald-600 hover:text-emerald-800 hover:underline font-bold text-[10px] uppercase tracking-wider"
                          >
                            Download File
                          </a>
                        </div>
                      ) : (
                        <span className="text-ui-fg-muted italic">No file attached</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-ui-fg-subtle">{formatDate(enq.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="transparent"
                        size="small"
                        disabled={deletingId === enq.id}
                        onClick={() => handleDeleteEnquiry(enq.id)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 text-[11px] font-bold"
                      >
                        {deletingId === enq.id ? "Deleting..." : "Delete"}
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

const EnquiriesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
)

export const config = defineRouteConfig({
  label: "Project Enquiries",
  icon: EnquiriesIcon,
})

export default ProjectEnquiriesPage
