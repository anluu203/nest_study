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

Sau khi chạy migration, import bản dữ liệu catalog lấy từ database local
`study_db` ngày 28/10/2026 bằng lệnh:

```bash
npm run seed:catalog
```

Script đọc cấu hình `DB_*` từ `.env` tại thư mục gốc dự án; biến môi trường
đã thiết lập trong terminal được ưu tiên. Ví dụ database local:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<mat-khau-postgres-tren-may-dich>
DB_DATABASE=study_db
DB_SSL=false
```

Mặc định không dùng SSL. Nếu database đích yêu cầu SSL, đặt `DB_SSL=true`;
script dùng `DB_SSL_CA_FILE` nếu có, nếu không dùng `ca.pem` tại gốc dự án
(hoặc CA mặc định của Node.js khi không có file này).
Kiểm tra database đích được in ra khi chạy. Có thể kiểm tra trước mà không
lưu thay đổi bằng `npm run seed:catalog -- --dry-run`.

Dữ liệu nằm trong `scripts/data/catalog.json`, gồm 3 danh mục cha, 10 danh mục con
và 10 sản phẩm. Bản này giữ nguyên URL ảnh, `slug`, giá, trạng thái, các trường
SKU/thương hiệu/giảm giá/tồn kho/bảo hành/thông số, `images`, giá trị `null` và
thời gian tạo/cập nhật từ database nguồn. Hiện tại ảnh danh mục cha/con đều là
`null`; sản phẩm dùng URL ảnh HTTPS và `images` tương ứng trong database.

Trên database trống, script giữ UUID nguồn. Trên database đã seed trước đó,
script đối chiếu ID hoặc tên danh mục cha, tên danh mục con trong cùng cha,
SKU hoặc tên sản phẩm trong cùng danh mục; giữ ID và `createdAt` đã tồn tại,
ánh xạ lại quan hệ, rồi cập nhật các trường còn lại theo bản dữ liệu, kể cả
`updatedAt`. Bản ghi không đổi sẽ không bị ghi lại. Dữ liệu ngoài bản seed được
giữ lại. Nếu có nhiều bản ghi khớp cùng một đối tượng, script báo lỗi để xử lý
xung đột; mọi thay đổi nằm trong một transaction và được rollback khi có lỗi.

Khi chuyển sang máy khác, mang theo cả script và file JSON, cấu hình `.env`
của máy đích, chạy `npm run migration:run`, rồi `npm run seed:catalog`.
Đây là bản dữ liệu cố định, không tự đọc lại database nguồn khi chạy seed.

`npm run test:seed-catalog` kiểm tra import, chạy lại, cập nhật seed cũ và rollback
trên các bảng tạm sao chép cấu trúc từ database đã migration. Kiểm thử dùng cùng
cấu hình `DB_*`, không ghi vào các bảng catalog thật; bảng tạm được tự dọn khi
ngắt kết nối.

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

| Endpoint                         | Quyền     | Nơi lưu             |
| -------------------------------- | --------- | ------------------- |
| `POST /api/v1/images/avatars`    | Đăng nhập | `images/avatars`    |
| `POST /api/v1/images/products`   | ADMIN     | `images/products`   |
| `POST /api/v1/images/categories` | ADMIN     | `images/categories` |

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

## Bổ sung database theo thiết kế dự án

Migration `AddProjectDatabaseFields1792713600000` bổ sung dữ liệu theo thiết kế,
giữ nguyên toàn bộ cột cũ, ID, mật khẩu băm, giá, trạng thái và timestamp.
Chạy migration trước khi khởi động phiên bản backend mới; giữ `synchronize: false`.
Sao lưu bằng `pg_dump --format=custom` và kiểm tra phục hồi trên database riêng trước
khi áp dụng. Không lưu bản sao chứa dữ liệu người dùng vào Git. Migration này chủ động
từ chối `migration:revert` để tránh xóa dữ liệu đã bổ sung; khi cần sửa, dùng forward
migration hoặc khôi phục bản sao đã kiểm chứng trong thời gian bảo trì.

| Thành phần            | Đã bổ sung / quyết định tương thích                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| User                  | `fullName`, `phone`, `address` nullable; giữ `username`, `passwordHash`, role `USER/ADMIN`     |
| Category              | `slug` duy nhất, tự sinh từ tên và UUID nếu không truyền; không đổi slug khi đổi tên           |
| Product               | `sku`, `brand`, `discountPrice`, `stockQuantity`, `images`, `warrantyMonths`, `specifications` |
| Order                 | `orderCode`, thông tin người nhận và `paymentMethod` (`COD`, `VNPAY`)                          |
| OrderItem             | Giữ `unitPrice` thay cho tên `price` trong mẫu                                                 |
| Cart / CartItem       | Tiếp tục dùng `Order/OrderItem` với `AddingItem`, không tạo bảng riêng                         |
| Review                | Bảng `reviews`, rating nguyên 1–5 và liên kết User/Product                                     |
| WarrantyTicket        | Bảng `warranty_tickets`, mã `BH-<UUID>`, trạng thái `RECEIVED/CHECKING/REPAIRING/COMPLETED`    |
| ProductRecommendation | Bảng `product_recommendations`, dữ liệu tư vấn JSONB, liên kết Product tùy chọn                |

SKU được kiểm tra duy nhất khi có giá trị. Các thông tin cũ chưa biết (tồn kho,
bảo hành, thương hiệu, thông số, giao hàng, thanh toán) để `NULL`; không suy đoán
giá trị. `images` được backfill từ `imageUrl`; sau đó bộ sưu tập `images` và ảnh đại
diện `imageUrl` được cập nhật độc lập. Khi tạo sản phẩm không truyền `images`, backend
dùng `[imageUrl]` hoặc `[]`. `discountPrice` không âm, không vượt giá gốc; tồn kho và
số tháng bảo hành là số nguyên không âm. Thêm các field này chưa thay đổi cách tính
giá hoặc trừ tồn kho khi checkout.

Mã đơn hàng `DH-<UUID>` được sinh cho cả đơn cũ và giỏ hàng. Tổng tiền tiếp tục
dùng `totalPrice`, trạng thái đơn tiếp tục dùng bộ hiện tại. Checkout không body
vẫn hoạt động; có thể gửi thông tin giao hàng và phương thức thanh toán tùy chọn.
`VNPAY` chỉ là giá trị được lưu, chưa có tích hợp giao dịch thanh toán.

`reviews` và `product_recommendations` mới có entity, khóa ngoại, index và ràng buộc;
chưa có API nghiệp vụ. Bảo hành đã có API user/admin, xem phần bên dưới.
`warranty_tickets.productId` bắt buộc; `userId`, `orderCode`, `serialNumber` tùy chọn.
Nếu có `orderCode`, mã phải tồn tại trong `orders`. Các liên kết mới dùng `RESTRICT`
để tránh xóa dây chuyền. `targetUses` là mảng `OFFICE/GAMING/DESIGN`; `keySpecs` và
`reasoningMap` là object JSONB, `productId` có thể `NULL`.

### API bảo hành sản phẩm

Xem [WARRANTY_API_HANDOFF.md](./WARRANTY_API_HANDOFF.md) cho tài liệu tích hợp FE.
API gồm tra cứu thiết bị của user, gửi yêu cầu, lịch sử, quản lý trạng thái,
bộ đếm và đăng ký/hiệu chỉnh thiết bị của admin.

Chạy `npm run migration:run` để áp dụng `AddWarrantyWorkflow1793145600000` trước
khi chạy API mới. Khi đơn chuyển `Done`, backend tạo hồ sơ cho từng thiết bị và
chụp chính sách bảo hành tại thời điểm bàn giao. Đơn Done cũ cần admin xác minh
ngày bắt đầu và đăng ký hồ sơ; không suy đoán từ ngày tạo giỏ.

`npm run test:warranties` chạy kiểm thử HTTP/PostgreSQL với database tạm tự tạo
và tự dọn; cần quyền CREATE DATABASE. `npm test -- --runInBand` có kiểm thử lịch
tháng, năm nhuận, biên ngày hết hạn và múi giờ Việt Nam.

### Kiểm thử database riêng

Tạo database thử nghiệm có tên bắt đầu bằng `be_study_alignment_test_`, để trống
hoặc phục hồi bản sao trước migration mới, rồi chạy:

```powershell
$env:TEST_DB_DATABASE='be_study_alignment_test_local'
npm run test:database
```

Script từ chối database đang cấu hình trong `DB_DATABASE`, kiểm tra bảo toàn từng
cột cũ, migration, schema/entity và các API thật. Script có ghi fixture trong database
thử nghiệm và yêu cầu trạng thái trước migration mới ở mỗi lần chạy. Dùng database
thử nghiệm riêng; không trỏ `DB_DATABASE` của ứng dụng vào database thử nghiệm khi
gọi script này.

## Luồng đơn hàng (giữ nguyên)

```text
AddingItem -> Processing -> Preparing -> Shipping -> Done
     cart       checkout        admin        admin       admin
```

Không thể bỏ qua hoặc quay ngược trạng thái. Giá dùng đơn vị VND, lưu dưới dạng
`bigint` và được trả qua API dưới dạng chuỗi số.
