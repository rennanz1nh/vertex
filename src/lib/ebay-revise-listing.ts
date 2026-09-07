import { getEbayAccessToken } from "@/lib/ebay-token";

export type ReviseListingInput = {
  itemId: string;
  title: string;
  description: string;
  itemSpecifics: { name: string; values: string[] }[];
};

export type ReviseListingResult = {
  ok: boolean;
  itemId: string | null;
  errors: string[];
  warnings: string[];
};

// eBay XML-escapes every field, so any text the seller can edit (title, item specific
// names/values) must be escaped going back out — mirrors decodeXmlEntities in reverse.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Unlike AddFixedPriceItem (which needs the whole listing cloned), ReviseItem only needs
// ItemID plus the fields being changed — everything else on the live listing is left as-is.
// ItemSpecifics is the one exception: eBay replaces that whole container rather than
// merging by field, so the caller must send the complete desired set, not just a diff.
function buildReviseItemXml(token: string, input: ReviseListingInput): string {
  const specifics = input.itemSpecifics
    .map(
      (spec) =>
        `<NameValueList><Name>${escapeXml(spec.name)}</Name>${spec.values
          .map((v) => `<Value>${escapeXml(v)}</Value>`)
          .join("")}</NameValueList>`
    )
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${input.itemId}</ItemID>
    <Title>${escapeXml(input.title)}</Title>
    <Description><![CDATA[${input.description}]]></Description>
    <ItemSpecifics>${specifics}</ItemSpecifics>
  </Item>
</ReviseItemRequest>`;
}

// NOTE: eBay's Trading API has no VerifyReviseItem call (Verify* only exists for the Add*
// family), so there's no dry run here — the client-side 80-char title check and non-empty
// specifics validation are the only pre-flight checks before this hits the live listing.
export async function reviseListing(input: ReviseListingInput): Promise<ReviseListingResult> {
  const token = await getEbayAccessToken();
  const xml = buildReviseItemXml(token, input);

  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": "ReviseItem",
      "X-EBAY-API-IAF-TOKEN": token,
      "Content-Type": "text/xml",
    },
    body: xml,
  });

  const text = await res.text();
  const ack = text.match(/<Ack>(.*?)<\/Ack>/)?.[1] ?? "Failure";

  const errors = [...text.matchAll(/<Errors>([\s\S]*?)<\/Errors>/g)]
    .map((m) => {
      const severity = m[1].match(/<SeverityCode>(.*?)<\/SeverityCode>/)?.[1];
      const msg = m[1].match(/<LongMessage>(.*?)<\/LongMessage>/)?.[1] ?? m[1].match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1];
      return { severity, msg };
    })
    .filter((e) => e.msg);

  const itemId = text.match(/<ItemID>(.*?)<\/ItemID>/)?.[1] ?? null;

  return {
    ok: ack === "Success" || ack === "Warning",
    itemId,
    errors: errors.filter((e) => e.severity === "Error").map((e) => e.msg!),
    warnings: errors.filter((e) => e.severity === "Warning").map((e) => e.msg!),
  };
}
