import { MedusaContainer } from "@medusajs/types"
import { Modules } from "@medusajs/framework/utils"

export default async function abandonedCartSequenceJob(
  container: MedusaContainer
) {
  const logger = container.resolve("logger")
  const query = container.resolve("query")
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const cartModule = container.resolve(Modules.CART)

  const now = new Date()

    // 🛡️ SECURITY CUTOFF: Ignore all carts before this date
  const CUTOFF_DATE = new Date("2026-01-25T00:00:00Z")
  
  // Time thresholds
  const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000) // 1 hour
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours
  const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000) // 25 hours

  let totalSent = 0

  try {
    // ========== STAGE 1: HELP EMAIL (1-2 hours after abandonment) ==========
    logger.info("🔍 Checking for Stage 1 (Help) candidates...")
    
    const { data: stage1Carts } = await query.graph({
      entity: "cart",
      fields: ["id", "email", "items.*", "metadata", "customer.*", "shipping_address.*", "updated_at"],
      filters: {
        updated_at: { $gte: twoHoursAgo, $lte: oneHourAgo, $gt: CUTOFF_DATE },
        email: { $ne: null },
        completed_at: null,
      },
      pagination: { skip: 0, take: 100 },
    })

    const stage1Eligible = stage1Carts.filter((cart) => 
      cart.items?.length > 0 && 
      !cart.metadata?.abandoned_help_sent &&
      // #TODO: Uncomment this when testing is done
      // cart.email === "titanbolics@gmail.com" // FOR TESTING ONLY - Remove in production
      true
    )

    logger.info(`  Found ${stage1Eligible.length} carts for Stage 1 (Help) [titanbolics only]`)

    for (const cart of stage1Eligible) {
      try {
        await notificationModuleService.createNotifications({
          to: cart.email!,
          channel: "email",
          template: "abandoned-cart-help",
          data: {
            cart,
            storefront_url: process.env.NEXT_PUBLIC_STORE_URL || "https://onyxgenetics.com",
          },
        })

        await cartModule.updateCarts([{
          id: cart.id,
          metadata: {
            ...cart.metadata,
            abandoned_help_sent: new Date().toISOString(),
          },
        }])

        totalSent++
        logger.info(`  ✅ Sent Help email to ${cart.email}`)
      } catch (error) {
        logger.error(`  ❌ Failed to send Help email: ${error.message}`)
      }
    }

    // ========== STAGE 2: TRUST EMAIL (24 hours after abandonment) ==========
    logger.info("🔍 Checking for Stage 2 (Trust) candidates...")
    
    const { data: stage2Carts } = await query.graph({
      entity: "cart",
      fields: ["id", "email", "items.*", "metadata", "customer.*", "shipping_address.*", "updated_at"],
      filters: {
        updated_at: { $gte: twentyFiveHoursAgo, $lte: twentyFourHoursAgo, $gt: CUTOFF_DATE },
        email: { $ne: null },
        completed_at: null,
      },
      pagination: { skip: 0, take: 100 },
    })

    const stage2Eligible = stage2Carts.filter((cart) => 
      cart.items?.length > 0 && 
      !!cart.metadata?.abandoned_help_sent &&
      !cart.metadata?.abandoned_trust_sent &&
      // #TODO: Uncomment this when testing is done
      // cart.email === "titanbolics@gmail.com" // FOR TESTING ONLY - Remove in production
      true
    )

    logger.info(`  Found ${stage2Eligible.length} carts for Stage 2 (Trust) [titanbolics only]`)

    for (const cart of stage2Eligible) {
      try {
        await notificationModuleService.createNotifications({
          to: cart.email!,
          channel: "email",
          template: "abandoned-cart-trust",
          data: {
            cart,
            storefront_url: process.env.NEXT_PUBLIC_STORE_URL || "https://onyxgenetics.com",
          },
        })

        await cartModule.updateCarts([{
          id: cart.id,
          metadata: {
            ...cart.metadata,
            abandoned_trust_sent: new Date().toISOString(),
          },
        }])

        totalSent++
        logger.info(`  ✅ Sent Trust email to ${cart.email}`)
      } catch (error) {
        logger.error(`  ❌ Failed to send Trust email: ${error.message}`)
      }
    }

    // ========== STAGE 3: FINAL EMAIL (before dispatch deadline) ==========
    logger.info("🔍 Checking for Stage 3 (Final) candidates...")
    
    const dayOfWeek = now.getDay()
    const currentHour = now.getHours()
    
    // Determine if we should send final emails
    let shouldSendFinal = false
    
    // Sunday evening (for Monday dispatch) - between 6 PM and 11 PM
    if (dayOfWeek === 0 && currentHour >= 18 && currentHour <= 23) {
      shouldSendFinal = true
    }
    
    // Wednesday evening (for Thursday dispatch) - between 6 PM and 11 PM
    if (dayOfWeek === 3 && currentHour >= 18 && currentHour <= 23) {
      shouldSendFinal = true
    }

    if (shouldSendFinal) {
      const { data: stage3Carts } = await query.graph({
        entity: "cart",
        fields: ["id", "email", "items.*", "metadata", "customer.*", "shipping_address.*"],
        filters: {
          updated_at: { $lt: twentyFourHoursAgo, $gt: CUTOFF_DATE },
          email: { $ne: null },
          completed_at: null,
        },
        pagination: { skip: 0, take: 100 },
      })

      const stage3Eligible = stage3Carts.filter((cart) => 
        cart.items?.length > 0 && 
        !!cart.metadata?.abandoned_trust_sent &&
        !cart.metadata?.abandoned_final_sent &&
        // #TODO: Uncomment this when testing is done
        // cart.email === "titanbolics@gmail.com" // FOR TESTING ONLY - Remove in production
        true
      )

      logger.info(`  Found ${stage3Eligible.length} carts for Stage 3 (Final) [titanbolics only]`)

      for (const cart of stage3Eligible) {
        try {
          await notificationModuleService.createNotifications({
            to: cart.email!,
            channel: "email",
            template: "abandoned-cart-final",
            data: {
              cart,
              storefront_url: process.env.NEXT_PUBLIC_STORE_URL || "https://onyxgenetics.com",
            },
          })

          await cartModule.updateCarts([{
            id: cart.id,
            metadata: {
              ...cart.metadata,
              abandoned_final_sent: new Date().toISOString(),
            },
          }])

          totalSent++
          logger.info(`  ✅ Sent Final email to ${cart.email}`)
        } catch (error) {
          logger.error(`  ❌ Failed to send Final email: ${error.message}`)
        }
      }
    } else {
      logger.info(`  ⏭️  Not the right time for Stage 3 (Final) emails`)
    }

    logger.info(`✅ Total emails sent: ${totalSent}`)
  } catch (error) {
    logger.error(`❌ Abandoned cart sequence job failed: ${error.message}`)
  }
}

export const config = {
  name: "abandoned-cart-sequence",
  schedule: "0 * * * *", // Run every hour
}

