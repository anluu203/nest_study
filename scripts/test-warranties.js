// Uses a uniquely named temporary database; never migrates the application DB.
require('dotenv/config');
require('ts-node/register');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const request = require('supertest');

const originalDatabase = process.env.DB_DATABASE || 'study_db';
const testDatabase = `be_study_warranty_test_${randomUUID().replaceAll('-', '')}`;
const connection = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: originalDatabase,
  connectionTimeoutMillis: 5000,
});

async function run() {
  let database;
  let app;
  let created = false;
  await connection.connect();
  try {
    await connection.query(`CREATE DATABASE "${testDatabase}"`);
    created = true;
    process.env.DB_DATABASE = testDatabase;
    process.env.JWT_SECRET ||= 'warranty-integration-test-only';
    const source = require('../src/data-source').default;
    database = new DataSource({ ...source.options, installExtensions: false });
    await database.initialize();
    const migrations = database.migrations;
    database.migrations = migrations.filter(
      (migration) => migration.name !== 'AddWarrantyWorkflow1793145600000',
    );
    await database.runMigrations({ transaction: 'all' });
    const row = async (sql, parameters = []) =>
      (await database.query(sql, parameters))[0];
    const legacyOwner = await row(
      `INSERT INTO "user" (username, email, "passwordHash") VALUES ('Legacy', 'legacy@test.local', 'test-only') RETURNING *`,
    );
    const parent = await row(
      `INSERT INTO category_parents (name) VALUES ('Warranty test') RETURNING *`,
    );
    const category = await row(
      `INSERT INTO categories (name, slug, "parentId") VALUES ('GPU', 'warranty-test', $1) RETURNING *`,
      [parent.id],
    );
    const legacyProduct = await row(
      `INSERT INTO products (name, price, "categoryId", "warrantyMonths") VALUES ('Legacy GPU', 100, $1, 36) RETURNING *`,
      [category.id],
    );
    const legacyOrder = await row(
      `INSERT INTO orders ("userId", status, "totalPrice") VALUES ($1, 'Done', 400) RETURNING *`,
      [legacyOwner.id],
    );
    const legacyItem = await row(
      `INSERT INTO order_items ("orderId", "productId", quantity, "unitPrice") VALUES ($1, $2, 4, 100) RETURNING *`,
      [legacyOrder.id, legacyProduct.id],
    );
    const legacyTicket = await row(
      `INSERT INTO warranty_tickets ("productId", "userId", "orderCode", "contactName", "contactPhone", "issueDescription", status, "techNotes") VALUES ($1, $2, $3, 'Legacy', '0900000000', 'Legacy issue', 'CHECKING', 'Known legacy note') RETURNING *`,
      [legacyProduct.id, legacyOwner.id, legacyOrder.orderCode],
    );
    database.migrations = migrations;
    await database.runMigrations({ transaction: 'all' });
    assert.deepEqual(
      await row(`SELECT * FROM warranty_tickets WHERE id = $1`, [
        legacyTicket.id,
      ]),
      { ...legacyTicket, warrantyProductId: null },
    );
    const legacyEvent = await row(
      `SELECT * FROM warranty_events WHERE "ticketId" = $1`,
      [legacyTicket.id],
    );
    assert.equal(legacyEvent.status, 'CHECKING');
    assert.equal(legacyEvent.note, 'Known legacy note');
    assert.equal(
      (await row(`SELECT count(*)::int AS n FROM warranty_products`)).n,
      0,
    );
    assert.equal(
      (await database.runMigrations({ transaction: 'all' })).length,
      0,
    );
    const schema = await database.driver.createSchemaBuilder().log();
    assert.equal(
      schema.upQueries.length,
      0,
      `Schema differs from entities: ${schema.upQueries.map((query) => query.query).join('\n')}`,
    );
    console.log(
      'PASS: migrations, preserved legacy tickets, legacy timeline, no invented purchase dates, entity/schema parity',
    );

    const { Test } = require('@nestjs/testing');
    const { ValidationPipe } = require('@nestjs/common');
    const { JwtService } = require('@nestjs/jwt');
    const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
    const { AppModule } = require('../src/app.module');
    const {
      todayInVietnam,
    } = require('../src/modules/warranties/warranty.utils');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    const jwt = module.get(JwtService);
    const user = await row(
      `INSERT INTO "user" (username, email, "passwordHash") VALUES ('Owner', 'owner@test.local', 'test-only') RETURNING *`,
    );
    const other = await row(
      `INSERT INTO "user" (username, email, "passwordHash") VALUES ('Other', 'other@test.local', 'test-only') RETURNING *`,
    );
    const admin = await row(
      `INSERT INTO "user" (username, email, "passwordHash", role) VALUES ('Admin', 'admin@test.local', 'test-only', 'ADMIN') RETURNING *`,
    );
    const token = (account) =>
      jwt.sign({ sub: account.id, email: account.email, role: account.role });
    const userToken = token(user);
    const otherToken = token(other);
    const legacyToken = token(legacyOwner);
    const adminToken = token(admin);
    const api = (method, path, bearer = userToken) =>
      request(app.getHttpServer())
        [method](`/api/v1${path}`)
        .auth(bearer, { type: 'bearer' });
    const body = async (response) => (await response).body;
    const productBase = '/warranties/products';
    const requestsBase = '/warranties/requests';
    const adminBase = '/admin/warranties';
    const today = todayInVietnam();

    for (const path of [
      productBase,
      requestsBase,
      `${adminBase}/products`,
      `${adminBase}/requests`,
      `${adminBase}/requests/stats`,
    ]) {
      await request(app.getHttpServer()).get(`/api/v1${path}`).expect(401);
    }
    for (const path of [
      `${adminBase}/products`,
      `${adminBase}/requests`,
      `${adminBase}/requests/stats`,
    ]) {
      await api('get', path).expect(403);
    }
    await api('post', `${adminBase}/products`).send({}).expect(403);
    await api('patch', `${adminBase}/requests/${randomUUID()}/status`)
      .send({})
      .expect(403);
    await api('get', `${productBase}?ownerId=${other.id}`).expect(400);
    await api('get', `${requestsBase}?ownerId=${other.id}`).expect(400);
    for (const query of [
      'page=0',
      'page=1.2',
      'pageSize=101',
      'coverage=bad',
    ]) {
      await api('get', `${productBase}?${query}`).expect(400);
    }
    await api('get', `${productBase}/not-a-uuid`).expect(400);
    await api('get', `${requestsBase}/not-a-uuid`).expect(400);
    console.log('PASS: actual JWT/role guards, pagination and DTO validation');

    const createCatalogProduct = async (name, warrantyMonths) =>
      body(
        api('post', '/products', adminToken)
          .send({
            name,
            price: '1000000',
            categoryId: category.id,
            warrantyMonths,
          })
          .expect(201),
      );
    const product = await createCatalogProduct('GPU 100% Test', 36);
    const unknownProduct = await createCatalogProduct('Unknown warranty', null);
    const noCoverageProduct = await createCatalogProduct('No warranty', 0);
    for (const [item, quantity] of [
      [product, 2],
      [unknownProduct, 1],
      [noCoverageProduct, 1],
    ]) {
      await api('post', '/orders/cart/items')
        .send({ productId: item.id, quantity })
        .expect(201);
    }
    const cart = await body(api('get', '/orders/cart').expect(200));
    await database.query(
      `UPDATE orders SET "createdAt" = '2010-01-01' WHERE id = $1`,
      [cart.id],
    );
    const order = await body(
      api('post', '/orders/checkout').send({}).expect(201),
    );
    for (const status of ['Preparing', 'Shipping']) {
      await api('patch', `/admin/orders/${order.id}/status`, adminToken)
        .send({ status })
        .expect(200);
    }
    assert.equal(
      (await body(api('get', productBase).expect(200))).totalCount,
      0,
    );
    const doneResponses = await Promise.all(
      [1, 2].map(() =>
        api('patch', `/admin/orders/${order.id}/status`, adminToken).send({
          status: 'Done',
        }),
      ),
    );
    assert.deepEqual(
      doneResponses.map((response) => response.status).sort(),
      [200, 409],
    );
    const products = await body(api('get', productBase).expect(200));
    assert.equal(products.totalCount, 4);
    assert(products.items.every((unit) => unit.purchasedAt === today));
    assert(products.items.every((unit) => !('ownerId' in unit)));
    const units = products.items
      .filter((unit) => unit.catalogProductId === product.id)
      .sort((a, b) => a.unitNumber - b.unitNumber);
    const [unit, secondUnit] = units;
    const unknownUnit = products.items.find(
      (item) => item.catalogProductId === unknownProduct.id,
    );
    const noCoverageUnit = products.items.find(
      (item) => item.catalogProductId === noCoverageProduct.id,
    );
    assert.equal(unit.canRequest, true);
    assert.equal(unknownUnit.coverageStatus, 'unknown');
    assert.equal(noCoverageUnit.coverageStatus, 'not_covered');
    await api('patch', `/products/${product.id}`, adminToken)
      .send({ warrantyMonths: 1 })
      .expect(200);
    assert.equal(
      (await body(api('get', `${productBase}/${unit.id}`).expect(200)))
        .warrantyMonths,
      36,
    );
    assert.equal(
      (await body(api('get', productBase, otherToken).expect(200))).totalCount,
      0,
    );
    await api('get', `${productBase}/${unit.id}`, otherToken).expect(404);
    const serial = await body(
      api('patch', `${adminBase}/products/${unit.id}`, adminToken)
        .send({ serial: ' demo-gpu-001 ' })
        .expect(200),
    );
    assert.equal(serial.serial, 'DEMO-GPU-001');
    await api('patch', `${adminBase}/products/${secondUnit.id}`, adminToken)
      .send({ serial: 'demo-gpu-001' })
      .expect(409);
    assert.equal(
      (await body(api('get', `${productBase}?search=demo-gpu-001`).expect(200)))
        .totalCount,
      1,
    );
    assert.equal(
      (await body(api('get', `${productBase}?search=%25`).expect(200)))
        .totalCount,
      2,
    );
    assert.equal(
      (await body(api('get', `${productBase}?search=_`).expect(200)))
        .totalCount,
      0,
    );
    const paged = await body(
      api('get', `${productBase}?pageSize=1&page=2`).expect(200),
    );
    assert.equal(paged.items.length, 1);
    assert.equal(paged.totalCount, 4);
    assert.equal(
      (
        await body(
          api(
            'get',
            `${adminBase}/products?ownerId=${user.id}`,
            adminToken,
          ).expect(200),
        )
      ).totalCount,
      4,
    );
    console.log(
      'PASS: atomic delivery registration, quantity per unit, warranty snapshots, ownership, serials, literal searches and pagination',
    );

    const payload = {
      productId: unit.id,
      contactName: ' Owner ',
      phone: '090 000 0000',
      description: ' Display issue ',
    };
    for (const invalid of [
      { contactName: '   ' },
      { phone: '123' },
      { description: ' ' },
      { description: 'a'.repeat(2001) },
      { productId: null },
      { status: 'completed' },
      { userId: other.id },
      { orderCode: order.orderCode },
      { productId: product.id },
    ]) {
      await api('post', requestsBase)
        .send({ ...payload, ...invalid })
        .expect(invalid.productId === product.id ? 404 : 400);
    }
    await api('post', requestsBase, otherToken).send(payload).expect(404);
    for (const unavailable of [unknownUnit, noCoverageUnit]) {
      await api('post', requestsBase)
        .send({ ...payload, productId: unavailable.id })
        .expect(409);
    }
    const simultaneous = await Promise.all(
      [1, 2].map(() => api('post', requestsBase).send(payload)),
    );
    assert.deepEqual(
      simultaneous.map((response) => response.status).sort(),
      [201, 409],
    );
    const ticket = simultaneous.find(
      (response) => response.status === 201,
    ).body;
    assert.match(ticket.ticketCode, /^BH-[0-9a-f-]{36}$/);
    assert.equal(ticket.status, 'received');
    assert.equal(ticket.phone, '0900000000');
    assert.equal(ticket.contactName, 'Owner');
    assert.equal(ticket.description, 'Display issue');
    assert.equal(ticket.productId, unit.id);
    assert.equal(ticket.catalogProductId, product.id);
    assert.equal(ticket.timeline.length, 1);
    assert(!('ownerId' in ticket));
    await api('get', `${requestsBase}/${ticket.id}`, otherToken).expect(404);
    assert.equal(
      (await body(api('get', requestsBase, otherToken).expect(200))).totalCount,
      0,
    );
    const afterRequest = await body(
      api('get', `${productBase}/${unit.id}`).expect(200),
    );
    assert.equal(afterRequest.canRequest, false);
    assert.equal(afterRequest.activeRequestId, ticket.id);
    const found = await body(
      api(
        'get',
        `${requestsBase}?search=${ticket.ticketCode}&status=received&productId=${unit.id}`,
      ).expect(200),
    );
    assert.equal(found.totalCount, 1);
    await api('get', `${requestsBase}?status=RECEIVED`).expect(400);
    const adminTickets = await body(
      api('get', `${adminBase}/requests?ownerId=${user.id}`, adminToken).expect(
        200,
      ),
    );
    assert.equal(adminTickets.items[0].ownerId, user.id);
    assert(!('passwordHash' in adminTickets.items[0]));
    console.log(
      'PASS: request validation, ownership, concurrency duplicate prevention, stored timeline and FE field mapping',
    );

    const patch = (status, note = 'Customer-visible processing note') =>
      api(
        'patch',
        `${adminBase}/requests/${ticket.id}/status`,
        adminToken,
      ).send({ status, note });
    await patch('completed').expect(409);
    await patch('checking', '   ').expect(400);
    await patch('received', 'Additional information').expect(200);
    await patch('checking').expect(200);
    await patch('received').expect(409);
    const beforeInvalid = await row(
      `SELECT count(*)::int AS n FROM warranty_events WHERE "ticketId"=$1`,
      [ticket.id],
    );
    await patch('completed').expect(409);
    assert.deepEqual(
      await row(
        `SELECT count(*)::int AS n FROM warranty_events WHERE "ticketId"=$1`,
        [ticket.id],
      ),
      beforeInvalid,
    );
    await patch('repairing').expect(200);
    await patch('completed').expect(200);
    await patch('completed').expect(409);
    const completed = await body(
      api('get', `${requestsBase}/${ticket.id}`).expect(200),
    );
    assert.deepEqual(
      completed.timeline.map((event) => event.status),
      ['received', 'received', 'checking', 'repairing', 'completed'],
    );
    assert.equal(
      (await body(api('get', `${productBase}/${unit.id}`).expect(200)))
        .canRequest,
      true,
    );
    await api('post', requestsBase).send(payload).expect(201);
    const secondTicket = await body(
      api('post', requestsBase)
        .send({
          ...payload,
          productId: secondUnit.id,
          phone: '+84 900 000 000',
        })
        .expect(201),
    );
    assert.equal(secondTicket.phone, '+84900000000');
    await api('patch', `${adminBase}/products/${secondUnit.id}`, adminToken)
      .send({ serial: 'LATE-SERIAL' })
      .expect(200);
    assert.equal(
      (await body(api('get', `${requestsBase}/${secondTicket.id}`).expect(200)))
        .product.serial,
      'LATE-SERIAL',
    );
    await api('patch', `${adminBase}/products/${secondUnit.id}`, adminToken)
      .send({ serial: 'CHANGED' })
      .expect(409);
    await api('patch', `${adminBase}/products/${unit.id}`, adminToken)
      .send({ warrantyMonths: 120 })
      .expect(409);
    const stats = await body(
      api('get', `${adminBase}/requests/stats`, adminToken).expect(200),
    );
    assert.deepEqual(stats, {
      received: 2,
      checking: 1,
      repairing: 0,
      completed: 1,
      totalCount: 4,
    });
    const adminPage = await body(
      api('get', `${adminBase}/requests?pageSize=1&page=2`, adminToken).expect(
        200,
      ),
    );
    assert.equal(adminPage.items.length, 1);
    assert.equal(adminPage.totalCount, 4);
    console.log(
      'PASS: status rules, repeated notes, finalization, reopening via new request, late serial assignment and admin counters',
    );

    const register = (fields) =>
      api('post', `${adminBase}/products`, adminToken).send({
        orderItemId: legacyItem.id,
        unitNumber: 1,
        purchasedAt: '2020-01-31',
        warrantyMonths: 1,
        ...fields,
      });
    await register({ unitNumber: 5 }).expect(400);
    await register({ purchasedAt: '2026-02-30' }).expect(400);
    await register({ purchasedAt: '2999-01-01' }).expect(400);
    await register({ purchasedAt: '2026-10-01T00:00:00Z' }).expect(400);
    const expired = await body(register({}).expect(201));
    assert.equal(expired.expiresAt, '2020-02-29');
    assert.equal(expired.coverageStatus, 'expired');
    await register({}).expect(409);
    await api('post', requestsBase, legacyToken)
      .send({ ...payload, productId: expired.id })
      .expect(409);
    assert.equal(
      (
        await body(
          api('get', `${productBase}?coverage=expired`, legacyToken).expect(
            200,
          ),
        )
      ).totalCount,
      1,
    );
    await register({
      unitNumber: 2,
      purchasedAt: today,
      warrantyMonths: 0,
    }).expect(201);
    const unknown = await body(
      register({
        unitNumber: 3,
        purchasedAt: today,
        warrantyMonths: null,
      }).expect(201),
    );
    assert.equal(unknown.expiresAt, null);
    const corrected = await body(
      api('patch', `${adminBase}/products/${unknown.id}`, adminToken)
        .send({ warrantyMonths: 12 })
        .expect(200),
    );
    assert.equal(corrected.coverageStatus, 'active');
    await api('patch', `${adminBase}/products/${unknown.id}`, adminToken)
      .send({})
      .expect(400);
    await api('patch', `${adminBase}/products/${unknown.id}`, adminToken)
      .send({ purchasedAt: null })
      .expect(400);
    await api('patch', `${adminBase}/products/${unknown.id}`, adminToken)
      .send({ serial: '  ' })
      .expect(400);
    const legacyResult = await body(
      api('get', `${adminBase}/requests/${legacyTicket.id}`, adminToken).expect(
        200,
      ),
    );
    assert.equal(legacyResult.productId, null);
    assert.equal(legacyResult.timeline.length, 1);
    assert.equal(legacyResult.product.purchasedAt, null);
    console.log(
      'PASS: explicit historical registration, expiry, unknown coverage correction and legacy compatibility',
    );

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    for (const path of [
      productBase,
      requestsBase,
      `${adminBase}/products`,
      `${adminBase}/requests`,
      `${adminBase}/requests/stats`,
      `${adminBase}/requests/{id}/status`,
    ]) {
      assert(document.paths[`/api/v1${path}`], `Missing Swagger path: ${path}`);
    }
    assert.equal(
      document.components.schemas.CreateWarrantyRequestDto.properties.productId
        .format,
      'uuid',
    );
    console.log('PASS: Swagger routes and request schemas');
  } finally {
    try {
      if (app) await app.close();
      if (database?.isInitialized) await database.destroy();
    } finally {
      // This name was generated by this process and is never supplied by the user.
      if (
        created &&
        testDatabase !== originalDatabase &&
        /^be_study_warranty_test_[a-f0-9]{32}$/.test(testDatabase)
      ) {
        await connection.query(`DROP DATABASE "${testDatabase}"`);
      }
      process.env.DB_DATABASE = originalDatabase;
      await connection.end();
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
