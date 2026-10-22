// Destructive fixtures are restricted to an explicitly selected, separate test database.
require('dotenv/config');
require('ts-node/register');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const request = require('supertest');

const originalDatabase = process.env.DB_DATABASE || 'study_db';
const testDatabase = process.env.TEST_DB_DATABASE;
if (
  !testDatabase ||
  testDatabase === originalDatabase ||
  !/^be_study_alignment_test_[a-z0-9_]+$/.test(testDatabase)
) {
  throw new Error(
    'TEST_DB_DATABASE must name a separate be_study_alignment_test_* database. Never use the application database.',
  );
}
process.env.DB_DATABASE = testDatabase;
const source = require('../src/data-source').default;
const database = new DataSource({
  ...source.options,
  installExtensions: false,
});

async function snapshot() {
  const tables =
    await database.query(`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'migrations' ORDER BY table_name`);
  const result = [];
  for (const { table_name: table } of tables) {
    const columns = await database.query(
      `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [table],
    );
    const fields = columns
      .map(({ column_name: column }) => `"${column.replaceAll('"', '""')}"`)
      .join(', ');
    const sql = `SELECT "id", md5(row_to_json(t)::text) AS hash FROM (SELECT ${fields} FROM "${table.replaceAll('"', '""')}") t ORDER BY "id"`;
    result.push({ table, sql, rows: await database.query(sql) });
  }
  return result;
}

async function constraint(sql, parameters, code) {
  await assert.rejects(
    database.query(sql, parameters),
    (error) => error.driverError?.code === code,
  );
}

async function run() {
  let app;
  await database.initialize();
  try {
    const before = await snapshot();
    const migrated = await database.runMigrations({ transaction: 'all' });
    assert(
      migrated.some(
        (migration) =>
          migration.name === 'AddProjectDatabaseFields1792713600000',
      ),
      'Test database must start before the alignment migration',
    );
    for (const table of before)
      assert.deepEqual(
        await database.query(table.sql),
        table.rows,
        `Legacy data changed: ${table.table}`,
      );
    assert.equal(
      (await database.runMigrations({ transaction: 'all' })).length,
      0,
    );
    assert.equal(
      (
        await database.query(`SELECT count(*)::int AS n FROM products WHERE "images" <> CASE
      WHEN "imageUrl" IS NOT NULL AND "imageUrl" <> '' THEN jsonb_build_array("imageUrl") ELSE '[]'::jsonb END`)
      )[0].n,
      0,
    );
    assert.equal(
      (
        await database.query(`SELECT count(*)::int AS n FROM orders WHERE "orderCode" <> 'DH-' || id::text
      OR "shippingName" IS NOT NULL OR "shippingPhone" IS NOT NULL OR "shippingAddress" IS NOT NULL OR "paymentMethod" IS NOT NULL`)
      )[0].n,
      0,
    );
    const schema = await database.driver.createSchemaBuilder().log();
    assert.equal(
      schema.upQueries.length,
      0,
      `Entity/schema differences: ${schema.upQueries.map((q) => q.query).join('\n')}`,
    );
    console.log(
      'PASS: transactional migrations, legacy column fingerprints, image/code backfill, idempotency and entity/schema parity',
    );

    const { Test } = require('@nestjs/testing');
    const { ValidationPipe } = require('@nestjs/common');
    const { JwtService } = require('@nestjs/jwt');
    const { AppModule } = require('../src/app.module');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    const http = request(app.getHttpServer());
    const prefix = '/api/v1';
    const suffix = randomUUID();
    const credentials = {
      username: 'Migration test',
      email: `migration-${suffix}@example.com`,
      password: 'Migration-test-2026',
    };
    const registered = (
      await http
        .post(`${prefix}/auth/register`)
        .send({
          ...credentials,
          fullName: ' Nguyen Van A ',
          phone: '0123456789',
          address: 'Ha Noi',
        })
        .expect(201)
    ).body;
    assert.equal(registered.user.fullName, 'Nguyen Van A');
    assert(!('passwordHash' in registered.user));
    const userId = registered.user.id;
    const token = (
      await http
        .post(`${prefix}/auth/login`)
        .send({ email: credentials.email, password: credentials.password })
        .expect(201)
    ).body.accessToken;
    const adminToken = module
      .get(JwtService)
      .sign({ sub: userId, email: credentials.email, role: 'ADMIN' });
    const auth = (req) => req.auth(token, { type: 'bearer' });
    const admin = (req) => req.auth(adminToken, { type: 'bearer' });
    const profile = (
      await auth(http.patch(`${prefix}/users/me`))
        .send({ fullName: null, phone: '0987654321' })
        .expect(200)
    ).body;
    assert.equal(profile.fullName, null);
    assert.equal(profile.phone, '0987654321');
    assert.equal(profile.address, 'Ha Noi');
    assert(!('passwordHash' in profile));
    await http
      .post(`${prefix}/auth/register`)
      .send({ ...credentials, email: `legacy-${suffix}@example.com` })
      .expect(201);
    const parent = (
      await database.query(
        `INSERT INTO category_parents (name) VALUES ($1) RETURNING id`,
        [`Test ${suffix}`],
      )
    )[0];
    const category = (
      await admin(http.post(`${prefix}/categories`))
        .send({ name: 'Bộ vi xử lý thử nghiệm', parentId: parent.id })
        .expect(201)
    ).body;
    assert.match(category.slug, /^bo-vi-xu-ly-thu-nghiem-[a-f0-9-]+$/);
    await admin(http.post(`${prefix}/categories`))
      .send({
        name: 'Another category',
        parentId: parent.id,
        slug: category.slug,
      })
      .expect(409);
    await admin(http.patch(`${prefix}/categories/${category.id}`))
      .send({ slug: null })
      .expect(400);
    const renamed = (
      await admin(http.patch(`${prefix}/categories/${category.id}`))
        .send({ name: 'Renamed category' })
        .expect(200)
    ).body;
    assert.equal(renamed.slug, category.slug);
    const secondCategory = (
      await admin(http.post(`${prefix}/categories`))
        .send({ name: 'Second category', parentId: parent.id })
        .expect(201)
    ).body;
    const productInput = {
      name: `CPU test ${suffix}`,
      price: '1000000',
      categoryId: category.id,
      imageUrl: 'https://example.com/cpu.png',
      sku: `SKU-${suffix}`,
      brand: 'Test',
      discountPrice: '900000',
      stockQuantity: 5,
      warrantyMonths: 36,
      images: ['https://example.com/cpu.png', 'https://example.com/cpu-2.png'],
      specifications: {
        socket: 'AM5',
        tdp: 120,
        supportedRam: ['DDR5'],
        cores: 8,
        threads: 16,
        hasIntegratedGpu: true,
      },
    };
    const product = (
      await admin(http.post(`${prefix}/products`))
        .send(productInput)
        .expect(201)
    ).body;
    assert.equal(product.discountPrice, '900000');
    assert.deepEqual(product.specifications, productInput.specifications);
    assert.deepEqual(product.images, productInput.images);
    await admin(http.post(`${prefix}/products`))
      .send(productInput)
      .expect(409);
    await admin(http.patch(`${prefix}/products/${product.id}`))
      .send({ price: '800000' })
      .expect(400);
    for (const invalid of [
      { stockQuantity: -1 },
      { stockQuantity: 1.5 },
      { warrantyMonths: -1 },
      { discountPrice: '1000001' },
      { specifications: [] },
      { images: null },
      { images: ['javascript:alert(1)'] },
    ]) {
      await admin(http.patch(`${prefix}/products/${product.id}`))
        .send(invalid)
        .expect(400);
    }
    const legacyProduct = (
      await admin(http.post(`${prefix}/products`))
        .send({
          name: `Legacy ${suffix}`,
          price: '100',
          categoryId: category.id,
        })
        .expect(201)
    ).body;
    assert.equal(legacyProduct.stockQuantity, null);
    await admin(http.patch(`${prefix}/products/${legacyProduct.id}`))
      .send({ sku: product.sku, price: '200' })
      .expect(409);
    assert.equal(
      (await http.get(`${prefix}/products/${legacyProduct.id}`).expect(200))
        .body.price,
      '100',
    );
    const freeDiscount = (
      await admin(http.patch(`${prefix}/products/${legacyProduct.id}`))
        .send({
          discountPrice: '0',
          stockQuantity: 0,
          warrantyMonths: 0,
          images: [],
          specifications: {},
        })
        .expect(200)
    ).body;
    assert.equal(freeDiscount.discountPrice, '0');
    const cleared = (
      await admin(http.patch(`${prefix}/products/${legacyProduct.id}`))
        .send({
          discountPrice: null,
          stockQuantity: null,
          warrantyMonths: null,
          specifications: null,
        })
        .expect(200)
    ).body;
    assert.equal(cleared.discountPrice, null);
    assert.equal(cleared.stockQuantity, null);
    const examples = [
      {
        socket: 'LGA1700',
        chipset: 'B760',
        formFactor: 'Micro-ATX',
        ramType: 'DDR5',
        ramSlots: 4,
        m2Slots: 3,
      },
      {
        type: 'DDR5',
        capacityGb: 32,
        busSpeedMhz: 6000,
        modules: 2,
        casLatency: 'CL30',
      },
      {
        chipsetSeries: 'RTX 4070',
        vramGb: 12,
        tdp: 200,
        recommendedPsu: 650,
        lengthMm: 305,
        slots: 2.5,
      },
      {
        wattage: 750,
        efficiency: '80 Plus Gold',
        modularity: 'Full-Modular',
        formFactor: 'ATX',
      },
      {
        interface: 'M.2 NVMe PCIe 4.0',
        capacityGb: 1000,
        formFactor: 'M.2 2280',
        readSpeedMb: 7450,
      },
      {
        formFactorSupport: ['ATX', 'Micro-ATX'],
        maxGpuLengthMm: 360,
        maxCpuCoolerHeightMm: 165,
        supportedRadiatorSizesMm: [240, 280, 360],
      },
      {
        coolerType: 'Air',
        supportedSockets: ['AM5', 'LGA1700'],
        heightMm: 157,
        tdpRating: 220,
      },
      {
        coolerType: 'AIO_Liquid',
        supportedSockets: ['AM5'],
        radiatorSizeMm: 360,
        tdpRating: 250,
      },
    ];
    for (const specifications of examples) {
      const updated = (
        await admin(http.patch(`${prefix}/products/${legacyProduct.id}`))
          .send({ specifications })
          .expect(200)
      ).body;
      assert.deepEqual(updated.specifications, specifications);
    }
    const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    assert.equal(
      document.components.schemas.CheckoutDto.properties.shippingName.type,
      'string',
    );
    assert.equal(
      document.paths[`${prefix}/orders/checkout`].post.requestBody.required,
      false,
    );
    await auth(http.post(`${prefix}/orders/cart/items`))
      .send({ productId: product.id, quantity: 2 })
      .expect(201);
    const checkedOut = (
      await auth(http.post(`${prefix}/orders/checkout`)).expect(201)
    ).body;
    assert.equal(checkedOut.status, 'Processing');
    assert.equal(checkedOut.totalPrice, '2000000');
    assert.equal(checkedOut.paymentMethod, null);
    assert.match(checkedOut.orderCode, /^DH-[a-f0-9-]{36}$/);
    await auth(http.post(`${prefix}/orders/cart/items`))
      .send({ productId: product.id, quantity: 3 })
      .expect(201);
    await admin(http.patch(`${prefix}/products/${product.id}`))
      .send({ price: '1100000' })
      .expect(200);
    const cart = (await auth(http.get(`${prefix}/orders/cart`)).expect(200))
      .body;
    assert.equal(cart.totalPrice, '3300000');
    assert.equal(cart.items[0].unitPrice, '1100000');
    const historical = (
      await auth(http.get(`${prefix}/orders/${checkedOut.id}`)).expect(200)
    ).body;
    assert.equal(historical.totalPrice, '2000000');
    assert.equal(historical.items[0].unitPrice, '1000000');
    await auth(http.post(`${prefix}/orders/checkout`))
      .send({ paymentMethod: 'INVALID' })
      .expect(400);
    const shipped = (
      await auth(http.post(`${prefix}/orders/checkout`))
        .send({
          shippingName: ' Receiver ',
          shippingPhone: '0123456789',
          shippingAddress: ' Test address ',
          paymentMethod: 'VNPAY',
        })
        .expect(201)
    ).body;
    assert.equal(shipped.shippingName, 'Receiver');
    assert.equal(shipped.shippingAddress, 'Test address');
    assert.equal(shipped.paymentMethod, 'VNPAY');
    const afterProduct = (
      await http.get(`${prefix}/products/${product.id}`).expect(200)
    ).body;
    assert.equal(afterProduct.stockQuantity, 5);
    assert.equal(afterProduct.discountPrice, '900000');
    console.log(
      'PASS: real HTTP auth/profile/catalog validation, optional checkout, cart repricing and historical order prices',
    );

    await constraint(
      `UPDATE products SET sku = $1 WHERE id = $2`,
      [product.sku, legacyProduct.id],
      '23505',
    );
    await constraint(
      `UPDATE categories SET slug = $1 WHERE id = $2`,
      [category.slug, secondCategory.id],
      '23505',
    );
    await constraint(
      `UPDATE orders SET "orderCode" = $1 WHERE id <> $2`,
      [checkedOut.orderCode, checkedOut.id],
      '23505',
    );
    for (const [column, value] of [
      ['stockQuantity', -1],
      ['warrantyMonths', -1],
      ['discountPrice', '1100001'],
    ]) {
      await constraint(
        `UPDATE products SET "${column}" = $1 WHERE id = $2`,
        [value, product.id],
        '23514',
      );
    }
    for (const rating of [0, 6])
      await constraint(
        `INSERT INTO reviews (rating, "userId", "productId") VALUES ($1,$2,$3)`,
        [rating, userId, product.id],
        '23514',
      );
    await constraint(
      `INSERT INTO reviews (rating, "userId", "productId") VALUES (5,$1,$2)`,
      [userId, randomUUID()],
      '23503',
    );
    await database.query(
      `INSERT INTO reviews (rating, comment, "userId", "productId") VALUES (5,'Good',$1,$2)`,
      [userId, product.id],
    );
    const warranty = (
      await database.query(
        `INSERT INTO warranty_tickets ("productId","userId","orderCode","contactName","contactPhone","issueDescription") VALUES ($1,$2,$3,'Receiver','0123456789','Test issue') RETURNING *`,
        [product.id, userId, checkedOut.orderCode],
      )
    )[0];
    assert.match(warranty.ticketCode, /^BH-[a-f0-9-]{36}$/);
    assert.equal(warranty.status, 'RECEIVED');
    await constraint(
      `INSERT INTO warranty_tickets ("productId","orderCode","contactName","contactPhone","issueDescription") VALUES ($1,'DH-missing','Receiver','0','Test')`,
      [product.id],
      '23503',
    );
    await constraint(
      `UPDATE warranty_tickets SET status = 'INVALID' WHERE id=$1`,
      [warranty.id],
      '22P02',
    );
    await database.query(
      `INSERT INTO product_recommendations ("productName","categoryType","referencePrice","productId","targetUses","keySpecs","reasoningMap") VALUES ('CPU','CPU',1000000,$1,'["GAMING"]','{"socket":"AM5"}','{"GAMING":"High performance"}')`,
      [product.id],
    );
    await constraint(
      `INSERT INTO product_recommendations ("productName","categoryType","referencePrice","targetUses") VALUES ('CPU','CPU',100,'["INVALID"]')`,
      [],
      '23514',
    );
    await constraint(`DELETE FROM products WHERE id=$1`, [product.id], '23503');
    await constraint(
      `DELETE FROM orders WHERE id=$1`,
      [checkedOut.id],
      '23503',
    );
    const migration =
      require('../src/migrations/1792713600000-AddProjectDatabaseFields').AddProjectDatabaseFields1792713600000;
    await assert.rejects(
      new migration().down(),
      /cannot be automatically reverted/,
    );
    console.log(
      'PASS: unique codes/SKU/slug, foreign keys, numeric checks, new entities and deletion/revert protection',
    );
  } finally {
    if (app) await app.close();
    await database.destroy();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
