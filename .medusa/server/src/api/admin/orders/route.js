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
            "fulfillment_status",
            "payment_status",
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
        ],
    });
    const mapped = orders.map((o) => ({
        ...o,
        custom_status: mapStatus(o.fulfillment_status, o.payment_status),
    }));
    res.json({ orders: mapped });
}
function mapStatus(fulfillment, payment) {
    if (fulfillment === "fulfilled" || fulfillment === "shipped")
        return "Delivered";
    if (fulfillment === "partially_fulfilled" || payment === "captured")
        return "Processing";
    return "Pending";
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL29yZGVycy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBLGtCQWlDQztBQWpDTSxLQUFLLFVBQVUsR0FBRyxDQUN2QixHQUFrQixFQUNsQixHQUFtQjtJQUVuQixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQTtJQUV4QyxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztRQUN6QyxNQUFNLEVBQUUsT0FBTztRQUNmLE1BQU0sRUFBRTtZQUNOLElBQUk7WUFDSixZQUFZO1lBQ1osUUFBUTtZQUNSLG9CQUFvQjtZQUNwQixnQkFBZ0I7WUFDaEIsT0FBTztZQUNQLGVBQWU7WUFDZixPQUFPO1lBQ1AsWUFBWTtZQUNaLDZCQUE2QjtZQUM3Qiw0QkFBNEI7WUFDNUIsdUJBQXVCO1lBQ3ZCLGFBQWE7WUFDYixnQkFBZ0I7WUFDaEIsNkJBQTZCO1NBQzlCO0tBQ0YsQ0FBQyxDQUFBO0lBRUYsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNyQyxHQUFHLENBQUM7UUFDSixhQUFhLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDO0tBQ2pFLENBQUMsQ0FBQyxDQUFBO0lBRUgsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFBO0FBQzlCLENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxXQUFtQixFQUFFLE9BQWU7SUFDckQsSUFBSSxXQUFXLEtBQUssV0FBVyxJQUFJLFdBQVcsS0FBSyxTQUFTO1FBQUUsT0FBTyxXQUFXLENBQUE7SUFDaEYsSUFBSSxXQUFXLEtBQUsscUJBQXFCLElBQUksT0FBTyxLQUFLLFVBQVU7UUFBRSxPQUFPLFlBQVksQ0FBQTtJQUN4RixPQUFPLFNBQVMsQ0FBQTtBQUNsQixDQUFDIn0=