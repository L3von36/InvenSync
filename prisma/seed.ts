import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clean up existing data
  await prisma.serviceBooking.deleteMany()
  await prisma.serviceType.deleteMany()
  await prisma.debtPayment.deleteMany()
  await prisma.debt.deleteMany()
  await prisma.saleItem.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.productAttributeValue.deleteMany()
  await prisma.product.deleteMany()
  await prisma.attributeDefinition.deleteMany()
  await prisma.productType.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.integrationConfig.deleteMany()
  await prisma.organizationModule.deleteMany()
  await prisma.shopMember.deleteMany()
  await prisma.shop.deleteMany()
  await prisma.module.deleteMany()
  await prisma.salesGoal.deleteMany()
  await prisma.salesCommission.deleteMany()
  await prisma.salesRep.deleteMany()
  await prisma.organizationMember.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  // ============================================
  // CREATE USERS
  // ============================================

  const passwordHash = await hash('password123', 12)
  const adminPasswordHash = await hash('admin123', 12)

  // Admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@invensync.com',
      name: 'Admin User',
      passwordHash: adminPasswordHash,
      role: 'admin',
    }
  })
  console.log('✅ Created admin user:', adminUser.email)

  // Demo user
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash,
    }
  })
  console.log('✅ Created demo user:', demoUser.email)

  // Barber user
  const barberUser = await prisma.user.create({
    data: {
      email: 'abebe@barbershop.et',
      name: 'Abebe Tadesse',
      passwordHash,
    }
  })
  console.log('✅ Created barber user:', barberUser.email)

  // Sales Rep users
  const salesRepPasswordHash = await hash('sales123', 12)
  const salesRepUser1 = await prisma.user.create({
    data: {
      email: 'sales@invensync.com',
      name: 'Selamawit Bekele',
      passwordHash: salesRepPasswordHash,
      role: 'sales_rep',
    }
  })
  console.log('✅ Created sales rep user:', salesRepUser1.email)

  const salesRepUser2 = await prisma.user.create({
    data: {
      email: 'daniel@invensync.com',
      name: 'Daniel Hailu',
      passwordHash: salesRepPasswordHash,
      role: 'sales_rep',
    }
  })
  console.log('✅ Created sales rep user:', salesRepUser2.email)

  // Org Manager user (sees Manager Dashboard)
  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@invensync.com',
      name: 'Meron Worku',
      passwordHash,
    }
  })
  console.log('✅ Created org manager user:', managerUser.email)

  // Org Employee user (sees Employee/Cashier Dashboard)
  const employeeUser = await prisma.user.create({
    data: {
      email: 'employee@invensync.com',
      name: 'Yonas Tesfaye',
      passwordHash,
    }
  })
  console.log('✅ Created org employee user:', employeeUser.email)

  // Shop Cashier user (sees Cashier Dashboard)
  const cashierUser = await prisma.user.create({
    data: {
      email: 'cashier@invensync.com',
      name: 'Hana Girma',
      passwordHash,
    }
  })
  console.log('✅ Created shop cashier user:', cashierUser.email)

  // Shop Warehouse user
  const warehouseUser = await prisma.user.create({
    data: {
      email: 'warehouse@invensync.com',
      name: 'Bereket Alemu',
      passwordHash,
    }
  })
  console.log('✅ Created shop warehouse user:', warehouseUser.email)

  // Shop Sales user
  const shopSalesUser = await prisma.user.create({
    data: {
      email: 'salesstaff@invensync.com',
      name: 'Lidya Bekele',
      passwordHash,
    }
  })
  console.log('✅ Created shop sales user:', shopSalesUser.email)

  // ============================================
  // CREATE ORGANIZATIONS
  // ============================================

  // Demo Electronics Store (retail, with location)
  const demoOrg = await prisma.organization.create({
    data: {
      name: 'Demo Electronics Store',
      slug: 'demo-electronics-store',
      currency: 'ETB',
      country: 'Ethiopia',
      businessType: 'retail',
      description: 'A leading electronics retail store in Addis Ababa',
      address: 'Bole Road, Atlas Building',
      city: 'Addis Ababa',
      latitude: 9.0250,
      longitude: 38.7500,
      phone: '+251111234567',
      subscriptionPlan: 'professional',
      subscriptionStatus: 'active',
    }
  })
  console.log('✅ Created demo organization:', demoOrg.name)

  // Abebe's Barbershop (service)
  const barbershopOrg = await prisma.organization.create({
    data: {
      name: "Abebe's Barbershop",
      slug: 'abebe-barbershop',
      currency: 'ETB',
      country: 'Ethiopia',
      businessType: 'service',
      description: 'Premium barbershop offering modern and traditional haircuts',
      address: 'Merkato, Dejach Wube Sefer',
      city: 'Addis Ababa',
      latitude: 9.0222,
      longitude: 38.7469,
      phone: '+251912345678',
      subscriptionPlan: 'professional',
      subscriptionStatus: 'active',
    }
  })
  console.log('✅ Created barbershop organization:', barbershopOrg.name)

  // More organizations with different business types and locations
  const extraOrgs = await Promise.all([
    prisma.organization.create({
      data: {
        name: 'Hana Supermarket',
        slug: 'hana-supermarket',
        businessType: 'retail',
        description: 'Full-service supermarket with fresh produce',
        address: 'CMC Road',
        city: 'Addis Ababa',
        latitude: 9.0320,
        longitude: 38.7620,
        phone: '+251923456789',
        subscriptionPlan: 'starter',
        subscriptionStatus: 'active',
      }
    }),
    prisma.organization.create({
      data: {
        name: 'Ethio Beauty Salon',
        slug: 'ethio-beauty-salon',
        businessType: 'service',
        description: 'Hair, beauty, and spa services',
        address: 'Bole, Cameroon Street',
        city: 'Addis Ababa',
        latitude: 9.0150,
        longitude: 38.7550,
        phone: '+251934567890',
        subscriptionPlan: 'professional',
        subscriptionStatus: 'active',
      }
    }),
    prisma.organization.create({
      data: {
        name: 'Merkato General Store',
        slug: 'merkato-general-store',
        businessType: 'mixed',
        description: 'Retail products and repair services',
        address: 'Merkato Area',
        city: 'Addis Ababa',
        latitude: 9.0200,
        longitude: 38.7400,
        phone: '+251945678901',
        subscriptionPlan: 'premium',
        subscriptionStatus: 'active',
      }
    }),
    prisma.organization.create({
      data: {
        name: 'Bahir Dar Electronics',
        slug: 'bahir-dar-electronics',
        businessType: 'retail',
        description: 'Electronics shop in Bahir Dar',
        address: 'Near Lake Tana',
        city: 'Bahir Dar',
        latitude: 11.5742,
        longitude: 37.3614,
        phone: '+251956789012',
        subscriptionPlan: 'starter',
        subscriptionStatus: 'active',
      }
    }),
    prisma.organization.create({
      data: {
        name: 'Hawassa Tech Hub',
        slug: 'hawassa-tech-hub',
        businessType: 'mixed',
        description: 'Tech products and IT services',
        address: 'Main Street',
        city: 'Hawassa',
        latitude: 7.0500,
        longitude: 38.4833,
        phone: '+251967890123',
        subscriptionPlan: 'professional',
        subscriptionStatus: 'active',
      }
    }),
    prisma.organization.create({
      data: {
        name: 'Dire Dawa Auto Spa',
        slug: 'dire-dawa-auto-spa',
        businessType: 'service',
        description: 'Car wash and detailing services',
        address: 'Kezira Area',
        city: 'Dire Dawa',
        latitude: 9.6000,
        longitude: 41.8667,
        phone: '+251978901234',
        subscriptionPlan: 'starter',
        subscriptionStatus: 'active',
      }
    }),
    prisma.organization.create({
      data: {
        name: 'Piassa Clothing',
        slug: 'piassa-clothing',
        businessType: 'retail',
        description: 'Traditional and modern clothing store',
        address: 'Piassa, Churchil Road',
        city: 'Addis Ababa',
        latitude: 9.0300,
        longitude: 38.7480,
        phone: '+251989012345',
        subscriptionPlan: 'professional',
        subscriptionStatus: 'active',
      }
    }),
    prisma.organization.create({
      data: {
        name: 'Kazanchis Pharmacy',
        slug: 'kazanchis-pharmacy',
        businessType: 'retail',
        description: 'Full-service pharmacy and health products',
        address: 'Kazanchis Area',
        city: 'Addis Ababa',
        latitude: 9.0180,
        longitude: 38.7520,
        phone: '+251990123456',
        subscriptionPlan: 'premium',
        subscriptionStatus: 'active',
      }
    }),
    prisma.organization.create({
      data: {
        name: 'Adama Fitness Center',
        slug: 'adama-fitness-center',
        businessType: 'service',
        description: 'Gym, personal training, and wellness services',
        address: 'Near Adama University',
        city: 'Adama',
        latitude: 8.5400,
        longitude: 39.2700,
        phone: '+251991234567',
        subscriptionPlan: 'starter',
        subscriptionStatus: 'active',
      }
    }),
  ])
  console.log(`✅ Created ${extraOrgs.length} extra organizations`)

  // ============================================
  // CREATE MEMBERSHIPS
  // ============================================

  await prisma.organizationMember.create({
    data: { userId: adminUser.id, organizationId: demoOrg.id, role: 'owner' }
  })
  await prisma.organizationMember.create({
    data: { userId: adminUser.id, organizationId: barbershopOrg.id, role: 'owner' }
  })
  await prisma.organizationMember.create({
    data: { userId: demoUser.id, organizationId: demoOrg.id, role: 'owner' }
  })
  await prisma.organizationMember.create({
    data: { userId: barberUser.id, organizationId: barbershopOrg.id, role: 'owner' }
  })
  // Admin has access to a few more orgs
  await prisma.organizationMember.create({
    data: { userId: adminUser.id, organizationId: extraOrgs[0].id, role: 'manager' }
  })
  await prisma.organizationMember.create({
    data: { userId: adminUser.id, organizationId: extraOrgs[2].id, role: 'manager' }
  })

  // New role-specific org memberships
  // Org Manager of Demo Electronics (sees Manager Dashboard)
  await prisma.organizationMember.create({
    data: { userId: managerUser.id, organizationId: demoOrg.id, role: 'manager' }
  })
  // Org Employee of Demo Electronics (sees Cashier/Employee Dashboard)
  await prisma.organizationMember.create({
    data: { userId: employeeUser.id, organizationId: demoOrg.id, role: 'employee' }
  })
  // Shop Cashier, Warehouse, Sales also need org membership
  await prisma.organizationMember.create({
    data: { userId: cashierUser.id, organizationId: demoOrg.id, role: 'employee' }
  })
  await prisma.organizationMember.create({
    data: { userId: warehouseUser.id, organizationId: demoOrg.id, role: 'employee' }
  })
  await prisma.organizationMember.create({
    data: { userId: shopSalesUser.id, organizationId: demoOrg.id, role: 'employee' }
  })

  // ============================================
  // DEMO ORG DATA (Electronics Store)
  // ============================================

  // Create product types with attributes
  const tvType = await prisma.productType.create({
    data: { organizationId: demoOrg.id, name: 'TV', icon: '📺' }
  })
  const tvAttributes = await Promise.all([
    prisma.attributeDefinition.create({
      data: { productTypeId: tvType.id, name: 'Inch', fieldType: 'number', required: true, order: 0 }
    }),
    prisma.attributeDefinition.create({
      data: { productTypeId: tvType.id, name: 'Resolution', fieldType: 'select', options: JSON.stringify(['HD', 'Full HD', '4K', '8K']), required: true, order: 1 }
    }),
    prisma.attributeDefinition.create({
      data: { productTypeId: tvType.id, name: 'Brand', fieldType: 'text', required: true, order: 2 }
    }),
    prisma.attributeDefinition.create({
      data: { productTypeId: tvType.id, name: 'Smart TV', fieldType: 'boolean', required: false, order: 3 }
    }),
    prisma.attributeDefinition.create({
      data: { productTypeId: tvType.id, name: 'Price', fieldType: 'number', required: true, order: 4 }
    }),
  ])

  const phoneType = await prisma.productType.create({
    data: { organizationId: demoOrg.id, name: 'Phone', icon: '📱' }
  })
  const phoneAttributes = await Promise.all([
    prisma.attributeDefinition.create({
      data: { productTypeId: phoneType.id, name: 'Storage', fieldType: 'select', options: JSON.stringify(['64GB', '128GB', '256GB', '512GB', '1TB']), required: true, order: 0 }
    }),
    prisma.attributeDefinition.create({
      data: { productTypeId: phoneType.id, name: 'RAM', fieldType: 'select', options: JSON.stringify(['4GB', '6GB', '8GB', '12GB', '16GB']), required: true, order: 1 }
    }),
    prisma.attributeDefinition.create({
      data: { productTypeId: phoneType.id, name: 'Brand', fieldType: 'text', required: true, order: 2 }
    }),
    prisma.attributeDefinition.create({
      data: { productTypeId: phoneType.id, name: 'Color', fieldType: 'select', options: JSON.stringify(['Black', 'White', 'Blue', 'Red', 'Green', 'Gold']), required: false, order: 3 }
    }),
    prisma.attributeDefinition.create({
      data: { productTypeId: phoneType.id, name: 'Price', fieldType: 'number', required: true, order: 4 }
    }),
  ])
  console.log('✅ Created product types with attributes')

  // Create sample products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        productTypeId: tvType.id, organizationId: demoOrg.id,
        name: 'Samsung 55" 4K Smart TV', sku: 'TV-SAM-55-4K',
        description: 'Samsung 55 inch 4K UHD Smart TV with Crystal Display',
        quantity: 15, costPrice: 25000, sellingPrice: 32000, lowStockThreshold: 5,
        attributeValues: {
          create: [
            { attributeDefinitionId: tvAttributes[0].id, value: '55' },
            { attributeDefinitionId: tvAttributes[1].id, value: '4K' },
            { attributeDefinitionId: tvAttributes[2].id, value: 'Samsung' },
            { attributeDefinitionId: tvAttributes[3].id, value: 'true' },
            { attributeDefinitionId: tvAttributes[4].id, value: '32000' },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: tvType.id, organizationId: demoOrg.id,
        name: 'LG 43" Full HD Smart TV', sku: 'TV-LG-43-FHD',
        description: 'LG 43 inch Full HD Smart TV with WebOS',
        quantity: 8, costPrice: 15000, sellingPrice: 19500, lowStockThreshold: 5,
        attributeValues: {
          create: [
            { attributeDefinitionId: tvAttributes[0].id, value: '43' },
            { attributeDefinitionId: tvAttributes[1].id, value: 'Full HD' },
            { attributeDefinitionId: tvAttributes[2].id, value: 'LG' },
            { attributeDefinitionId: tvAttributes[3].id, value: 'true' },
            { attributeDefinitionId: tvAttributes[4].id, value: '19500' },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: tvType.id, organizationId: demoOrg.id,
        name: 'Sony 65" 4K Smart TV', sku: 'TV-SONY-65-4K',
        description: 'Sony 65 inch 4K HDR Smart TV with Android TV',
        quantity: 3, costPrice: 45000, sellingPrice: 58000, lowStockThreshold: 5,
        attributeValues: {
          create: [
            { attributeDefinitionId: tvAttributes[0].id, value: '65' },
            { attributeDefinitionId: tvAttributes[1].id, value: '4K' },
            { attributeDefinitionId: tvAttributes[2].id, value: 'Sony' },
            { attributeDefinitionId: tvAttributes[3].id, value: 'true' },
            { attributeDefinitionId: tvAttributes[4].id, value: '58000' },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: tvType.id, organizationId: demoOrg.id,
        name: 'TCL 32" HD TV', sku: 'TV-TCL-32-HD',
        description: 'TCL 32 inch HD TV - basic model',
        quantity: 0, costPrice: 8000, sellingPrice: 10500, lowStockThreshold: 5,
        attributeValues: {
          create: [
            { attributeDefinitionId: tvAttributes[0].id, value: '32' },
            { attributeDefinitionId: tvAttributes[1].id, value: 'HD' },
            { attributeDefinitionId: tvAttributes[2].id, value: 'TCL' },
            { attributeDefinitionId: tvAttributes[3].id, value: 'false' },
            { attributeDefinitionId: tvAttributes[4].id, value: '10500' },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: phoneType.id, organizationId: demoOrg.id,
        name: 'Samsung Galaxy S24 128GB', sku: 'PH-SAM-S24-128',
        description: 'Samsung Galaxy S24 with 128GB storage',
        quantity: 25, costPrice: 35000, sellingPrice: 42000, lowStockThreshold: 5,
        attributeValues: {
          create: [
            { attributeDefinitionId: phoneAttributes[0].id, value: '128GB' },
            { attributeDefinitionId: phoneAttributes[1].id, value: '8GB' },
            { attributeDefinitionId: phoneAttributes[2].id, value: 'Samsung' },
            { attributeDefinitionId: phoneAttributes[3].id, value: 'Black' },
            { attributeDefinitionId: phoneAttributes[4].id, value: '42000' },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: phoneType.id, organizationId: demoOrg.id,
        name: 'iPhone 15 128GB', sku: 'PH-APL-15-128',
        description: 'Apple iPhone 15 128GB',
        quantity: 12, costPrice: 55000, sellingPrice: 65000, lowStockThreshold: 5,
        attributeValues: {
          create: [
            { attributeDefinitionId: phoneAttributes[0].id, value: '128GB' },
            { attributeDefinitionId: phoneAttributes[1].id, value: '6GB' },
            { attributeDefinitionId: phoneAttributes[2].id, value: 'Apple' },
            { attributeDefinitionId: phoneAttributes[3].id, value: 'Blue' },
            { attributeDefinitionId: phoneAttributes[4].id, value: '65000' },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: phoneType.id, organizationId: demoOrg.id,
        name: 'Xiaomi Redmi Note 13 256GB', sku: 'PH-XIA-RN13-256',
        description: 'Xiaomi Redmi Note 13 with 256GB storage',
        quantity: 30, costPrice: 12000, sellingPrice: 15500, lowStockThreshold: 10,
        attributeValues: {
          create: [
            { attributeDefinitionId: phoneAttributes[0].id, value: '256GB' },
            { attributeDefinitionId: phoneAttributes[1].id, value: '8GB' },
            { attributeDefinitionId: phoneAttributes[2].id, value: 'Xiaomi' },
            { attributeDefinitionId: phoneAttributes[3].id, value: 'Black' },
            { attributeDefinitionId: phoneAttributes[4].id, value: '15500' },
          ]
        }
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: phoneType.id, organizationId: demoOrg.id,
        name: 'Huawei P60 256GB', sku: 'PH-HUA-P60-256',
        description: 'Huawei P60 Pro 256GB',
        quantity: 2, costPrice: 28000, sellingPrice: 35000, lowStockThreshold: 5,
        attributeValues: {
          create: [
            { attributeDefinitionId: phoneAttributes[0].id, value: '256GB' },
            { attributeDefinitionId: phoneAttributes[1].id, value: '8GB' },
            { attributeDefinitionId: phoneAttributes[2].id, value: 'Huawei' },
            { attributeDefinitionId: phoneAttributes[3].id, value: 'Green' },
            { attributeDefinitionId: phoneAttributes[4].id, value: '35000' },
          ]
        }
      }
    }),
  ])
  console.log(`✅ Created ${products.length} products`)

  // Create stock movements for initial inventory
  await Promise.all(products.map(product =>
    prisma.stockMovement.create({
      data: {
        organizationId: demoOrg.id, productId: product.id,
        type: 'in', quantity: product.quantity,
        previousStock: 0, newStock: product.quantity, reason: 'Initial stock',
      }
    })
  ))

  // Create customers for demo org
  const customers = await Promise.all([
    prisma.customer.create({
      data: { organizationId: demoOrg.id, name: 'Abebe Kebede', email: 'abebe@example.com', phone: '+251911234567', address: 'Addis Ababa, Bole' }
    }),
    prisma.customer.create({
      data: { organizationId: demoOrg.id, name: 'Sara Hailu', email: 'sara@example.com', phone: '+251922345678', address: 'Addis Ababa, CMC' }
    }),
    prisma.customer.create({
      data: { organizationId: demoOrg.id, name: 'Dawit Tadesse', phone: '+251933456789', address: 'Addis Ababa, Kazanchis' }
    }),
    prisma.customer.create({
      data: { organizationId: demoOrg.id, name: 'Meron Alemu', email: 'meron@example.com', phone: '+251944567890', address: 'Addis Ababa, Lideta' }
    }),
    prisma.customer.create({
      data: { organizationId: demoOrg.id, name: 'Yohannes Girma', phone: '+251955678901', address: 'Addis Ababa, Piassa' }
    }),
  ])
  console.log(`✅ Created ${customers.length} customers`)

  // Create suppliers for demo org
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: { organizationId: demoOrg.id, name: 'Tech Import PLC', email: 'info@techimport.et', phone: '+251111234567', address: 'Addis Ababa, Merkato' }
    }),
    prisma.supplier.create({
      data: { organizationId: demoOrg.id, name: 'Global Electronics', email: 'sales@globalelectronics.et', phone: '+251112345678', address: 'Addis Ababa, Bole' }
    }),
  ])
  console.log(`✅ Created ${suppliers.length} suppliers`)

  // Create sample sales for demo org
  const sale1 = await prisma.sale.create({
    data: {
      organizationId: demoOrg.id, customerId: customers[0].id,
      invoiceNumber: 'INV-001', status: 'completed', paymentMethod: 'cash',
      subtotal: 42000, discount: 0, tax: 0, total: 42000, amountPaid: 42000,
      saleDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      items: {
        create: [{ productId: products[4].id, quantity: 1, unitPrice: 42000, costPrice: 35000, total: 42000 }]
      }
    }
  })
  await prisma.product.update({ where: { id: products[4].id }, data: { quantity: { decrement: 1 } } })
  await prisma.stockMovement.create({
    data: { organizationId: demoOrg.id, productId: products[4].id, type: 'out', quantity: 1, previousStock: 25, newStock: 24, reason: 'Sale', reference: 'INV-001' }
  })

  const sale2 = await prisma.sale.create({
    data: {
      organizationId: demoOrg.id, customerId: customers[1].id,
      invoiceNumber: 'INV-002', status: 'completed', paymentMethod: 'mobile_money',
      subtotal: 51500, discount: 1000, tax: 0, total: 50500, amountPaid: 50500,
      saleDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          { productId: products[6].id, quantity: 1, unitPrice: 15500, costPrice: 12000, total: 15500 },
          { productId: products[1].id, quantity: 1, unitPrice: 19500, costPrice: 15000, total: 19500 },
          { productId: products[6].id, quantity: 1, unitPrice: 15500, costPrice: 12000, total: 15500 },
        ]
      }
    }
  })
  await prisma.product.update({ where: { id: products[6].id }, data: { quantity: { decrement: 2 } } })
  await prisma.stockMovement.create({
    data: { organizationId: demoOrg.id, productId: products[6].id, type: 'out', quantity: 2, previousStock: 30, newStock: 28, reason: 'Sale', reference: 'INV-002' }
  })
  await prisma.product.update({ where: { id: products[1].id }, data: { quantity: { decrement: 1 } } })
  await prisma.stockMovement.create({
    data: { organizationId: demoOrg.id, productId: products[1].id, type: 'out', quantity: 1, previousStock: 8, newStock: 7, reason: 'Sale', reference: 'INV-002' }
  })

  const sale3 = await prisma.sale.create({
    data: {
      organizationId: demoOrg.id, customerId: customers[2].id,
      invoiceNumber: 'INV-003', status: 'completed', paymentMethod: 'credit',
      subtotal: 97000, discount: 0, tax: 0, total: 97000, amountPaid: 50000,
      saleDate: new Date(),
      items: {
        create: [
          { productId: products[5].id, quantity: 1, unitPrice: 65000, costPrice: 55000, total: 65000 },
          { productId: products[0].id, quantity: 1, unitPrice: 32000, costPrice: 25000, total: 32000 },
        ]
      }
    }
  })
  await prisma.product.update({ where: { id: products[5].id }, data: { quantity: { decrement: 1 } } })
  await prisma.stockMovement.create({
    data: { organizationId: demoOrg.id, productId: products[5].id, type: 'out', quantity: 1, previousStock: 12, newStock: 11, reason: 'Sale', reference: 'INV-003' }
  })
  await prisma.product.update({ where: { id: products[0].id }, data: { quantity: { decrement: 1 } } })
  await prisma.stockMovement.create({
    data: { organizationId: demoOrg.id, productId: products[0].id, type: 'out', quantity: 1, previousStock: 15, newStock: 14, reason: 'Sale', reference: 'INV-003' }
  })
  console.log('✅ Created 3 sample sales')

  // Create debts for demo org
  await prisma.debt.create({
    data: {
      organizationId: demoOrg.id, customerId: customers[2].id,
      type: 'customer_debt', amount: 47000, paidAmount: 0,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'pending', description: 'Remaining balance from sale INV-003',
    }
  })
  await prisma.debt.create({
    data: {
      organizationId: demoOrg.id, customerId: customers[3].id,
      type: 'customer_debt', amount: 25000, paidAmount: 10000,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: 'partial', description: 'Credit purchase - Samsung TV',
    }
  })
  await prisma.debt.create({
    data: {
      organizationId: demoOrg.id, supplierId: suppliers[0].id,
      type: 'supplier_debt', amount: 120000, paidAmount: 60000,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'partial', description: 'TV stock purchase - partial payment',
    }
  })
  // Add a payment to the partial debt
  const partialDebt = await prisma.debt.findFirst({
    where: { organizationId: demoOrg.id, status: 'partial', type: 'customer_debt' }
  })
  if (partialDebt) {
    await prisma.debtPayment.create({
      data: { debtId: partialDebt.id, amount: 10000, paymentMethod: 'cash', notes: 'First installment' }
    })
  }
  console.log('✅ Created debts')

  // ============================================
  // BARBERSHOP ORG DATA
  // ============================================

  // Service types for barbershop
  const haircutService = await prisma.serviceType.create({
    data: {
      organizationId: barbershopOrg.id,
      name: 'Haircut',
      description: 'Standard haircut with wash and style',
      duration: 30,
      price: 150,
    }
  })
  const beardTrimService = await prisma.serviceType.create({
    data: {
      organizationId: barbershopOrg.id,
      name: 'Beard Trim',
      description: 'Beard shaping and trim',
      duration: 15,
      price: 80,
    }
  })
  const fullGroomingService = await prisma.serviceType.create({
    data: {
      organizationId: barbershopOrg.id,
      name: 'Full Grooming',
      description: 'Complete haircut, beard trim, facial, and wash',
      duration: 60,
      price: 350,
    }
  })
  console.log('✅ Created barbershop service types')

  // Customers for barbershop
  const barberCustomers = await Promise.all([
    prisma.customer.create({
      data: { organizationId: barbershopOrg.id, name: 'Tilahun Gessesse', phone: '+251911000001', address: 'Addis Ababa, Merkato' }
    }),
    prisma.customer.create({
      data: { organizationId: barbershopOrg.id, name: 'Mulatu Astatke', phone: '+251911000002', address: 'Addis Ababa, Bole' }
    }),
    prisma.customer.create({
      data: { organizationId: barbershopOrg.id, name: 'Eskinder Nega', phone: '+251911000003', address: 'Addis Ababa, CMC' }
    }),
    prisma.customer.create({
      data: { organizationId: barbershopOrg.id, name: 'Aster Aweke', phone: '+251911000004', address: 'Addis Ababa, Piassa' }
    }),
  ])
  console.log(`✅ Created ${barberCustomers.length} barbershop customers`)

  // Sample bookings for barbershop
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(today)
  dayAfter.setDate(dayAfter.getDate() + 2)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  await Promise.all([
    // Today's bookings
    prisma.serviceBooking.create({
      data: {
        organizationId: barbershopOrg.id,
        serviceTypeId: haircutService.id,
        customerId: barberCustomers[0].id,
        customerName: 'Tilahun Gessesse',
        customerPhone: '+251911000001',
        status: 'completed',
        bookingDate: today,
        startTime: '09:00',
        endTime: '09:30',
      }
    }),
    prisma.serviceBooking.create({
      data: {
        organizationId: barbershopOrg.id,
        serviceTypeId: fullGroomingService.id,
        customerId: barberCustomers[1].id,
        customerName: 'Mulatu Astatke',
        customerPhone: '+251911000002',
        status: 'scheduled',
        bookingDate: today,
        startTime: '10:00',
        endTime: '11:00',
      }
    }),
    prisma.serviceBooking.create({
      data: {
        organizationId: barbershopOrg.id,
        serviceTypeId: beardTrimService.id,
        customerId: barberCustomers[2].id,
        customerName: 'Eskinder Nega',
        customerPhone: '+251911000003',
        status: 'scheduled',
        bookingDate: today,
        startTime: '11:30',
        endTime: '11:45',
      }
    }),
    // Tomorrow's bookings
    prisma.serviceBooking.create({
      data: {
        organizationId: barbershopOrg.id,
        serviceTypeId: haircutService.id,
        customerId: barberCustomers[3].id,
        customerName: 'Aster Aweke',
        customerPhone: '+251911000004',
        status: 'scheduled',
        bookingDate: tomorrow,
        startTime: '09:00',
        endTime: '09:30',
      }
    }),
    prisma.serviceBooking.create({
      data: {
        organizationId: barbershopOrg.id,
        serviceTypeId: fullGroomingService.id,
        customerName: 'Walk-in Customer',
        customerPhone: '+251911000005',
        status: 'scheduled',
        bookingDate: tomorrow,
        startTime: '14:00',
        endTime: '15:00',
      }
    }),
    // Day after tomorrow
    prisma.serviceBooking.create({
      data: {
        organizationId: barbershopOrg.id,
        serviceTypeId: haircutService.id,
        customerName: 'Abebe Bikila',
        customerPhone: '+251911000006',
        status: 'scheduled',
        bookingDate: dayAfter,
        startTime: '10:00',
        endTime: '10:30',
      }
    }),
    // Yesterday's completed/cancelled bookings
    prisma.serviceBooking.create({
      data: {
        organizationId: barbershopOrg.id,
        serviceTypeId: haircutService.id,
        customerId: barberCustomers[0].id,
        customerName: 'Tilahun Gessesse',
        customerPhone: '+251911000001',
        status: 'completed',
        bookingDate: yesterday,
        startTime: '09:00',
        endTime: '09:30',
      }
    }),
    prisma.serviceBooking.create({
      data: {
        organizationId: barbershopOrg.id,
        serviceTypeId: fullGroomingService.id,
        customerName: 'No-show Customer',
        customerPhone: '+251911000007',
        status: 'no_show',
        bookingDate: yesterday,
        startTime: '11:00',
        endTime: '12:00',
      }
    }),
    prisma.serviceBooking.create({
      data: {
        organizationId: barbershopOrg.id,
        serviceTypeId: beardTrimService.id,
        customerName: 'Cancelled Customer',
        customerPhone: '+251911000008',
        status: 'cancelled',
        bookingDate: yesterday,
        startTime: '14:00',
        endTime: '14:15',
      }
    }),
  ])
  console.log('✅ Created barbershop bookings')

  // ============================================
  // EXTRA ORG DATA (some products/sales for market insights)
  // ============================================

  // Hana Supermarket (retail) - some products and sales
  const groceryType = await prisma.productType.create({
    data: { organizationId: extraOrgs[0].id, name: 'Grocery', icon: '🛒' }
  })
  const supermarketProducts = await Promise.all([
    prisma.product.create({
      data: {
        productTypeId: groceryType.id, organizationId: extraOrgs[0].id,
        name: 'Teff Flour 5kg', quantity: 50, costPrice: 200, sellingPrice: 280, lowStockThreshold: 10,
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: groceryType.id, organizationId: extraOrgs[0].id,
        name: 'Berbere Spice 500g', quantity: 30, costPrice: 80, sellingPrice: 120, lowStockThreshold: 5,
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: groceryType.id, organizationId: extraOrgs[0].id,
        name: 'Shiro Powder 1kg', quantity: 3, costPrice: 150, sellingPrice: 220, lowStockThreshold: 10,
      }
    }),
  ])

  // Customer and sale for supermarket
  const supermarketCustomer = await prisma.customer.create({
    data: { organizationId: extraOrgs[0].id, name: 'Local Restaurant', phone: '+251912000001' }
  })
  await prisma.sale.create({
    data: {
      organizationId: extraOrgs[0].id, customerId: supermarketCustomer.id,
      invoiceNumber: 'INV-HS-001', status: 'completed', paymentMethod: 'cash',
      subtotal: 860, discount: 0, tax: 0, total: 860, amountPaid: 860,
      saleDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          { productId: supermarketProducts[0].id, quantity: 2, unitPrice: 280, costPrice: 200, total: 560 },
          { productId: supermarketProducts[1].id, quantity: 2, unitPrice: 120, costPrice: 80, total: 240 },
          { productId: supermarketProducts[2].id, quantity: 1, unitPrice: 220, costPrice: 150, total: 220 },
        ]
      }
    }
  })
  console.log('✅ Created supermarket data')

  // Merkato General Store (mixed) - products and a repair service type
  const electronicsType = await prisma.productType.create({
    data: { organizationId: extraOrgs[2].id, name: 'Electronics', icon: '🔌' }
  })
  const repairService = await prisma.serviceType.create({
    data: {
      organizationId: extraOrgs[2].id,
      name: 'Phone Repair',
      description: 'Smartphone screen and battery repair',
      duration: 60,
      price: 500,
    }
  })
  const genStoreProducts = await Promise.all([
    prisma.product.create({
      data: {
        productTypeId: electronicsType.id, organizationId: extraOrgs[2].id,
        name: 'Phone Screen Protector', quantity: 100, costPrice: 30, sellingPrice: 80, lowStockThreshold: 20,
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: electronicsType.id, organizationId: extraOrgs[2].id,
        name: 'USB-C Cable', quantity: 2, costPrice: 50, sellingPrice: 120, lowStockThreshold: 10,
      }
    }),
  ])
  const genStoreCustomer = await prisma.customer.create({
    data: { organizationId: extraOrgs[2].id, name: 'Repair Walk-in', phone: '+251913000001' }
  })
  await prisma.serviceBooking.create({
    data: {
      organizationId: extraOrgs[2].id,
      serviceTypeId: repairService.id,
      customerId: genStoreCustomer.id,
      customerName: 'Repair Walk-in',
      customerPhone: '+251913000001',
      status: 'scheduled',
      bookingDate: tomorrow,
      startTime: '10:00',
      endTime: '11:00',
    }
  })
  await prisma.sale.create({
    data: {
      organizationId: extraOrgs[2].id, customerId: genStoreCustomer.id,
      invoiceNumber: 'INV-MGS-001', status: 'completed', paymentMethod: 'cash',
      subtotal: 320, discount: 0, tax: 0, total: 320, amountPaid: 320,
      saleDate: new Date(),
      items: {
        create: [
          { productId: genStoreProducts[0].id, quantity: 3, unitPrice: 80, costPrice: 30, total: 240 },
          { productId: genStoreProducts[1].id, quantity: 1, unitPrice: 120, costPrice: 50, total: 120 },
        ]
      }
    }
  })
  console.log('✅ Created general store data')

  // Piassa Clothing (retail) - some products
  const clothingType = await prisma.productType.create({
    data: { organizationId: extraOrgs[6].id, name: 'Clothing', icon: '👕' }
  })
  await Promise.all([
    prisma.product.create({
      data: {
        productTypeId: clothingType.id, organizationId: extraOrgs[6].id,
        name: 'Habesha Kemis', quantity: 15, costPrice: 2000, sellingPrice: 3500, lowStockThreshold: 5,
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: clothingType.id, organizationId: extraOrgs[6].id,
        name: 'Netela Shawl', quantity: 8, costPrice: 500, sellingPrice: 900, lowStockThreshold: 5,
      }
    }),
  ])

  // Kazanchis Pharmacy (retail) - some products
  const medicineType = await prisma.productType.create({
    data: { organizationId: extraOrgs[7].id, name: 'Medicine', icon: '💊' }
  })
  await Promise.all([
    prisma.product.create({
      data: {
        productTypeId: medicineType.id, organizationId: extraOrgs[7].id,
        name: 'Paracetamol 500mg (Box)', quantity: 100, costPrice: 50, sellingPrice: 80, lowStockThreshold: 20,
      }
    }),
    prisma.product.create({
      data: {
        productTypeId: medicineType.id, organizationId: extraOrgs[7].id,
        name: 'Amoxicillin 250mg (Box)', quantity: 4, costPrice: 120, sellingPrice: 180, lowStockThreshold: 10,
      }
    }),
  ])
  console.log('✅ Created additional org data')

  // ============================================
  // MODULES (Platform-wide feature modules)
  // ============================================

  const moduleData = [
    { key: 'inventory', name: 'Inventory Management', description: 'Track products, stock levels, and inventory movements across all your shops', icon: 'Package', category: 'core', priceETB: 0, isFree: true, freeTrialDays: 0, order: 0 },
    { key: 'sales', name: 'Sales & POS', description: 'Process sales, manage invoices, and track revenue with point-of-sale functionality', icon: 'ShoppingCart', category: 'core', priceETB: 0, isFree: true, freeTrialDays: 0, order: 1 },
    { key: 'debts', name: 'Debt & Credit Tracking', description: 'Track customer and supplier debts, manage credit and payment plans', icon: 'HandCoins', category: 'core', priceETB: 0, isFree: true, freeTrialDays: 0, order: 2 },
    { key: 'customers', name: 'Customer Management', description: 'Manage customer relationships, purchase history, and loyalty tracking', icon: 'Users', category: 'core', priceETB: 0, isFree: true, freeTrialDays: 0, order: 3 },
    { key: 'suppliers', name: 'Supplier Management', description: 'Manage supplier relationships, purchase orders, and supply chain tracking', icon: 'Truck', category: 'core', priceETB: 0, isFree: true, freeTrialDays: 0, order: 4 },
    { key: 'multi-shop', name: 'Multi-Shop Management', description: 'Manage multiple shop locations, assign staff, and track performance per shop', icon: 'Store', category: 'core', priceETB: 0, isFree: true, freeTrialDays: 0, order: 5 },
    { key: 'services', name: 'Service Booking', description: 'Book appointments, manage service schedules, and track service revenue', icon: 'Wrench', category: 'core', priceETB: 75, isFree: false, freeTrialDays: 30, order: 6 },
    { key: 'reports', name: 'Reports & Analytics', description: 'Advanced sales reports, profit analysis, and inventory insights with visual charts', icon: 'BarChart3', category: 'analytics', priceETB: 50, isFree: false, freeTrialDays: 30, order: 7 },
    { key: 'low-stock-alerts', name: 'Low Stock Alerts', description: 'Get automatic notifications when products fall below threshold levels', icon: 'AlertTriangle', category: 'analytics', priceETB: 30, isFree: false, freeTrialDays: 30, order: 8 },
    { key: 'demand-forecast', name: 'Demand Forecasting', description: 'AI-powered demand prediction based on historical sales data and trends', icon: 'TrendingUp', category: 'analytics', priceETB: 100, isFree: false, freeTrialDays: 30, order: 9 },
    { key: 'ai-business-assistant', name: 'AI Business Assistant', description: 'Ask questions about your business data and get AI-powered insights and recommendations', icon: 'Brain', category: 'ai', priceETB: 75, isFree: false, freeTrialDays: 30, order: 10 },
    { key: 'ai-inventory-assistant', name: 'AI Inventory Assistant', description: 'Scan product images to auto-fill product details using AI vision technology', icon: 'ScanSearch', category: 'ai', priceETB: 75, isFree: false, freeTrialDays: 30, order: 11 },
    { key: 'telegram-bot', name: 'Telegram Bot', description: 'Get inventory updates and sales reports directly through your Telegram bot', icon: 'Send', category: 'integration', priceETB: 40, isFree: false, freeTrialDays: 30, order: 12 },
    { key: 'whatsapp-business', name: 'WhatsApp Business', description: 'Send notifications and receive orders via WhatsApp Business API integration', icon: 'MessageSquare', category: 'integration', priceETB: 60, isFree: false, freeTrialDays: 30, order: 13 },
  ]

  const createdModules = await Promise.all(
    moduleData.map(m => prisma.module.create({ data: m }))
  )
  console.log(`✅ Created ${createdModules.length} modules`)

  // Activate modules for ALL organizations
  // Free modules: permanent active status (no expiry)
  // Paid modules: 30-day trial
  const now = new Date()
  const allOrgs = [demoOrg, barbershopOrg, ...extraOrgs]

  for (const org of allOrgs) {
    for (const mod of createdModules) {
      const modInfo = moduleData.find(m => m.key === mod.key)
      const isFree = modInfo?.isFree ?? mod.priceETB === 0

      if (isFree) {
        await prisma.organizationModule.create({
          data: {
            organizationId: org.id,
            moduleId: mod.id,
            status: 'active',
            isActive: true,
            expiresAt: null,
            priceAtActivation: mod.priceETB,
            autoRenew: false,
          }
        })
      } else {
        const trialDays = modInfo?.freeTrialDays ?? 30
        const expiresAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
        await prisma.organizationModule.create({
          data: {
            organizationId: org.id,
            moduleId: mod.id,
            status: 'trial',
            isActive: true,
            expiresAt,
            priceAtActivation: mod.priceETB,
            autoRenew: false,
          }
        })
      }
    }
  }
  console.log(`✅ Activated modules for ${allOrgs.length} organizations`)

  // ============================================
  // SHOPS (Multi-shop locations)
  // ============================================

  const demoShops = await Promise.all([
    prisma.shop.create({
      data: {
        organizationId: demoOrg.id,
        name: 'Bole Main Branch',
        address: 'Bole Road, Atlas Building, Floor 1',
        city: 'Addis Ababa',
        latitude: 9.0250,
        longitude: 38.7500,
        phone: '+251111234567',
        isActive: true,
      }
    }),
    prisma.shop.create({
      data: {
        organizationId: demoOrg.id,
        name: 'CMC Branch',
        address: 'CMC Road, Sunshine Building',
        city: 'Addis Ababa',
        latitude: 9.0320,
        longitude: 38.7620,
        phone: '+251111345678',
        isActive: true,
      }
    }),
    prisma.shop.create({
      data: {
        organizationId: demoOrg.id,
        name: 'Merkato Warehouse',
        address: 'Merkato Area, Near Stadium',
        city: 'Addis Ababa',
        latitude: 9.0200,
        longitude: 38.7400,
        phone: '+251111456789',
        isActive: false,
      }
    }),
  ])

  // Create shop members
  await Promise.all([
    prisma.shopMember.create({
      data: { userId: demoUser.id, shopId: demoShops[0].id, role: 'manager' }
    }),
    prisma.shopMember.create({
      data: { userId: adminUser.id, shopId: demoShops[0].id, role: 'manager' }
    }),
    prisma.shopMember.create({
      data: { userId: adminUser.id, shopId: demoShops[1].id, role: 'cashier' }
    }),
    // New role-specific shop members
    // Shop Manager - Bole Main Branch
    prisma.shopMember.create({
      data: { userId: managerUser.id, shopId: demoShops[0].id, role: 'manager' }
    }),
    // Shop Cashier - Bole Main Branch (sees Cashier Dashboard)
    prisma.shopMember.create({
      data: { userId: cashierUser.id, shopId: demoShops[0].id, role: 'cashier' }
    }),
    // Shop Warehouse - CMC Branch
    prisma.shopMember.create({
      data: { userId: warehouseUser.id, shopId: demoShops[1].id, role: 'warehouse' }
    }),
    // Shop Sales - Bole Main Branch
    prisma.shopMember.create({
      data: { userId: shopSalesUser.id, shopId: demoShops[0].id, role: 'sales' }
    }),
    // Employee also assigned as cashier at CMC Branch
    prisma.shopMember.create({
      data: { userId: employeeUser.id, shopId: demoShops[1].id, role: 'cashier' }
    }),
  ])
  console.log(`✅ Created ${demoShops.length} shops with members`)

  // ============================================
  // SALES REPS
  // ============================================

  // Create SalesRep profiles for the sales_rep users
  const salesRep1 = await prisma.salesRep.create({
    data: {
      userId: salesRepUser1.id,
      phone: '+251911000011',
      targetCity: 'Addis Ababa',
      commissionRate: 10,
      commissionPerReg: 500,
      isActive: true,
    }
  })
  console.log('✅ Created sales rep profile for:', salesRepUser1.email)

  const salesRep2 = await prisma.salesRep.create({
    data: {
      userId: salesRepUser2.id,
      phone: '+251911000012',
      targetCity: 'Bahir Dar',
      commissionRate: 8,
      commissionPerReg: 400,
      isActive: true,
    }
  })
  console.log('✅ Created sales rep profile for:', salesRepUser2.email)

  // Set monthly goals for sales reps
  const currentPeriod = new Date().toISOString().slice(0, 7)
  await prisma.salesGoal.create({
    data: {
      salesRepId: salesRep1.id,
      period: currentPeriod,
      targetCount: 10,
      bonusAmount: 2000,
    }
  })
  await prisma.salesGoal.create({
    data: {
      salesRepId: salesRep2.id,
      period: currentPeriod,
      targetCount: 8,
      bonusAmount: 1500,
    }
  })
  console.log('✅ Created sales rep goals')

  console.log('🎉 Seeding complete!')
  console.log('')
  console.log('Demo credentials:')
  console.log('  ─── System-Level Roles ───')
  console.log('  Platform Admin:')
  console.log('    Email: admin@invensync.com')
  console.log('    Password: admin123')
  console.log('')
  console.log('  Sales Rep:')
  console.log('    Email: sales@invensync.com')
  console.log('    Password: sales123')
  console.log('')
  console.log('  ─── Organization-Level Roles ───')
  console.log('  Org Owner (Owner Dashboard):')
  console.log('    Email: demo@example.com')
  console.log('    Password: password123')
  console.log('')
  console.log('  Org Manager (Manager Dashboard):')
  console.log('    Email: manager@invensync.com')
  console.log('    Password: password123')
  console.log('')
  console.log('  Org Employee (Cashier Dashboard):')
  console.log('    Email: employee@invensync.com')
  console.log('    Password: password123')
  console.log('')
  console.log('  ─── Shop-Level Roles ───')
  console.log('  Shop Cashier (Cashier Dashboard):')
  console.log('    Email: cashier@invensync.com')
  console.log('    Password: password123')
  console.log('')
  console.log('  Shop Warehouse:')
  console.log('    Email: warehouse@invensync.com')
  console.log('    Password: password123')
  console.log('')
  console.log('  Shop Sales:')
  console.log('    Email: salesstaff@invensync.com')
  console.log('    Password: password123')
  console.log('')
  console.log('  ─── Other Accounts ───')
  console.log('  Barber Shop Owner:')
  console.log('    Email: abebe@barbershop.et')
  console.log('    Password: password123')
  console.log('')
  console.log('  Sales Rep #2:')
  console.log('    Email: daniel@invensync.com')
  console.log('    Password: sales123')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
