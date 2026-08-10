export type CourierOption = {
  id: string
  name: string
}

export const COURIER_OPTIONS: CourierOption[] = [
  { id: "st-courier", name: "ST Courier" },
  { id: "south-india-regional-express", name: "South India & Regional Express" },
  { id: "professional-couriers", name: "Professional Couriers (TPC)" },
  { id: "pan-india-network", name: "Pan-India Network" },
  { id: "dtdc", name: "DTDC (Express Air & Surface)" },
  { id: "shree-maruti-courier", name: "Shree Maruti Courier" },
  { id: "national-express", name: "National Express" },
  { id: "shree-tirupathi-courier", name: "Shree Tirupathi Courier" },
  { id: "commercial-logistics", name: "Commercial Logistics" },
  { id: "other", name: "Other / Local Courier" },
]

export function getCourierOption(courierName: string | null | undefined): CourierOption | null {
  if (!courierName) return null

  const normalized = courierName.trim().toLowerCase()
  if (!normalized) return null

  const byId = COURIER_OPTIONS.find((c) => c.id === normalized)
  if (byId) return byId

  const byName = COURIER_OPTIONS.find(
    (c) => c.name.toLowerCase() === normalized || c.name.toLowerCase().includes(normalized) || normalized.includes(c.name.toLowerCase())
  )
  if (byName) return byName

  return null
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}