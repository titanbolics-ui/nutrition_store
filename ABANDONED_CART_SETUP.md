# Abandoned Cart Notifications - Setup Guide

## Overview

This implementation automatically sends email notifications to customers who have abandoned their shopping carts. The system runs daily at midnight and sends reminder emails with a link to recover the cart.

## Features

- ✅ Automated daily checks for abandoned carts
- ✅ Beautiful email template with cart items preview
- ✅ One-click cart recovery link
- ✅ Prevents duplicate notifications (tracks last notification date)
- ✅ Uses existing Resend email provider

## Files Created

### Backend (Medusa)

1. **`src/workflows/steps/send-abandoned-notifications.ts`**
   - Step that sends abandoned cart notifications via Notification Module

2. **`src/workflows/send-abandoned-carts.ts`**
   - Workflow that orchestrates sending notifications and updating cart metadata

3. **`src/jobs/send-abandoned-cart-notification.ts`**
   - Scheduled job that runs daily at midnight
   - Finds carts abandoned for more than 24 hours
   - Filters carts with items that haven't received notifications

4. **`src/modules/resend/emails/abandoned-cart.tsx`**
   - React email template for abandoned cart notifications
   - Shows cart items, prices, and recovery button

5. **`src/modules/resend/service.ts`** (updated)
   - Added `ABANDONED_CART` template support

## Environment Variables

Add the following to your `.env` file:

```env
# Storefront URL for cart recovery links
NEXT_PUBLIC_STOREFRONT_URL=http://localhost:8000
```

For production:
```env
NEXT_PUBLIC_STOREFRONT_URL=https://yourstore.com
```

## Testing

### Test the Scheduled Job (Development)

To test immediately without waiting 24 hours:

1. **Modify the time threshold** in `src/jobs/send-abandoned-cart-notification.ts`:

```typescript
// Change this line:
oneDayAgo.setDate(oneDayAgo.getDate() - 1)

// To this (1 minute ago):
oneDayAgo.setMinutes(oneDayAgo.getMinutes() - 1)
```

2. **Change the schedule** to run every minute:

```typescript
export const config = {
  name: "abandoned-cart-notification",
  schedule: "* * * * *", // Run every minute for testing
}
```

3. **Create a test cart:**
   - Go to your storefront at `http://localhost:8000`
   - Add items to cart
   - Start checkout (enter email and shipping address)
   - Leave the cart without completing purchase

4. **Start the Medusa server:**

```bash
npm run dev
```

5. **Wait 1 minute** - you should see in the console:

```
info: Sent 1 abandoned cart notifications
```

6. **Check your email** for the abandoned cart notification

7. **⚠️ IMPORTANT: Revert the changes** after testing:
   - Change back to `oneDayAgo.setDate(oneDayAgo.getDate() - 1)`
   - Change schedule back to `"0 0 * * *"` (midnight daily)

## Storefront Integration

To enable cart recovery, you need to add a route in your Next.js storefront.

### Create Recovery Route

Create the file `src/app/[countryCode]/(main)/cart/recover/[id]/route.tsx` in your **storefront** project:

```typescript
import { NextRequest } from "next/server"
import { retrieveCart } from "../../../../../../lib/data/cart"
import { setCartId } from "../../../../../../lib/data/cookies"
import { notFound, redirect } from "next/navigation"

type Params = Promise<{
  id: string
}>

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const cart = await retrieveCart(id)

  if (!cart) {
    return notFound()
  }

  setCartId(id)

  const countryCode = cart.shipping_address?.country_code || 
    cart.region?.countries?.[0]?.iso_2

  redirect(
    `/${countryCode ? `${countryCode}/` : ""}cart`
  )
}
```

This route:
- Receives the cart ID from the email link
- Verifies the cart exists
- Sets the cart ID in cookies
- Redirects to the cart page

## How It Works

### 1. Daily Scheduled Job

Every day at midnight (00:00), the system:
- Queries all carts that were last updated more than 24 hours ago
- Filters for carts that:
  - Have an email address
  - Haven't been completed
  - Have items in them
  - Haven't received an abandoned cart notification yet

### 2. Send Notifications

For each abandoned cart:
- Creates a notification via Notification Module
- Resend provider sends the email using the `abandoned-cart` template
- Updates cart metadata with notification timestamp

### 3. Cart Recovery

When customer clicks "Complete Your Purchase" button:
- Opens URL: `https://yourstore.com/cart/recover/{cart_id}`
- Storefront route sets cart ID in cookie
- Redirects to cart page
- Customer can complete checkout

## Customization

### Change Schedule

Edit `src/jobs/send-abandoned-cart-notification.ts`:

```typescript
export const config = {
  name: "abandoned-cart-notification",
  schedule: "0 9 * * *", // Run at 9 AM daily
  // schedule: "0 */6 * * *", // Run every 6 hours
  // schedule: "0 0 * * 0", // Run weekly on Sunday
}
```

Cron format: `minute hour day month weekday`

### Change Time Threshold

Edit the time threshold in `src/jobs/send-abandoned-cart-notification.ts`:

```typescript
// For 12 hours
oneDayAgo.setHours(oneDayAgo.getHours() - 12)

// For 2 days
oneDayAgo.setDate(oneDayAgo.getDate() - 2)

// For 3 hours
oneDayAgo.setHours(oneDayAgo.getHours() - 3)
```

### Customize Email Template

Edit `src/modules/resend/emails/abandoned-cart.tsx` to:
- Change colors and styling
- Add promotional content
- Modify item display
- Add discount codes
- Change button text

### Add Multiple Reminders

To send multiple reminders (e.g., after 1 day, 3 days, 7 days):

1. Update cart metadata to track multiple notifications:
```typescript
metadata: {
  abandoned_notifications: [
    { sent_at: "2024-01-01", days_since: 1 },
    { sent_at: "2024-01-03", days_since: 3 },
  ]
}
```

2. Modify the scheduled job to check for different thresholds
3. Create different email templates for each reminder

## Monitoring

### View Logs

Watch for these log messages:

```bash
# Successful execution
info: Sent 5 abandoned cart notifications

# Email sent via Resend
📤 Resend service: Sending email via Resend API
✅ Resend service: Email sent successfully! ID: abc123

# Errors
❌ Failed to send email: [error details]
```

### Check Cart Metadata

In the admin dashboard:
1. Go to Orders
2. Find a cart
3. Check metadata for `abandoned_notification` timestamp

## Production Checklist

Before deploying to production:

- [ ] Set `NEXT_PUBLIC_STOREFRONT_URL` to production URL
- [ ] Verify Resend API key is configured
- [ ] Test cart recovery route in storefront
- [ ] Confirm schedule is set to desired frequency (default: midnight)
- [ ] Test with real email addresses
- [ ] Verify email doesn't go to spam (check SPF/DKIM in Resend)
- [ ] Monitor logs for first few days

## Troubleshooting

### Emails Not Sending

1. **Check Resend configuration** in `medusa-config.ts`
2. **Verify API key** is valid
3. **Check logs** for error messages
4. **Confirm carts match criteria**:
   - Have email address
   - Not completed
   - Have items
   - Updated more than 24 hours ago

### Cart Recovery Not Working

1. **Verify storefront URL** is correct in `.env`
2. **Check recovery route** exists in storefront
3. **Test URL manually**: `http://localhost:8000/cart/recover/{cart_id}`
4. **Check browser console** for errors

### Duplicate Notifications

The system prevents duplicates by storing `abandoned_notification` in cart metadata. If you're still getting duplicates:

1. Check if metadata is being saved correctly
2. Verify the filter in scheduled job: `!cart.metadata?.abandoned_notification`

## Support

For issues or questions:
- Check Medusa documentation: https://docs.medusajs.com
- Review Resend docs: https://resend.com/docs
- Check scheduled jobs docs: https://docs.medusajs.com/resources/references/scheduled-jobs

## Future Enhancements

Potential improvements:
- Multiple reminder emails (1 day, 3 days, 7 days)
- Dynamic discount codes in emails
- A/B testing different email templates
- SMS notifications via Twilio
- Push notifications
- Analytics tracking (open rates, click rates, recovery rates)

