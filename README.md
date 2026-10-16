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

## Seed catalog

Sau khi chạy migration, import dữ liệu mẫu bằng lệnh:

```bash
npm run seed:catalog
```

Script đọc cấu hình `DB_*` từ `.env` tại thư mục gốc dự án và sử dụng
chứng chỉ SSL `ca.pem` giống backend. Kiểm tra database đích được in ra khi chạy.
Dữ liệu mẫu gồm 3 nhóm danh mục, 10 danh mục và 10 sản phẩm. Có thể chạy lại:
danh mục được cập nhật mô tả, sản phẩm đã tồn tại theo tên sẽ được bỏ qua.

## Phân quyền admin

Tài khoản đăng ký qua API luôn có role `USER`. Trong phiên bản v1, cấp quyền
admin trực tiếp trong PostgreSQL:

```sql
UPDATE "user" SET "role" = 'ADMIN' WHERE "email" = 'admin@example.com';
```

Các API tạo, sửa, xóa catalog và cập nhật trạng thái đơn yêu cầu JWT của tài
khoản `ADMIN`.

## Upload ảnh

Chạy `npm run migration:run` để bổ sung `user.avatarUrl`, `categories.imageUrl`
và `category_parents.imageUrl`. Cấu hình `IMAGES_DIRECTORY=images` lưu file tại
thư mục `images` ở gốc dự án; ảnh được phục vụ công khai tại `/images/...`,
không nằm dưới prefix `/api/v1`. Thư mục được tạo tự động khi upload.

| Endpoint | Quyền | Nơi lưu |
|---|---|---|
| `POST /api/v1/images/avatars` | Đăng nhập | `images/avatars` |
| `POST /api/v1/images/products` | ADMIN | `images/products` |
| `POST /api/v1/images/categories` | ADMIN | `images/categories` |

Gửi `multipart/form-data` với đúng một field `file`. Hỗ trợ JPEG, PNG, GIF,
WebP, tối đa 5 MB; kiểm tra chữ ký file và MIME, đặt tên UUID. Response:
`{ "imageUrl": "/images/products/<uuid>.png", "mimeType": "image/png", "size": 1024 }`.
Nếu cấu hình `PUBLIC_BASE_URL` (ví dụ `https://api.example.com`), `imageUrl`
trả về URL tuyệt đối theo origin đó.

Sau khi upload, gửi `imageUrl` vào API tạo/sửa sản phẩm hoặc danh mục;
avatar dùng `PATCH /api/v1/users/me` với `{ "avatarUrl": "<imageUrl>" }`.
FE cũng có thể gửi trực tiếp URL ảnh HTTP(S) từ hosting vào các trường này;
backend lưu URL tham chiếu, không tải bản sao từ hosting. Gửi `null` để bỏ ảnh.
Upload chỉ lưu file, không tự gắn file vào bản ghi; file cũ vẫn được giữ khi đổi ảnh.

`ImageStorage` là contract lưu trữ, hiện sử dụng `LocalImageStorage`. Khi tích hợp
cloud, thêm adapter và đổi provider trong `ImagesModule`. Khi deploy với local
storage, gắn persistent volume vào `IMAGES_DIRECTORY` để giữ ảnh qua các lần deploy.
Xem [ví dụ tích hợp FE](FE_API_HANDOFF.md#8-upload-và-thay-đổi-ảnh).

## Luồng đơn hàng

```text
AddingItem -> Processing -> Preparing -> Shipping -> Done
     cart       checkout        admin        admin       admin
```

Không thể bỏ qua hoặc quay ngược trạng thái. Giá dùng đơn vị VND, lưu dưới dạng
`bigint` và được trả qua API dưới dạng chuỗi số.
