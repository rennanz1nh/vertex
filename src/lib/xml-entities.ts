// eBay's Trading API XML-escapes every text field it returns, including ones that are
// themselves HTML (Description). Left undecoded, tags like <div> arrive as literal
// "&lt;div&gt;" and plain text like "Tom & Jerry" arrives as "Tom &amp; Jerry". Decode
// once; &amp; must go last or a literal "&amp;lt;" would double-decode into "<".
export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/g, "&");
}
