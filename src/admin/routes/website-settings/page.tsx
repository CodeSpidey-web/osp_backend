import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, Input, Label } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useRoleGuard } from "../useRoleGuard"

const WebsiteSettingsPage = () => {
  const { authorized, loading: authLoading } = useRoleGuard()
  const [logoUrl, setLogoUrl] = useState<string>("")
  const [phone, setPhone] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  
  // Tax/GST State
  const [taxRate, setTaxRate] = useState<number>(18)
  const [isTaxInclusive, setIsTaxInclusive] = useState<boolean>(true)
  const [taxOverrides, setTaxOverrides] = useState<Array<{ id?: string; rate: number; code?: string; name?: string; product_id: string; product_title: string }>>([])
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([])
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [newOverrideRate, setNewOverrideRate] = useState<string>("")

  // Shipping settings state
  const [flatShippingRate, setFlatShippingRate] = useState<number>(70)
  const [shippingGst, setShippingGst] = useState<number>(18)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(999)
  const [deliveryEstimate, setDeliveryEstimate] = useState<string>("Within 3-5 working days")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  // Password update states
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMessage, setPwdMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  useEffect(() => {
    if (authLoading || !authorized) return

    fetch("/admin/client-dashboard/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setLogoUrl(data.logo_url || "")
        setPhone(data.phone || "")
        setEmail(data.email || "")
        setTaxRate(data.tax_rate !== undefined ? data.tax_rate : 18)
        setIsTaxInclusive(true)
        setTaxOverrides(data.tax_overrides || [])
        setFlatShippingRate(data.flat_shipping_rate !== undefined ? data.flat_shipping_rate : 70)
        setShippingGst(data.shipping_gst !== undefined ? data.shipping_gst : 18)
        setFreeShippingThreshold(data.free_shipping_threshold !== undefined ? data.free_shipping_threshold : 999)
        setDeliveryEstimate(data.delivery_estimate || "Within 3-5 working days")
      })
      .catch((err) => console.error("Error loading settings:", err))
      .finally(() => setLoading(false))

    fetch("/admin/products?limit=100", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products || [])
      })
      .catch((err) => console.error("Error loading products:", err))
  }, [authLoading, authorized])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append("files", file)

      const res = await fetch("/admin/uploads", {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error("Failed to upload image file.")
      }

      const data = await res.json()
      const url = data.files?.[0]?.url

      if (url) {
        setLogoUrl(url)
        setMessage({ text: "Logo uploaded successfully. Remember to save changes!", type: "success" })
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to upload logo image.", type: "error" })
    } finally {
      setUploading(false)
    }
  }

  const handleAddOverride = () => {
    if (!selectedProductId || !newOverrideRate) {
      setMessage({ text: "Please select a product and enter a rate.", type: "error" })
      return
    }

    const rateNum = Number(newOverrideRate)
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      setMessage({ text: "Please enter a valid rate between 0 and 100.", type: "error" })
      return
    }

    if (taxOverrides.some(o => o.product_id === selectedProductId)) {
      setMessage({ text: "An override already exists for this product.", type: "error" })
      return
    }

    const product = products.find(p => p.id === selectedProductId)
    if (!product) return

    setTaxOverrides([
      ...taxOverrides,
      {
        product_id: selectedProductId,
        product_title: product.title,
        rate: rateNum,
        code: `GST${rateNum}`,
        name: `GST ${rateNum}% Override`
      }
    ])

    setSelectedProductId("")
    setNewOverrideRate("")
    setMessage({ text: "Override added. Click 'Save Settings' to apply changes.", type: "success" })
  }

  const handleDeleteOverride = (productId: string) => {
    setTaxOverrides(taxOverrides.filter(o => o.product_id !== productId))
    setMessage({ text: "Override removed. Click 'Save Settings' to apply changes.", type: "success" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch("/admin/client-dashboard/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url: logoUrl,
          phone,
          email,
          tax_rate: taxRate,
          is_tax_inclusive: isTaxInclusive,
          tax_overrides: taxOverrides.map(o => ({
            rate: o.rate,
            code: o.code,
            name: o.name,
            product_id: o.product_id
          })),
          flat_shipping_rate: flatShippingRate,
          shipping_gst: shippingGst,
          free_shipping_threshold: freeShippingThreshold,
          delivery_estimate: deliveryEstimate
        }),
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error("Failed to save settings.")
      }

      setMessage({ text: "Website settings saved successfully!", type: "success" })
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to save website settings.", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdSaving(true)
    setPwdMessage(null)

    if (newPassword !== confirmPassword) {
      setPwdMessage({ text: "New passwords do not match.", type: "error" })
      setPwdSaving(false)
      return
    }

    try {
      const res = await fetch("/admin/client-dashboard/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword
        }),
        credentials: "include",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Failed to update password.")
      }

      setPwdMessage({ text: "Password updated successfully!", type: "success" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setPwdMessage({ text: err.message || "Failed to update password.", type: "error" })
    } finally {
      setPwdSaving(false)
    }
  }

  if (authLoading) {
    return (
      <Container className="p-8">
        <Text className="text-ui-fg-subtle">Checking authorization...</Text>
      </Container>
    )
  }

  if (!authorized) {
    return (
      <Container className="p-8">
        <Heading level="h1" className="text-xl font-bold text-ui-fg-error mb-2">Access Denied</Heading>
        <Text className="text-ui-fg-subtle">This customized client page is only available for the administrator profile.</Text>
      </Container>
    )
  }

  if (loading) {
    return (
      <Container className="p-8">
        <Text className="text-ui-fg-subtle">Loading website settings...</Text>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-y-4 sm:gap-y-6 max-w-[720px] mx-auto w-full px-4 sm:px-0 py-4 sm:py-6">
      {/* Title & Header Section */}
      <div className="px-1">
        <Heading level="h1" className="text-xl sm:text-2xl font-semibold text-ui-fg-base mb-1">
          Website Settings
        </Heading>
        <Text className="text-ui-fg-subtle text-xs sm:text-sm">
          Update your store taxation, GST, shipping rates, and product tax overrides.
        </Text>
      </div>

      {/* Notifications */}
      {message && (
        <div className={`p-3 sm:p-4 border rounded-lg text-xs sm:text-sm ${
          message.type === "success" 
            ? "bg-ui-bg-success-subtle border-ui-border-success text-ui-fg-success" 
            : "bg-ui-bg-error-subtle border-ui-border-error text-ui-fg-error"
        }`}>
          {message.text}
        </div>
      )}

      {/* Main Settings Card */}
      <form onSubmit={handleSubmit}>
        <Container className="p-0 overflow-hidden divide-y divide-ui-border-base">

          {/* Tax, GST & Shipping Settings */}
          <div className="p-4 sm:p-6 space-y-6">
            <div>
               <Heading level="h2" className="text-sm sm:text-base font-semibold text-ui-fg-base mb-1">Tax, GST & Shipping Settings</Heading>
               <Text className="text-ui-fg-subtle text-xs">Configure your default store GST rate, tax display modes, shipping fees, and product overrides.</Text>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-ui-fg-subtle font-medium">Default GST Rate (%)</Label>
                <Input
                  type="number"
                  size="small"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  placeholder="18"
                  min={0}
                  max={100}
                  required
                />
              </div>
            </div>

            {/* Shipping Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-ui-border-base">
              <div className="space-y-2">
                <Label className="text-xs text-ui-fg-subtle font-medium">Flat Shipping Rate (₹)</Label>
                <Input
                  type="number"
                  size="small"
                  value={flatShippingRate}
                  onChange={(e) => setFlatShippingRate(Number(e.target.value))}
                  placeholder="70"
                  min={0}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-ui-fg-subtle font-medium">Shipping GST (%)</Label>
                <Input
                  type="number"
                  size="small"
                  value={shippingGst}
                  onChange={(e) => setShippingGst(Number(e.target.value))}
                  placeholder="18"
                  min={0}
                  max={100}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-ui-fg-subtle font-medium">Free Shipping Threshold (₹)</Label>
                <Input
                  type="number"
                  size="small"
                  value={freeShippingThreshold}
                  onChange={(e) => setFreeShippingThreshold(Number(e.target.value))}
                  placeholder="999"
                  min={0}
                  required
                />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-ui-border-base">
              <Label className="text-xs text-ui-fg-subtle font-medium">Delivery Estimate</Label>
              <Input
                type="text"
                size="small"
                value={deliveryEstimate}
                onChange={(e) => setDeliveryEstimate(e.target.value)}
                placeholder="Within 3-5 working days"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-ui-bg-subtle flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-x-2">
            <Button 
              type="submit" 
              variant="primary" 
              size="small"
              disabled={saving || uploading}
              className="w-full sm:w-auto"
            >
              {saving ? "Saving Changes..." : "Save Settings"}
            </Button>
          </div>

        </Container>
      </form>

      {/* Change Password Form */}
      <form onSubmit={handleChangePassword}>
        <Container className="p-0 overflow-hidden divide-y divide-ui-border-base mt-6">
          <div className="p-4 sm:p-6 space-y-6">
            <div>
               <Heading level="h2" className="text-sm sm:text-base font-semibold text-ui-fg-base mb-1">Change Account Password</Heading>
               <Text className="text-ui-fg-subtle text-xs">Update your admin login password securely. You will need to enter your current password to verify identity.</Text>
            </div>

            {pwdMessage && (
              <div className={`p-3 sm:p-4 border rounded-lg text-xs sm:text-sm ${
                pwdMessage.type === "success" 
                  ? "bg-ui-bg-success-subtle border-ui-border-success text-ui-fg-success" 
                  : "bg-ui-bg-error-subtle border-ui-border-error text-ui-fg-error"
              }`}>
                {pwdMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-ui-fg-subtle font-medium">Current Password</Label>
                <Input
                  type="password"
                  size="small"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-ui-fg-subtle font-medium">New Password</Label>
                <Input
                  type="password"
                  size="small"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-ui-fg-subtle font-medium">Confirm New Password</Label>
                <Input
                  type="password"
                  size="small"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-ui-bg-subtle flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-x-2">
            <Button 
              type="submit" 
              variant="primary" 
              size="small"
              disabled={pwdSaving}
              className="w-full sm:w-auto"
            >
              {pwdSaving ? "Updating Password..." : "Update Password"}
            </Button>
          </div>
        </Container>
      </form>
    </div>
  )
}

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
)

export const config = defineRouteConfig({
  label: "Website Settings",
  icon: SettingsIcon,
})

export default WebsiteSettingsPage
