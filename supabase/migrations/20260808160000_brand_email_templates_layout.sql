UPDATE public.automatic_emails SET subject = 'Your order #{order_number} is confirmed!', html_content = '<div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your order is confirmed and on its way to being packed.</div>
  <div style="max-width:560px;margin:0 auto">
    <div style="text-align:center;padding:20px 0">
      <img src="https://cosmeticmkt.com/images/store-logo.png" alt="Cosmetic Marketplace" style="height:40px;width:auto" />
    </div>
    <div style="background:#ffffff;border-radius:10px;padding:32px;color:#1f2937">
<h1 style="color:#111827;font-size:20px;margin:0 0 16px">Thanks for your order, {customer_name}!</h1>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">We''ve received your order <strong>#{order_number}</strong> and we''re getting it ready.</p>
<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:0 0 20px"><p style="margin:0 0 8px"><strong>Order total:</strong> {order_total}</p><p style="margin:0"><strong>Shipping to:</strong> {shipping_address}</p></div>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">{items_list}</p>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">We''ll email you again as soon as it ships.</p>
<div style="background:#fff7f5;border:1px dashed #db3614;border-radius:8px;padding:16px;margin:20px 0;text-align:center">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280">10% off your next order</p>
    <p style="margin:0;font-size:22px;font-weight:bold;letter-spacing:2px;color:#db3614">WELCOME10</p>
  </div>
<p style="margin:0 0 14px;line-height:1.6;color:#374151"><span style="font-size:13px;color:#9ca3af">Use this code on your next order.</span></p>
    </div>
    <div style="text-align:center;padding:24px 12px;color:#9ca3af;font-size:12px;line-height:1.6">
      <p style="margin:0 0 10px">
        <a href="https://instagram.com/cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">Instagram</a>
        &middot;
        <a href="https://tiktok.com/@cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">TikTok</a>
        &middot;
        <a href="https://cosmeticmkt.com" style="color:#6b7280;text-decoration:none;margin:0 8px">cosmeticmkt.com</a>
      </p>
      <p style="margin:0">&copy; 2026 Cosmetic Marketplace. All rights reserved.</p>
    </div>
  </div>
</div>', updated_at = NOW() WHERE trigger_key = 'order_confirmation';

UPDATE public.automatic_emails SET subject = 'Your order #{order_number} has shipped!', html_content = '<div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your order has shipped — here''s your tracking number.</div>
  <div style="max-width:560px;margin:0 auto">
    <div style="text-align:center;padding:20px 0">
      <img src="https://cosmeticmkt.com/images/store-logo.png" alt="Cosmetic Marketplace" style="height:40px;width:auto" />
    </div>
    <div style="background:#ffffff;border-radius:10px;padding:32px;color:#1f2937">
<h1 style="color:#111827;font-size:20px;margin:0 0 16px">It''s on the way, {customer_name}!</h1>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">Your order <strong>#{order_number}</strong> has shipped via {carrier}.</p>
<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:0 0 20px"><p style="margin:0"><strong>Tracking number:</strong> {tracking_number}</p></div>
<p style="text-align:center;margin:24px 0"><a href="{tracking_url}" style="background:#db3614;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Track your package</a></p>
    </div>
    <div style="text-align:center;padding:24px 12px;color:#9ca3af;font-size:12px;line-height:1.6">
      <p style="margin:0 0 10px">
        <a href="https://instagram.com/cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">Instagram</a>
        &middot;
        <a href="https://tiktok.com/@cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">TikTok</a>
        &middot;
        <a href="https://cosmeticmkt.com" style="color:#6b7280;text-decoration:none;margin:0 8px">cosmeticmkt.com</a>
      </p>
      <p style="margin:0">&copy; 2026 Cosmetic Marketplace. All rights reserved.</p>
    </div>
  </div>
</div>', updated_at = NOW() WHERE trigger_key = 'order_shipped';

UPDATE public.automatic_emails SET subject = 'Your order #{order_number} was delivered!', html_content = '<div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your order has arrived.</div>
  <div style="max-width:560px;margin:0 auto">
    <div style="text-align:center;padding:20px 0">
      <img src="https://cosmeticmkt.com/images/store-logo.png" alt="Cosmetic Marketplace" style="height:40px;width:auto" />
    </div>
    <div style="background:#ffffff;border-radius:10px;padding:32px;color:#1f2937">
<h1 style="color:#111827;font-size:20px;margin:0 0 16px">Delivered! We hope you love it, {customer_name}.</h1>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">Your order <strong>#{order_number}</strong> was delivered. If anything looks off, just reply to this email and we''ll sort it out.</p>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">Enjoying your products? A quick review helps us a lot!</p>
    </div>
    <div style="text-align:center;padding:24px 12px;color:#9ca3af;font-size:12px;line-height:1.6">
      <p style="margin:0 0 10px">
        <a href="https://instagram.com/cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">Instagram</a>
        &middot;
        <a href="https://tiktok.com/@cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">TikTok</a>
        &middot;
        <a href="https://cosmeticmkt.com" style="color:#6b7280;text-decoration:none;margin:0 8px">cosmeticmkt.com</a>
      </p>
      <p style="margin:0">&copy; 2026 Cosmetic Marketplace. All rights reserved.</p>
    </div>
  </div>
</div>', updated_at = NOW() WHERE trigger_key = 'order_delivered';

UPDATE public.automatic_emails SET subject = 'Your order #{order_number} was cancelled', html_content = '<div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your order has been cancelled.</div>
  <div style="max-width:560px;margin:0 auto">
    <div style="text-align:center;padding:20px 0">
      <img src="https://cosmeticmkt.com/images/store-logo.png" alt="Cosmetic Marketplace" style="height:40px;width:auto" />
    </div>
    <div style="background:#ffffff;border-radius:10px;padding:32px;color:#1f2937">
<h1 style="color:#111827;font-size:20px;margin:0 0 16px">Order cancelled</h1>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">Hi {customer_name}, your order <strong>#{order_number}</strong> has been cancelled.</p>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">If a payment was made, any refund will be processed back to your original payment method within a few business days.</p>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">Questions? Just reply to this email.</p>
    </div>
    <div style="text-align:center;padding:24px 12px;color:#9ca3af;font-size:12px;line-height:1.6">
      <p style="margin:0 0 10px">
        <a href="https://instagram.com/cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">Instagram</a>
        &middot;
        <a href="https://tiktok.com/@cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">TikTok</a>
        &middot;
        <a href="https://cosmeticmkt.com" style="color:#6b7280;text-decoration:none;margin:0 8px">cosmeticmkt.com</a>
      </p>
      <p style="margin:0">&copy; 2026 Cosmetic Marketplace. All rights reserved.</p>
    </div>
  </div>
</div>', updated_at = NOW() WHERE trigger_key = 'order_cancelled';

UPDATE public.automatic_emails SET subject = 'Your refund for order #{order_number} has been processed', html_content = '<div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your refund has been processed.</div>
  <div style="max-width:560px;margin:0 auto">
    <div style="text-align:center;padding:20px 0">
      <img src="https://cosmeticmkt.com/images/store-logo.png" alt="Cosmetic Marketplace" style="height:40px;width:auto" />
    </div>
    <div style="background:#ffffff;border-radius:10px;padding:32px;color:#1f2937">
<h1 style="color:#111827;font-size:20px;margin:0 0 16px">Refund processed, {customer_name}</h1>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">We''ve processed a refund of <strong>{refund_amount}</strong> for your order <strong>#{order_number}</strong>.</p>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">It can take a few business days to appear on your original payment method, depending on your bank or card issuer.</p>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">Questions? Just reply to this email.</p>
    </div>
    <div style="text-align:center;padding:24px 12px;color:#9ca3af;font-size:12px;line-height:1.6">
      <p style="margin:0 0 10px">
        <a href="https://instagram.com/cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">Instagram</a>
        &middot;
        <a href="https://tiktok.com/@cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">TikTok</a>
        &middot;
        <a href="https://cosmeticmkt.com" style="color:#6b7280;text-decoration:none;margin:0 8px">cosmeticmkt.com</a>
      </p>
      <p style="margin:0">&copy; 2026 Cosmetic Marketplace. All rights reserved.</p>
    </div>
  </div>
</div>', updated_at = NOW() WHERE trigger_key = 'order_refunded';

UPDATE public.automatic_emails SET subject = 'Welcome! Here''s 10% off your first order', html_content = '<div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Here''s 10% off your first order.</div>
  <div style="max-width:560px;margin:0 auto">
    <div style="text-align:center;padding:20px 0">
      <img src="https://cosmeticmkt.com/images/store-logo.png" alt="Cosmetic Marketplace" style="height:40px;width:auto" />
    </div>
    <div style="background:#ffffff;border-radius:10px;padding:32px;color:#1f2937">
<h1 style="color:#111827;font-size:20px;margin:0 0 16px">Welcome to Cosmetic Marketplace!</h1>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">Thanks for joining our list — expect news, restocks and offers straight to your inbox.</p>
<div style="background:#fff7f5;border:1px dashed #db3614;border-radius:8px;padding:16px;margin:20px 0;text-align:center">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280">10% off your next order</p>
    <p style="margin:0;font-size:22px;font-weight:bold;letter-spacing:2px;color:#db3614">WELCOME10</p>
  </div>
<p style="text-align:center;margin:24px 0"><a href="https://cosmeticmkt.com" style="background:#db3614;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Shop now</a></p>
<p style="margin:0 0 14px;line-height:1.6;color:#374151"><span style="font-size:12px;color:#9ca3af">You''re receiving this because you subscribed at cosmeticmkt.com. You can unsubscribe any time by replying to this email.</span></p>
    </div>
    <div style="text-align:center;padding:24px 12px;color:#9ca3af;font-size:12px;line-height:1.6">
      <p style="margin:0 0 10px">
        <a href="https://instagram.com/cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">Instagram</a>
        &middot;
        <a href="https://tiktok.com/@cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">TikTok</a>
        &middot;
        <a href="https://cosmeticmkt.com" style="color:#6b7280;text-decoration:none;margin:0 8px">cosmeticmkt.com</a>
      </p>
      <p style="margin:0">&copy; 2026 Cosmetic Marketplace. All rights reserved.</p>
    </div>
  </div>
</div>', updated_at = NOW() WHERE trigger_key = 'newsletter_welcome';

UPDATE public.automatic_emails SET subject = 'You left something in your cart', html_content = '<div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">You left something in your cart.</div>
  <div style="max-width:560px;margin:0 auto">
    <div style="text-align:center;padding:20px 0">
      <img src="https://cosmeticmkt.com/images/store-logo.png" alt="Cosmetic Marketplace" style="height:40px;width:auto" />
    </div>
    <div style="background:#ffffff;border-radius:10px;padding:32px;color:#1f2937">
<h1 style="color:#111827;font-size:20px;margin:0 0 16px">Still thinking it over?</h1>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">You left some items in your cart. They''re still available, but we can''t hold them forever!</p>
<p style="margin:0 0 14px;line-height:1.6;color:#374151">{items_list}</p>
<p style="text-align:center;margin:24px 0"><a href="{store_url}" style="background:#db3614;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Complete your purchase</a></p>
<p style="margin:0 0 14px;line-height:1.6;color:#374151"><span style="font-size:12px;color:#9ca3af">You''re receiving this because you started a checkout at cosmeticmkt.com. You can unsubscribe any time by replying to this email.</span></p>
    </div>
    <div style="text-align:center;padding:24px 12px;color:#9ca3af;font-size:12px;line-height:1.6">
      <p style="margin:0 0 10px">
        <a href="https://instagram.com/cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">Instagram</a>
        &middot;
        <a href="https://tiktok.com/@cosmeticmarketplace" style="color:#6b7280;text-decoration:none;margin:0 8px">TikTok</a>
        &middot;
        <a href="https://cosmeticmkt.com" style="color:#6b7280;text-decoration:none;margin:0 8px">cosmeticmkt.com</a>
      </p>
      <p style="margin:0">&copy; 2026 Cosmetic Marketplace. All rights reserved.</p>
    </div>
  </div>
</div>', updated_at = NOW() WHERE trigger_key = 'abandoned_cart';


