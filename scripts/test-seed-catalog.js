const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { seedCatalog, databaseConfig } = require('./seed-catalog');
const catalog = require('./data/catalog.json');

const tables = [
  ['categoryParents', 'category_parents'],
  ['categories', 'categories'],
  ['products', 'products'],
];
const counts = Object.fromEntries(
  tables.map(([key]) => [key, catalog[key].length]),
);
const zero = { categoryParents: 0, categories: 0, products: 0 };

async function readCatalog(client, schema = 'pg_temp') {
  const result = {};
  for (const [key, table] of tables) {
    result[key] = (
      await client.query(
        `SELECT to_jsonb(t) AS record FROM ${schema}."${table}" t ORDER BY id`,
      )
    ).rows.map(({ record }) => record);
  }
  return result;
}

function records(snapshot) {
  return Object.fromEntries(
    tables.map(([key]) => [
      key,
      [...snapshot[key]].sort((a, b) => a.id.localeCompare(b.id)),
    ]),
  );
}

async function run() {
  assert.equal(databaseConfig({}).ssl, false);
  assert.equal(databaseConfig({ DB_SSL: 'false' }).ssl, false);
  assert.equal(databaseConfig({ DB_SSL: 'true' }).ssl.rejectUnauthorized, true);
  assert.throws(() => databaseConfig({ DB_SSL: 'invalid' }), /DB_SSL/);

  const client = new Client(databaseConfig());
  try {
    await client.connect();
    const sourceBefore = await readCatalog(client, 'public');

    // All writes use connection-local temporary copies of the actual schema.
    // PostgreSQL drops these automatically on disconnect; public is never seeded.
    for (const [, table] of tables) {
      await client.query(
        `CREATE TEMP TABLE "${table}" (LIKE public."${table}" INCLUDING ALL)`,
      );
    }
    await client.query(`ALTER TABLE pg_temp.categories ADD FOREIGN KEY ("parentId")
      REFERENCES pg_temp.category_parents(id) ON DELETE RESTRICT`);
    await client.query(`ALTER TABLE pg_temp.products ADD FOREIGN KEY ("categoryId")
      REFERENCES pg_temp.categories(id) ON DELETE RESTRICT`);

    const preview = await seedCatalog(client, { dryRun: true });
    assert.deepEqual(preview.changed, counts);
    assert.deepEqual(preview.totals, counts);
    assert.deepEqual(await readCatalog(client), {
      categoryParents: [],
      categories: [],
      products: [],
    });

    assert.deepEqual((await seedCatalog(client)).changed, counts);
    assert.deepEqual(await readCatalog(client), records(catalog));
    assert.deepEqual((await seedCatalog(client)).changed, zero);
    assert.deepEqual(await readCatalog(client), records(catalog));
    console.log(
      'PASS: empty database, exact snapshot round trip, dry run and repeat seed',
    );

    await client.query(
      'TRUNCATE pg_temp.products, pg_temp.categories, pg_temp.category_parents',
    );
    const legacy = structuredClone(catalog);
    const ids = new Map();
    for (const [key] of tables) {
      for (const record of legacy[key]) {
        const id = randomUUID();
        ids.set(record.id, id);
        record.id = id;
        record.createdAt = '2020-01-01T00:00:00';
        record.updatedAt = '2020-01-01T00:00:00';
        record.imageUrl = '/images/old.png';
        record.description = 'Old description';
      }
    }
    for (const category of legacy.categories) {
      category.parentId = ids.get(category.parentId);
      category.slug = `legacy-${category.id}`;
    }
    for (const product of legacy.products) {
      product.categoryId = ids.get(product.categoryId);
      Object.assign(product, {
        price: '42',
        discountPrice: '1',
        images: ['/images/old.png'],
        isActive: false,
        sku: `legacy-${product.id}`,
        brand: 'Legacy',
        stockQuantity: 5,
        warrantyMonths: 6,
        specifications: { old: true },
      });
    }
    await seedCatalog(client, { snapshot: legacy });

    // Existing references must continue to point to the same product UUID.
    await client.query(`CREATE TEMP TABLE catalog_product_reference (
      "productId" uuid REFERENCES pg_temp.products(id) ON DELETE RESTRICT)`);
    await client.query(
      'INSERT INTO pg_temp.catalog_product_reference VALUES ($1)',
      [legacy.products[0].id],
    );
    await client.query(
      'INSERT INTO pg_temp.products (name, price, "categoryId") VALUES ($1, $2, $3)',
      ['Unrelated product', '100', legacy.categories[0].id],
    );
    const unrelated = (await readCatalog(client)).products.find(
      (p) => p.name === 'Unrelated product',
    );
    assert.deepEqual((await seedCatalog(client)).changed, counts);

    const expected = structuredClone(catalog);
    for (const [key] of tables) {
      for (const record of expected[key]) {
        record.id = ids.get(record.id);
        record.createdAt = '2020-01-01T00:00:00';
      }
    }
    for (const category of expected.categories)
      category.parentId = ids.get(category.parentId);
    for (const product of expected.products)
      product.categoryId = ids.get(product.categoryId);
    expected.products.push(unrelated);
    assert.deepEqual(await readCatalog(client), records(expected));
    assert.equal(
      (
        await client.query(
          'SELECT "productId" FROM pg_temp.catalog_product_reference',
        )
      ).rows[0].productId,
      legacy.products[0].id,
    );
    assert.deepEqual((await seedCatalog(client)).changed, zero);
    console.log(
      'PASS: legacy UUID remapping, stale image updates, null fields, existing references and unrelated data',
    );

    const beforeFailure = await readCatalog(client);
    const invalid = structuredClone(catalog);
    invalid.categoryParents[0].description = 'Must roll back';
    invalid.products.at(-1).categoryId = randomUUID();
    await assert.rejects(
      seedCatalog(client, { snapshot: invalid }),
      /Unknown categoryId/,
    );
    assert.deepEqual(await readCatalog(client), beforeFailure);

    const duplicate = catalog.products[0];
    await client.query(
      'INSERT INTO pg_temp.products (name, price, "categoryId") VALUES ($1, $2, $3)',
      [duplicate.name, duplicate.price, ids.get(duplicate.categoryId)],
    );
    const beforeConflict = await readCatalog(client);
    await assert.rejects(seedCatalog(client), /Ambiguous products identity/);
    assert.deepEqual(await readCatalog(client), beforeConflict);
    assert.deepEqual(await readCatalog(client, 'public'), sourceBefore);
    console.log(
      'PASS: transaction rollback, ambiguous identity rejection and unchanged source database',
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
