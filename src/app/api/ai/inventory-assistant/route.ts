import { NextResponse } from 'next/server'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { createAI, isAIAvailable } from '@/lib/ai'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

// POST /api/ai/inventory-assistant
export async function POST(request: Request) {
  try {
    // AI rate limiting
    const rateLimitResult = applyRateLimit(request, RateLimitTiers.AI)
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let orgId: string | null = null
    let imageFile: File | null = null

    try {
      const formData = await request.formData()
      orgId = formData.get('orgId') as string
      imageFile = formData.get('image') as File | null
    } catch {
      return NextResponse.json(
        { error: 'This endpoint requires multipart/form-data with an image file. Send orgId and image as form fields.' },
        { status: 400 }
      )
    }

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required. Upload an image using the "image" form field.' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'ai-inventory-assistant')
      if (moduleError) return moduleError
    }

    // Check if AI service is available in this environment
    if (!isAIAvailable()) {
      return NextResponse.json({
        productInfo: null,
        error: 'AI vision features are currently available in the development environment only. A public AI API endpoint needs to be configured for production use.',
        aiAvailable: false,
      })
    }

    // Convert image to base64
    const bytes = await imageFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${base64}`

    // Call VLM to identify product
    const prompt = `You are an expert product identification assistant for an inventory management system. Analyze this image and identify the product. Return a JSON object with the following structure:
{
  "category": "The product category (e.g., TV, Phone, Laptop, Camera, etc.)",
  "brand": "The brand of the product if visible",
  "model": "The model name/number if visible",
  "color": "The color of the product if visible",
  "attributes": {
    "key1": "value1",
    "key2": "value2"
  },
  "description": "A brief description of the product",
  "suggestedName": "A suggested name for this product in inventory",
  "confidence": "high/medium/low"
}

Include only attributes that are clearly visible in the image. Be as specific as possible. If you cannot identify something, use null for that field.`

    const ai = await createAI()
    const response = await ai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ]
    })

    // Parse the VLM response
    let productInfo
    try {
      const textContent = response.choices?.[0]?.message?.content || String(response)

      // Try to extract JSON from the response
      const jsonMatch = (textContent as string).match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        productInfo = JSON.parse(jsonMatch[0])
      } else {
        productInfo = { rawResponse: textContent }
      }
    } catch {
      productInfo = { rawResponse: String(response) }
    }

    return NextResponse.json({ productInfo })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('AI inventory assistant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
