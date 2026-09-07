import { getEbayAccessToken } from "@/lib/ebay-token";
import { decodeXmlEntities } from "@/lib/xml-entities";

export type EbayListingDetail = {
  itemId: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
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
    paymentProfileName: string;
    returnProfileId: string;
    returnProfileName: string;
    shippingProfileId: string;
    shippingProfileName: string;
  } | null;
  country: string;
  postalCode: string;
  listingDuration: string;
};

/**
 * Fetches every field needed to duplicate a listing (title/description to translate,
 * plus everything else that gets carried over unchanged: category, item specifics,
 * price, condition, images, package weight/dimensions, business policy IDs, location).
 */
export async function fetchListingDetail(itemId: string): Promise<EbayListingDetail> {
  const token = await getEbayAccessToken();

  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": "GetItem",
      "X-EBAY-API-IAF-TOKEN": token,
      "Content-Type": "text/xml",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeItemSpecifics>true</IncludeItemSpecifics>
</GetItemRequest>`,
  });

  const text = await res.text();
  const ackMatch = text.match(/<Ack>(.*?)<\/Ack>/);
  if (ackMatch && ackMatch[1] === "Failure") {
    const errMsg = text.match(/<ShortMessage>(.*?)<\/ShortMessage>/)?.[1] ?? "eBay API error";
    throw new Error(errMsg);
  }

  const get = (tag: string) => text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? null;

  const title = decodeXmlEntities(get("Title") ?? "");
  const description = decodeXmlEntities(get("Description") ?? "");

  const categoryBlock = text.match(/<PrimaryCategory>([\s\S]*?)<\/PrimaryCategory>/)?.[1] ?? "";
  const categoryId = categoryBlock.match(/<CategoryID>(.*?)<\/CategoryID>/)?.[1] ?? "";
  const categoryName = decodeXmlEntities(categoryBlock.match(/<CategoryName>(.*?)<\/CategoryName>/)?.[1] ?? "");

  const conditionId = get("ConditionID") ?? "1000";

  // FixedPriceItem listings still carry a <BuyItNowPrice>0.0</BuyItNowPrice> placeholder
  // (unused outside auctions) ahead of the real price in the raw XML, so a naive
  // "first BuyItNowPrice-or-StartPrice tag" match grabs the zero. <SellingStatus><CurrentPrice>
  // is the actual live price for both auctions and fixed-price listings — prefer it, and
  // only fall back to StartPrice/BuyItNowPrice if it's somehow missing.
  const sellingStatusBlock = text.match(/<SellingStatus>([\s\S]*?)<\/SellingStatus>/)?.[1] ?? "";
  const priceMatch =
    sellingStatusBlock.match(/<CurrentPrice[^>]*currencyID="([^"]*)"[^>]*>([^<]*)<\/CurrentPrice>/) ??
    text.match(/<StartPrice[^>]*currencyID="([^"]*)"[^>]*>([^<]*)<\/StartPrice>/) ??
    text.match(/<BuyItNowPrice[^>]*currencyID="([^"]*)"[^>]*>([^<]*)<\/BuyItNowPrice>/);
  const currency = priceMatch?.[1] ?? get("Currency") ?? "USD";
  const priceStr = priceMatch?.[2] ?? "0";
  const quantityStr = get("Quantity") ?? "1";
  const sku = get("SKU");

  const images = [...text.matchAll(/<PictureURL>([^<]*)<\/PictureURL>/g)].map((m) => m[1]);

  const specsBlock = get("ItemSpecifics") ?? "";
  const itemSpecifics = [...specsBlock.matchAll(/<NameValueList>([\s\S]*?)<\/NameValueList>/g)].map((m) => {
    const block = m[1];
    const name = decodeXmlEntities(block.match(/<Name>(.*?)<\/Name>/)?.[1] ?? "");
    const values = [...block.matchAll(/<Value>(.*?)<\/Value>/g)].map((v) => decodeXmlEntities(v[1]));
    return { name, values };
  });

  const pkgBlock = text.match(/<ShippingPackageDetails>([\s\S]*?)<\/ShippingPackageDetails>/)?.[1];
  const packageDetails = pkgBlock
    ? {
        weightMajor: pkgBlock.match(/<WeightMajor[^>]*>([^<]*)<\/WeightMajor>/)?.[1] ?? "1",
        weightMinor: pkgBlock.match(/<WeightMinor[^>]*>([^<]*)<\/WeightMinor>/)?.[1] ?? "0",
        packageDepth: pkgBlock.match(/<PackageDepth[^>]*>([^<]*)<\/PackageDepth>/)?.[1] ?? "",
        packageLength: pkgBlock.match(/<PackageLength[^>]*>([^<]*)<\/PackageLength>/)?.[1] ?? "",
        packageWidth: pkgBlock.match(/<PackageWidth[^>]*>([^<]*)<\/PackageWidth>/)?.[1] ?? "",
        shippingPackage: pkgBlock.match(/<ShippingPackage>(.*?)<\/ShippingPackage>/)?.[1] ?? "",
      }
    : null;

  const paymentProfileId = get("PaymentProfileID");
  const sellerProfiles = paymentProfileId
    ? {
        paymentProfileId,
        paymentProfileName: decodeXmlEntities(get("PaymentProfileName") ?? ""),
        returnProfileId: get("ReturnProfileID") ?? "",
        returnProfileName: decodeXmlEntities(get("ReturnProfileName") ?? ""),
        shippingProfileId: get("ShippingProfileID") ?? "",
        shippingProfileName: decodeXmlEntities(get("ShippingProfileName") ?? ""),
      }
    : null;

  const country = get("Country") ?? "US";
  const postalCode = get("PostalCode") ?? "";
  const listingDuration = get("ListingDuration") ?? "GTC";

  return {
    itemId,
    title,
    description,
    categoryId,
    categoryName,
    conditionId,
    currency,
    price: parseFloat(priceStr) || 0,
    quantity: parseInt(quantityStr, 10) || 1,
    sku,
    images,
    itemSpecifics,
    packageDetails,
    sellerProfiles,
    country,
    postalCode,
    listingDuration,
  };
}
