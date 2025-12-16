Repo: ecommerce_gentlegurl_crm（Admin panel / CRM）

Goal: Extend Shop Settings page to support editing Footer Settings and saving to backend via existing API.

Context

Backend API GET /api/ecommerce/shop-settings will now return extra block:

{
  "data": {
    "shop_contact_widget": {...},
    "homepage_products": {...},
    "shipping": {...},
    "footer": {
      "enabled": true,
      "about_text": "optional string",
      "contact": {
        "whatsapp": "+60123456789",
        "email": "support@example.com",
        "address": "optional string"
      },
      "social": {
        "instagram": "https://instagram.com/xxx",
        "facebook": "https://facebook.com/xxx",
        "tiktok": "https://tiktok.com/@xxx"
      },
      "links": {
        "shipping_policy": "/shipping-policy",
        "return_refund": "/return-refund",
        "privacy": "/privacy-policy",
        "terms": "/terms"
      }
    }
  },
  "success": true,
  "message": null
}

Tasks
1) UI: Add “Footer Settings” section to Shop Settings page

Keep same style as existing sections (cards, spacing, Save button).

Fields:

Enable Footer (toggle) → data.footer.enabled

About text (textarea) → data.footer.about_text

Contact (optional fields; allow empty):

WhatsApp → data.footer.contact.whatsapp

Email → data.footer.contact.email

Address (textarea) → data.footer.contact.address

Follow Us (links):

Instagram URL → data.footer.social.instagram

Facebook URL → data.footer.social.facebook

TikTok URL → data.footer.social.tiktok

Customer Care Links:

Shipping Policy path/url → data.footer.links.shipping_policy

Return & Refund path/url → data.footer.links.return_refund

Privacy Policy path/url → data.footer.links.privacy

Terms path/url → data.footer.links.terms

Validation:

URLs: basic validation (must start with http(s)://) for social links; if empty, accept.

Links: accept relative paths like /privacy-policy.

2) Data loading

When loading shop settings:

If footer block missing, initialize sensible defaults in UI state.

Do not break existing fields (whatsapp widget, homepage products, shipping).

3) Saving behavior

On “Save Changes”:

Call the same API you already use for saving shop settings (PUT/PATCH whatever current implementation is).

Send full data object including the new footer block.

Show success toast/message consistent with current page.

Important:

Do NOT remove unknown keys from settings; preserve existing structure.

If your save endpoint expects a specific payload shape, follow existing implementation pattern.

4) Keep backward compatibility

If backend doesn’t yet return footer fields (older env), UI should still render but use defaults.

Deliverables

Shop Settings page includes Footer Settings section.

Admin can edit + save footer settings.

Reload page shows persisted values correctly.