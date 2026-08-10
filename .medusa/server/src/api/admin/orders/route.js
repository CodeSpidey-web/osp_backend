"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
async function GET(req, res) {
    const query = req.scope.resolve("query");
    const { data: orders } = await query.graph({
        entity: "order",
        fields: [
            "id",
            "display_id",
            "status",
            "total",
            "currency_code",
            "email",
            "created_at",
            "shipping_address.first_name",
            "shipping_address.last_name",
            "shipping_address.city",
            "items.title",
            "items.quantity",
            "summary.current_order_total",
            "payment_collections.status",
            "payment_collections.captured_amount",
            "fulfillments.shipped_at",
            "fulfillments.delivered_at",
            "fulfillments.metadata",
            "fulfillments.labels.tracking_number",
            "fulfillments.labels.tracking_url",
        ],
    });
    const mapped = orders.map((o) => {
        const totalVal = o.summary?.current_order_total?.numeric_ ??
            o.total?.numeric_ ??
            o.summary?.current_order_total ??
            o.total ??
            0;
        const hasCapturedPayment = o.payment_collections?.some((pc) => pc.status === "completed" || (pc.captured_amount && Number(pc.captured_amount) > 0));
        const resolvedPaymentStatus = hasCapturedPayment ? "captured" : "not_paid";
        let resolvedFulfillmentStatus = "not_fulfilled";
        if (o.fulfillments && o.fulfillments.length > 0) {
            const isShipped = o.fulfillments.some((f) => f.shipped_at || f.delivered_at);
            resolvedFulfillmentStatus = isShipped ? "shipped" : "fulfilled";
        }
        const tracking = extractTracking(o.fulfillments);
        return {
            ...o,
            total: totalVal,
            custom_status: mapStatus(resolvedFulfillmentStatus, resolvedPaymentStatus),
            tracking,
        };
    });
    res.json({ orders: mapped });
}
function extractTracking(fulfillments) {
    for (const f of fulfillments || []) {
        const courierName = f?.metadata?.courier_name || null;
        for (const label of f?.labels || []) {
            const trackingNumber = label?.tracking_number;
            if (trackingNumber) {
                return {
                    courier_name: courierName,
                    tracking_number: trackingNumber,
                    tracking_url: label?.tracking_url && label?.tracking_url !== "#" ? label.tracking_url : null,
                };
            }
        }
    }
    return { courier_name: null, tracking_number: null, tracking_url: null };
}
function mapStatus(fulfillment, payment) {
    if (fulfillment === "fulfilled" || fulfillment === "shipped")
        return "Shipped";
    if (fulfillment === "partially_fulfilled" || payment === "captured")
        return "Processing";
    return "Pending";
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL29yZGVycy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBLGtCQTZEQztBQTdETSxLQUFLLFVBQVUsR0FBRyxDQUN2QixHQUFrQixFQUNsQixHQUFtQjtJQUVuQixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQTtJQUV4QyxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztRQUN6QyxNQUFNLEVBQUUsT0FBTztRQUNmLE1BQU0sRUFBRTtZQUNOLElBQUk7WUFDSixZQUFZO1lBQ1osUUFBUTtZQUNSLE9BQU87WUFDUCxlQUFlO1lBQ2YsT0FBTztZQUNQLFlBQVk7WUFDWiw2QkFBNkI7WUFDN0IsNEJBQTRCO1lBQzVCLHVCQUF1QjtZQUN2QixhQUFhO1lBQ2IsZ0JBQWdCO1lBQ2hCLDZCQUE2QjtZQUM3Qiw0QkFBNEI7WUFDNUIscUNBQXFDO1lBQ3JDLHlCQUF5QjtZQUN6QiwyQkFBMkI7WUFDM0IsdUJBQXVCO1lBQ3ZCLHFDQUFxQztZQUNyQyxrQ0FBa0M7U0FDbkM7S0FDRixDQUFDLENBQUE7SUFFRixNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBTSxFQUFFLEVBQUU7UUFDbkMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxRQUFRO1lBQ3pDLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUTtZQUNqQixDQUFDLENBQUMsT0FBTyxFQUFFLG1CQUFtQjtZQUM5QixDQUFDLENBQUMsS0FBSztZQUNQLENBQUMsQ0FBQztRQUVsQixNQUFNLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQ3BELENBQUMsRUFBTyxF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