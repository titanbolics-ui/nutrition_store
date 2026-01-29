# Cart Recovery Route - Storefront Setup

## Quick Setup

Add this route to your **Next.js Starter Storefront** to enable cart recovery from abandoned cart emails.

## File Location

Create this file in your storefront project:

```
src/app/[countryCode]/(main)/cart/recover/[id]/route.tsx
```

## Code

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

## How It Works

1. Customer clicks "Complete Your Purchase" button in abandoned cart email
2. URL opens: `http://yourstore.com/cart/recover/{cart_id}`
3. This route:
   - Retrieves the cart from Medusa backend
   - Sets the cart ID in browser cookies
   - Redirects to the cart page
4. Customer sees their saved cart and can complete checkout

## Testing

1. **Create abandoned cart** in your store
2. **Get cart ID** from admin dashboard or database
3. **Open URL manually**:
   ```
   http://localhost:8000/cart/recover/{your-cart-id}
   ```
4. **Verify** you're redirected to cart page with items

## Environment Variables

Make sure your storefront `.env.local` has:

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
```

For production:
```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.yourstore.com
```

## Troubleshooting

### 404 Error

- Verify file path is exactly: `src/app/[countryCode]/(main)/cart/recover/[id]/route.tsx`
- Check you're using App Router (not Pages Router)
- Restart Next.js dev server

### Cart Not Found

- Verify cart ID is correct
- Check cart exists in Medusa database
- Confirm Medusa backend URL is correct

### Redirect Issues

- Check `retrieveCart` and `setCartId` functions exist in your storefront
- Verify Next.js Starter Storefront version is compatible
- Look for errors in browser console

## Alternative: Pages Router

If using Pages Router instead of App Router:

Create `pages/cart/recover/[id].tsx`:

```typescript
import { GetServerSideProps } from "next"
import { retrieveCart } from "../../../lib/data/cart"

export const getServerSideProps: GetServerSideProps = async ({ params, res }) => {
  const cartId = params?.id as string
  
  try {
    const cart = await retrieveCart(cartId)
    
    if (!cart) {
      return { notFound: true }
    }

    // Set cookie
    res.setHeader(
      "Set-Cookie",
      `cart_id=${cartId}; Path=/; Max-Age=2592000; SameSite=Lax`
    )

    const countryCode = cart.shipping_address?.country_code || 
      cart.region?.countries?.[0]?.iso_2

    return {
      redirect: {
        destination: `/${countryCode ? `${countryCode}/` : ""}cart`,
        permanent: false,
      },
    }
  } catch (error) {
    return { notFound: true }
  }
}

export default function RecoverCart() {
  return null
}
```

## Done!

Once this route is added, abandoned cart emails will successfully redirect customers back to their carts.

