import { getEbayAccessToken } from "@/lib/ebay-token";

export type PublishListingInput = {
  title: string;
  description: string;
  categoryId: string;
  conditionId: string;
  currency: string;
  price: number;
  quantity: number;
  sku: string | null;
  images: string[];
  itemSpecifics: { name: string; values: string[] }[];
  packageDetails: {
    weightMajor: string;
    weightMinor: string;
    packageDepth: string;
    packageLength: string;
    packageWidth: string;
    shippingPackage: string;
  } | null;
  sellerProfiles: {
    paymentProfileId: string;
    returnProfileId: string;
    shippingProfileId: string;
  } | null;
  country: string;
  postalCode: string;
  listingDuration: string;
};

export type PublishListingResult = {
  ok: boolean;
  itemId: string | null;
  fees: { name: string; amount: string; discount: string; net: string; currency: string }[];
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

function buildAddItemXml(token: string, input: PublishListingInput, rootElement: "AddFixedPriceItemRequest" | "VerifyAddFixedPriceItemRequest"): string {
  const pictures = input.images.map((url) => `<PictureURL>${escapeXml(url)}</PictureURL>`).join("");

  const specifics = input.itemSpecifics
    .map(
      (spec) =>
        `<NameValueList><Name>${escapeXml(spec.name)}</Name>${spec.values
          .map((v) => `<Value>${escapeXml(v)}</Value>`)
          .join("")}</NameValueList>`
    )
    .join("");

  const packageXml = input.packageDetails
    ? `<ShippingPackageDetails>
        <WeightMajor unit="lbs">${input.packageDetails.weightMajor}</WeightMajor>
        <WeightMinor unit="oz">${input.packageDetails.weightMinor}</WeightMinor>
        ${input.packageDetails.packageDepth ? `<PackageDepth measurementSystem="English" unit="in">${input.packageDetails.packageDepth}</PackageDepth>` : ""}
        ${input.packageDetails.packageLength ? `<PackageLength measurementSystem="English" unit="in">${input.packageDetails.packageLength}</PackageLength>` : ""}
        ${input.packageDetails.packageWidth ? `<PackageWidth measurementSystem="English" unit="in">${input.packageDetails.packageWidth}</PackageWidth>` : ""}
        ${input.packageDetails.shippingPackage ? `<ShippingPackage>${escapeXml(input.packageDetails.shippingPackage)}</ShippingPackage>` : ""}
      </ShippingPackageDetails>`
    : "";

  const sellerProfilesXml = input.sellerProfiles
    ? `<SellerProfiles>
        <SellerPaymentProfile><PaymentProfileID>${input.sellerProfiles.paymentProfileId}</PaymentProfileID></SellerPaymentProfile>
        <SellerReturnProfile><ReturnProfileID>${input.sellerProfiles.returnProfileId}</ReturnProfileID></SellerReturnProfile>
        <SellerShippingProfile><ShippingProfileID>${input.sellerProfiles.shippingProfileId}</ShippingProfileID></SellerShippingProfile>
      </SellerProfiles>`
    : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<${rootElement} xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <Title>${escapeXml(input.title)}</Title>
    <Description><![CDATA[${input.description}]]></Description>
    <PrimaryCategory><CategoryID>${input.categoryId}</CategoryID></PrimaryCategory>
    <ConditionID>${input.conditionId}</ConditionID>
    <Country>${input.country}</Country>
    <Currency>${input.currency}</Currency>
    <StartPrice currencyID="${input.currency}">${input.price}</StartPrice>
    <Quantity>${input.quantity}</Quantity>
    ${input.sku ? `<SKU>${escapeXml(input.sku)}</SKU>` : ""}
    <PostalCode>${input.postalCode}</PostalCode>
    <ListingDuration>${input.listingDuration}</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <PictureDetails>${pictures}</PictureDetails>
    <ItemSpecifics>${specifics}</ItemSpecifics>
    ${packageXml}
    ${sellerProfilesXml}
  </Item>
</${rootElement}>`;
}

async function callTradingApi(
  token: string,
  callName: "VerifyAddFixedPriceItem" | "AddFixedPriceItem",
  xmlBody: string
): Promise<PublishListingResult> {
  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-IAF-TOKEN": token,
      "Content-Type": "text/xml",
    },
    body: xmlBody,
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

  // FeeType confusingly nests a <Fee currencyID="...">amount</Fee> amount element inside
  // the <Fee><Name>...</Name>...</Fee> wrapper — same tag name at two levels. Rather than
  // resolve that ambiguity with regex, just pair each <Name> with the <Fee currencyID=...>
  // amount that immediately follows it, plus an optional <PromotionalDiscount> right after —
  // eBay's free-listing promotions show up here as a discount on the sticker fee, not as the
  // fee being absent, so what the seller actually pays is (amount - discount), not amount.
  const fees = [
    ...text.matchAll(
      /<Name>(.*?)<\/Name>\s*<Fee currencyID="([^"]*)"[^>]*>([^<]*)<\/Fee>(?:<PromotionalDiscount[^>]*>([^<]*)<\/PromotionalDiscount>)?/g
    ),
  ]
    .map((m) => {
      const amount = parseFloat(m[3]);
      const discount = parseFloat(m[4] ?? "0");
      const net = Math.max(0, amount - discount);
      return { name: m[1], currency: m[2], amount: m[3], discount: (m[4] ?? "0"), net: net.toFixed(2) };
    })
    .filter((f) => f.name && parseFloat(f.amount) > 0);

  const itemId = text.match(/<ItemID>(.*?)<\/ItemID>/)?.[1] ?? null;

  return {
    ok: ack === "Success" || ack === "Warning",
    itemId,
    fees,
    errors: errors.filter((e) => e.severity === "Error").map((e) => e.msg!),
    warnings: errors.filter((e) => e.severity === "Warning").map((e) => e.msg!),
  };
}

/** Dry-run: validates the listing and returns fees/errors without creating anything on eBay. */
export async function verifyPublishListing(input: PublishListingInput): Promise<PublishListingResult> {
  const token = await getEbayAccessToken();
  const xml = buildAddItemXml(token, input, "VerifyAddFixedPriceItemRequest");
  return callTradingApi(token, "VerifyAddFixedPriceItem", xml);
}

/** Creates the real, live, fee-incurring listing on eBay. */
export async function publishListing(input: PublishListingInput): Promise<PublishListingResult> {
  const token = await getEbayAccessToken();
  const xml = buildAddItemXml(token, input, "AddFixedPriceItemRequest");
  return callTradingApi(token, "AddFixedPriceItem", xml);
}
