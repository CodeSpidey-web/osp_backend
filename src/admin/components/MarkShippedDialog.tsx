import { Button } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { COURIER_OPTIONS, getCourierOption } from "../../utils/courierTracking"

type MarkShippedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (courierName: string, trackingNumber: string) => void
  pending: boolean
  orderDisplayId?: string | number
}

export default function MarkShippedDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  orderDisplayId,
}: MarkShippedDialogProps) {
  const [courierName, setCourierName] = useState(COURIER_OPTIONS[0].id)
  const [trackingNumber, setTrackingNumber] = useState("")

  useEffect(() => {
    if (!open) {
      setCourierName(COURIER_OPTIONS[0].id)
      setTrackingNumber("")
    }
  }, [open])

  if (!open) return null

  const trimmedTracking = trackingNumber.trim()
  const courier = getCourierOption(courierName)
  const canConfirm = !!courier && !!trimmedTracking

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !pending && onOpenChange(false)}
      />
      <div className="relative w-full max-w-md mx-4 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
        <div className="p-6 flex flex-col gap-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Mark Order {orderDisplayId ? `#${orderDisplayId}` : ""} as Shipped
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select the courier service and enter the AWB / tracking number issued by the courier.
              The shipped email is sent to the customer with the courier name and tracking number.
            </p>
          </div>

          <div className="flex flex-col gap-y-1.5">
            <label className="text-xs font-medium text-slate-300">Courier</label>
            <select
              value={courierName}
              disabled={pending}
              onChange={(e) => setCourierName(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
            >
              {COURIER_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-y-1.5">
            <label className="text-xs font-medium text-slate-300">Tracking Number (AWB)</label>
            <input
              value={trackingNumber}
              disabled={pending}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. 36405891397"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500 placeholder:text-slate-500"
            />
            <p className="text-[10px] text-slate-500">
              {!trimmedTracking
                ? "Tracking number (AWB) is required — it is included in the shipped email."
                : `${courier?.name || "This courier"} and the AWB will be shown in the shipped email sent to the customer.`}
            </p>
          </div>

          <div className="flex justify-end gap-x-2 pt-2">
            <Button variant="secondary" size="small" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              disabled={pending || !canConfirm}
              onClick={() => onConfirm(courierName, trimmedTracking)}
            >
              {pending ? "Shipping..." : "Confirm & Send Shipment Email"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}