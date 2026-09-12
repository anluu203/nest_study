# Computer Parts E-commerce API

Backend NestJS cho website bán linh kiện máy tính, sử dụng PostgreSQL và
TypeORM. Giỏ hàng được lưu dưới dạng một Order có trạng thái `AddingItem`.

## Khởi chạy

Yêu cầu Node.js 20+, npm 10+ và PostgreSQL.

```bash
npm install
copy .env.example .env
npm run migration:run
npm run start:dev
```

API sử dụng prefix `http://localhost:8080/api/v1`. Swagger UI có tại
`http://localhost:8080/api-docs`.

## Biến môi trường

Xem [.env.example](.env.example). `JWT_SECRET` phải được thay bằng một chuỗi bí
mật mạnh khi triển khai thật.

## Migration

```bash
npm run migration:show
npm run migration:run
npm run migration:revert
npm run migration:generate -- src/migrations/TenMigration
```

## Phân quyền admin

Tài khoản đăng ký qua API luôn có role `USER`. Trong phiên bản v1, cấp quyền
admin trực tiếp trong PostgreSQL:

```sql
UPDATE "user" SET "role" = 'ADMIN' WHERE "email" = 'admin@example.com';
```

Các API tạo, sửa, xóa catalog và cập nhật trạng thái đơn yêu cầu JWT của tài
khoản `ADMIN`.

## Luồng đơn hàng

```text
AddingItem -> Processing -> Preparing -> Shipping -> Done
     cart       checkout        admin        admin       admin
```

Không thể bỏ qua hoặc quay ngược trạng thái. Giá dùng đơn vị VND, lưu dưới dạng
`bigint` và được trả qua API dưới dạng chuỗi số.
