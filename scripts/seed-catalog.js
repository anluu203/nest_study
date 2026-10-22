const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');

require('dotenv').config({ path: resolve(__dirname, '../.env') });

const categoryParents = [
  {
    name: 'Linh kiện máy tính',
    description: 'Các linh kiện dùng để lắp ráp và nâng cấp máy tính.',
  },
  {
    name: 'Thiết bị ngoại vi',
    description: 'Thiết bị kết nối ngoài phục vụ thao tác và hiển thị.',
  },
  {
    name: 'Lưu trữ & Phụ kiện',
    description: 'Thiết bị lưu trữ và phụ kiện hỗ trợ hệ thống máy tính.',
  },
];

const categories = [
  [
    'CPU - Bộ vi xử lý',
    'Linh kiện máy tính',
    'Bộ xử lý trung tâm dành cho máy tính để bàn.',
  ],
  [
    'Mainboard - Bo mạch chủ',
    'Linh kiện máy tính',
    'Bo mạch chủ kết nối và điều khiển các linh kiện.',
  ],
  [
    'RAM - Bộ nhớ trong',
    'Linh kiện máy tính',
    'Bộ nhớ RAM cho máy tính để bàn và máy trạm.',
  ],
  [
    'VGA - Card màn hình',
    'Linh kiện máy tính',
    'Card đồ họa phục vụ chơi game và công việc sáng tạo.',
  ],
  [
    'Nguồn máy tính',
    'Linh kiện máy tính',
    'Bộ nguồn cung cấp điện ổn định cho toàn hệ thống.',
  ],
  ['Tản nhiệt', 'Linh kiện máy tính', 'Giải pháp làm mát CPU và thùng máy.'],
  [
    'Màn hình',
    'Thiết bị ngoại vi',
    'Màn hình máy tính phục vụ học tập, làm việc và giải trí.',
  ],
  ['Bàn phím', 'Thiết bị ngoại vi', 'Bàn phím cơ và bàn phím văn phòng.'],
  ['Chuột', 'Thiết bị ngoại vi', 'Chuột máy tính có dây và không dây.'],
  [
    'Ổ cứng SSD',
    'Lưu trữ & Phụ kiện',
    'Ổ cứng thể rắn tốc độ cao chuẩn SATA và NVMe.',
  ],
];

const products = [
  [
    'Intel Core i5-14600K',
    'CPU - Bộ vi xử lý',
    'CPU Intel Core i5 thế hệ 14, 14 nhân 20 luồng, phù hợp gaming và làm việc.',
    '/images/products/intel-core-i5-14600k.webp',
    7990000,
  ],
  [
    'AMD Ryzen 7 7800X3D',
    'CPU - Bộ vi xử lý',
    'CPU 8 nhân 16 luồng với 3D V-Cache, tối ưu cho máy tính chơi game.',
    '/images/products/amd-ryzen-7-7800x3d.webp',
    9990000,
  ],
  [
    'ASUS TUF Gaming B760M-PLUS WiFi',
    'Mainboard - Bo mạch chủ',
    'Mainboard Micro-ATX chipset B760, hỗ trợ DDR5 và Wi-Fi.',
    '/images/products/asus-tuf-b760m-plus-wifi.webp',
    4590000,
  ],
  [
    'Kingston Fury Beast 32GB DDR5 6000MHz',
    'RAM - Bộ nhớ trong',
    'Bộ RAM DDR5 gồm 2 thanh 16GB, tốc độ 6000MHz.',
    '/images/products/kingston-fury-beast-32gb.webp',
    2890000,
  ],
  [
    'Gigabyte GeForce RTX 4070 SUPER WINDFORCE OC',
    'VGA - Card màn hình',
    'Card đồ họa 12GB GDDR6X, phù hợp chơi game độ phân giải 2K.',
    '/images/products/gigabyte-rtx-4070-super.webp',
    17990000,
  ],
  [
    'Corsair RM750e 750W 80 Plus Gold',
    'Nguồn máy tính',
    'Nguồn máy tính công suất 750W, chuẩn hiệu suất 80 Plus Gold.',
    '/images/products/corsair-rm750e.webp',
    2790000,
  ],
  [
    'DeepCool AK620 Digital',
    'Tản nhiệt',
    'Tản nhiệt khí hai tháp, tích hợp màn hình hiển thị nhiệt độ.',
    '/images/products/deepcool-ak620-digital.webp',
    1890000,
  ],
  [
    'LG UltraGear 27GP850-B 27 inch',
    'Màn hình',
    'Màn hình gaming Nano IPS 2K, tần số quét 180Hz.',
    '/images/products/lg-27gp850-b.webp',
    7490000,
  ],
  [
    'Keychron K8 Pro',
    'Bàn phím',
    'Bàn phím cơ không dây layout TKL, hỗ trợ hot-swap.',
    '/images/products/keychron-k8-pro.webp',
    2490000,
  ],
  [
    'Samsung 990 PRO 1TB NVMe',
    'Ổ cứng SSD',
    'SSD NVMe PCIe 4.0 dung lượng 1TB, tốc độ đọc lên đến 7450MB/s.',
    '/images/products/samsung-990-pro-1tb.webp',
    2990000,
  ],
];

async function seedCatalog() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'study_db',
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync(resolve(__dirname, '../ca.pem'), 'utf8'),
    },
    connectionTimeoutMillis: 10000,
  });
  let transactionStarted = false;

  try {
    await client.connect();
    console.log('Seeding database:', {
      host: client.host,
      port: client.port,
      database: client.database,
    });
    await client.query('BEGIN');
    transactionStarted = true;

    for (const parent of categoryParents) {
      await client.query(
        `INSERT INTO category_parents (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name)
         DO UPDATE SET description = EXCLUDED.description, "updatedAt" = now()`,
        [parent.name, parent.description],
      );
    }

    for (const [name, parentName, description] of categories) {
      const categoryId = randomUUID();
      const slugBase =
        name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'category';
      await client.query(
        `INSERT INTO categories (name, description, "parentId", id, slug)
         SELECT $1, $2, id, $4::uuid, $5
         FROM category_parents
         WHERE name = $3
         ON CONFLICT ("parentId", name)
         DO UPDATE SET description = EXCLUDED.description, "updatedAt" = now()`,
        [
          name,
          description,
          parentName,
          categoryId,
          `${slugBase}-${categoryId}`,
        ],
      );
    }

    for (const [name, categoryName, description, imageUrl, price] of products) {
      await client.query(
        `INSERT INTO products (name, description, "imageUrl", price, "categoryId", "isActive")
         SELECT $1::varchar, $2::text, $3::varchar, $4::bigint, c.id, true
         FROM categories c
         WHERE c.name = $5::varchar
           AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = $1::varchar)`,
        [name, description, imageUrl, price, categoryName],
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;

    const result = await client.query(
      `SELECT
         (SELECT count(*)::int FROM category_parents) AS "categoryParents",
         (SELECT count(*)::int FROM categories) AS categories,
         (SELECT count(*)::int FROM products) AS products`,
    );

    console.log('Seed completed:', result.rows[0]);

    const catalog = await client.query(
      `SELECT cp.name AS "parent", c.name AS category, count(p.id)::int AS products
       FROM category_parents cp
       LEFT JOIN categories c ON c."parentId" = cp.id
       LEFT JOIN products p ON p."categoryId" = c.id
       GROUP BY cp.name, c.name
       ORDER BY cp.name, c.name`,
    );

    console.table(catalog.rows);
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    await client.end();
  }
}

seedCatalog().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
});
