// Sample values shared by "Enviar teste" (server) and "Ver e-mail" preview (client) so
// both show the same {var} placeholders filled with realistic-looking data.
export const SAMPLE_VARS: Record<string, string> = {
  customer_name: "Jane Doe",
  order_number: "12345",
  order_total: "$54.90",
  shipping_address: "123 Main St, Orlando, FL 32801",
  items_list: "1x Glycolic Acid Serum, 2x Vitamin C Cream",
  carrier: "UPS",
  tracking_number: "1Z999AA10123456784",
  tracking_url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
  store_url: "https://cosmeticmkt.com/cart",
  refund_amount: "$54.90",
  confirmation_number: "A1B2C3D4",
  car_name: "2025 Tesla Model 3",
  pickup_date: "Fri, Sep 25, 2026",
  pickup_time: "10:00",
  return_date: "Mon, Sep 28, 2026",
  return_time: "10:00",
  days: "3",
  protection_plan: "Standard",
  extras_list: "Unlimited mileage, Prepaid refuel",
  estimated_total: "$312.00",
};

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));
}
