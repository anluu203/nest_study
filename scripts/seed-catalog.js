const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Client } = require('pg');
const catalog = require('./data/catalog.json');

require('dotenv').config({ path: resolve(__dirname, '../.env') });

const columns = {
  category_parents: [
    'id',
    'name',
    'description',
    'imageUrl',
    'createdAt',
    'updatedAt',
  ],
  categories: [
    'id',
    'name',
    'description',
    'imageUrl',
    'slug',
    'parentId',
    'createdAt',
    'updatedAt',
  ],
  products: [
    'id',
    'name',
    'description',
    'imageUrl',
    'price',
    'categoryId',
    'isActive',
    'sku',
    'brand',
    'discountPrice',
    'stockQuantity',
    'images',
    'warrantyMonths',
    'specifications',
    'createdAt',
    'updatedAt',
  ],
};

function databaseConfig(env = process.env) {
  let ssl = false;
  if (env.DB_SSL === 'true') {
    const caPath = env.DB_SSL_CA_FILE
      ? resolve(env.DB_SSL_CA_FILE)
      : resolve(__dirname, '../ca.pem');
    ssl = {
      rejectUnauthorized: true,
      ...(env.DB_SSL_CA_FILE || existsSync(caPath)
        ? { ca: readFileSync(caPath, 'utf8') }
        : {}),
    };
  } else if (env.DB_SSL && env.DB_SSL !== 'false') {
    throw new Error('DB_SSL must be true or false.');
  }

  return {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USERNAME || 'postgres',
    password: env.DB_PASSWORD || 'postgres',
    database: env.DB_DATABASE || 'study_db',
    ssl,
    connectionTimeoutMillis: 10000,
  };
}

async function upsert(
  client,
  table,
  record,
  identity,
  identityValues,
  usedIds,
) {
  const matches = await client.query(
    `SELECT id FROM "${table}" WHERE id = $1::uuid OR (${identity})`,
    [record.id, ...identityValues],
  );
  if (matches.rowCount > 1) {
    throw new Error(
      `Ambiguous ${table} identity for "${record.name}" (${record.id}). Resolve the conflicting records before seeding.`,
    );
  }

  // Older seeds generated UUIDs on each machine. Keep existing IDs so orders,
  // reviews and other references remain valid; remap the catalog relationships.
  const id = matches.rows[0]?.id || record.id;
  if (usedIds.has(id)) {
    throw new Error(`Multiple snapshot records match ${table} ID ${id}.`);
  }
  usedIds.add(id);

  const fields = columns[table];
  const values = fields.map((field) => {
    if (!Object.hasOwn(record, field)) {
      throw new Error(`Missing ${table}.${field} in the catalog snapshot.`);
    }
    if (field === 'id') return id;
    if (field === 'images' || field === 'specifications') {
      return record[field] === null ? null : JSON.stringify(record[field]);
    }
    return record[field];
  });
  const updates = fields.filter(
    (field) => !['id', 'createdAt'].includes(field),
  );
  const result = await client.query(
    `INSERT INTO "${table}" AS target (${fields.map((field) => `"${field}"`).join(', ')})
     VALUES (${fields.map((_, index) => `$${index + 1}`).join(', ')})
     ON CONFLICT (id) DO UPDATE SET
       ${updates.map((field) => `"${field}" = EXCLUDED."${field}"`).join(', ')}
     WHERE ROW(${updates.map((field) => `target."${field}"`).join(', ')})
       IS DISTINCT FROM ROW(${updates.map((field) => `EXCLUDED."${field}"`).join(', ')})`,
    values,
  );
  return { id, changed: result.rowCount };
}

async function seedCatalog(
  client,
  { snapshot = catalog, dryRun = false } = {},
) {
  if (snapshot.version !== 1) {
    throw new Error('Unsupported catalog snapshot version.');
  }
  const parentIds = new Map();
  const categoryIds = new Map();
  const changed = { categoryParents: 0, categories: 0, products: 0 };

  await client.query('BEGIN');
  try {
    // Serialize catalog writes while resolving legacy IDs and inserting rows.
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query(
      'LOCK TABLE category_parents, categories, products IN SHARE ROW EXCLUSIVE MODE',
    );
    const usedParents = new Set();
    for (const parent of snapshot.categoryParents) {
      const result = await upsert(
        client,
        'category_parents',
        parent,
        'name = $2',
        [parent.name],
        usedParents,
      );
      parentIds.set(parent.id, result.id);
      changed.categoryParents += result.changed;
    }

    const usedCategories = new Set();
    for (const category of snapshot.categories) {
      const parentId = parentIds.get(category.parentId);
      if (!parentId)
        throw new Error(`Unknown parentId for category ${category.id}.`);
      const result = await upsert(
        client,
        'categories',
        { ...category, parentId },
        '"parentId" = $2::uuid AND name = $3',
        [parentId, category.name],
        usedCategories,
      );
      categoryIds.set(category.id, result.id);
      changed.categories += result.changed;
    }

    const usedProducts = new Set();
    for (const product of snapshot.products) {
      const categoryId = categoryIds.get(product.categoryId);
      if (!categoryId)
        throw new Error(`Unknown categoryId for product ${product.id}.`);
      const result = await upsert(
        client,
        'products',
        { ...product, categoryId },
        '("categoryId" = $2::uuid AND name = $3) OR (sku IS NOT NULL AND sku = $4)',
        [categoryId, product.name, product.sku],
        usedProducts,
      );
      changed.products += result.changed;
    }

    const { rows } = await client.query(
      `SELECT
         (SELECT count(*)::int FROM category_parents) AS "categoryParents",
         (SELECT count(*)::int FROM categories) AS categories,
         (SELECT count(*)::int FROM products) AS products`,
    );
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return { changed, totals: rows[0], dryRun };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--dry-run')) {
    throw new Error('Usage: node scripts/seed-catalog.js [--dry-run]');
  }
  const client = new Client(databaseConfig());
  try {
    await client.connect();
    console.log('Seeding database:', {
      host: client.host,
      port: client.port,
      database: client.database,
    });
    const result = await seedCatalog(client, {
      dryRun: args.includes('--dry-run'),
    });
    console.log(
      result.dryRun ? 'Dry run completed (rolled back):' : 'Seed completed:',
      result,
    );
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { seedCatalog, databaseConfig };
