import { useEffect } from "react"

const OrdersRedirectPage = () => {
  useEffect(() => {
    window.location.replace("/app/dashboard")
  }, [])

  return null
}

export default OrdersRedirectPage
