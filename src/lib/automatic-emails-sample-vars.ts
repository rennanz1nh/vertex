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
};

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));
}
