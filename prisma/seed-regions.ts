import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🏙️ Seeding regions...')

  const regions = [
    { name: 'Addis Ababa', slug: 'addis-ababa', latitude: 9.0250, longitude: 38.7500, population: 3738000, description: 'Capital city and largest metropolitan area', order: 0 },
    { name: 'Adama', slug: 'adama', latitude: 8.5400, longitude: 39.2700, population: 324000, description: 'Major commercial city in Oromia region', order: 1 },
    { name: 'Hawassa', slug: 'hawassa', latitude: 7.0500, longitude: 38.4833, population: 315000, description: 'Capital of Sidama region, lakeside city', order: 2 },
    { name: 'Bahir Dar', slug: 'bahir-dar', latitude: 11.5742, longitude: 37.3614, population: 366000, description: 'Capital of Amhara region, near Lake Tana', order: 3 },
    { name: 'Dire Dawa', slug: 'dire-dawa', latitude: 9.6000, longitude: 41.8667, population: 440000, description: 'Second largest city, major trade hub', order: 4 },
    { name: 'Mekelle', slug: 'mekelle', latitude: 13.4967, longitude: 39.4753, population: 310000, description: 'Capital of Tigray region', order: 5 },
    { name: 'Jimma', slug: 'jimma', latitude: 7.6734, longitude: 36.8350, population: 207000, description: 'Major coffee trading center', order: 6 },
    { name: 'Gondar', slug: 'gondar', latitude: 12.6000, longitude: 37.4667, population: 368000, description: 'Historic city, tourist destination', order: 7 },
    { name: 'Dessie', slug: 'dessie', latitude: 11.1317, longitude: 39.6333, population: 219000, description: 'Major city in Amhara region', order: 8 },
    { name: 'Debre Berhan', slug: 'debre-berhan', latitude: 9.6833, longitude: 39.5333, population: 121000, description: 'Growing commercial center north of Addis', order: 9 },
  ]

  for (const region of regions) {
    await prisma.region.upsert({
      where: { slug: region.slug },
      update: region,
      create: region,
    })
  }

  // Assign existing organizations to regions based on their city field
  const allOrgs = await prisma.organization.findMany({ select: { id: true, city: true } })
  const allRegions = await prisma.region.findMany()
  
  for (const org of allOrgs) {
    if (!org.city) continue
    const matchingRegion = allRegions.find(r => 
      org.city!.toLowerCase().includes(r.name.toLowerCase()) ||
      r.name.toLowerCase().includes(org.city!.toLowerCase())
    )
    if (matchingRegion) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { regionId: matchingRegion.id }
      })
    }
  }

  console.log(`✅ Created ${regions.length} regions and assigned organizations`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
