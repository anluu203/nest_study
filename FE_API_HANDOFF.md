# Tài liệu bàn giao API cho Frontend

Tài liệu này mô tả **API đang có trong mã nguồn**. Các đường dẫn bên dưới đã bao gồm prefix `/api/v1`. Mặc định local: `http://localhost:8080/api/v1`; Swagger UI: `http://localhost:8080/api-docs`.

## Quy ước chung

- Gửi body JSON với `Content-Type: application/json`. API cần đăng nhập dùng `Authorization: Bearer <accessToken>`; không dùng cookie/session. `USER` và `ADMIN` là hai role hiện có. Đăng ký luôn tạo `USER`.
- Trừ route ghi **Public**, mọi route cần JWT. Route ghi **ADMIN** cần thêm role `ADMIN`. Token hết hạn hoặc không hợp lệ trả `401`; thiếu quyền trả `403`.
- Các ID (`user`, `product`, `category`, `order`, `item`, `store`) là **UUID string**. Tham số path không đúng UUID trả `400`.
- Giá tính bằng VND và là **chuỗi số nguyên** trong JSON (`price`, `unitPrice`, `totalPrice`) vì DB dùng `bigint`. FE nên giữ dạng string khi trao đổi với API; không gửi số thập phân hoặc ký hiệu tiền tệ.
- Các DTO được kiểm tra bằng validation toàn cục: field lạ trả `400`. `PATCH` chỉ cần gửi field muốn đổi. Thời gian `createdAt`, `updatedAt` là chuỗi ngày giờ ISO khi serialize.
- Lỗi thường có dạng `{ "message": "...", "error": "Bad Request", "statusCode": 400 }`; lỗi validation có thể có `message` là mảng chuỗi. Các status thường gặp: `400` payload/trạng thái yêu cầu không hợp lệ, `401` xác thực, `403` phân quyền, `404` không tìm thấy, `409` xung đột. `POST` mặc định trả `201`; các `DELETE` được ghi `204` không có body.
- Upload ảnh dùng `multipart/form-data` (xem mục 8); các API tạo/sửa vẫn dùng JSON với `imageUrl`/`avatarUrl`. CORS local mặc định cho `http://localhost:5173` (có thể đổi qua `FRONTEND_URL`).
- `GET /api/v1` là route Public đơn giản, trả text `Hello World!`; không chứa dữ liệu nghiệp vụ.

## 1. Tài khoản

| Chức năng | Method | Endpoint | Quyền | Payload | Kết quả |
|---|---|---|---|---|---|
| Đăng ký | POST | `/api/v1/auth/register` | Public | `RegisterBody` | `AuthResponse` |
| Đăng nhập | POST | `/api/v1/auth/login` | Public | `LoginBody` | `AuthResponse` |
| Lấy tài khoản hiện tại | GET | `/api/v1/auth/me` | Đăng nhập | Không | `SafeUser` |
| Sửa tên hiển thị, avatar | PATCH | `/api/v1/users/me` | Đăng nhập | `UpdateUserBody` | `SafeUser` |

**RegisterBody**

```json
{ "username": "nguyenvana", "email": "admin@gmail.com", "password": "password123" }
```

`username`: 2–100 ký tự; `email`: email hợp lệ, tối đa 320 ký tự; `password`: 8–72 ký tự. Email được chuẩn hóa thành chữ thường. Email trùng trả `409`.

**LoginBody**

```json
{ "email": "admin@gmail.com", "password": "password123" }
```

Sai email hoặc mật khẩu trả `401`. Response của cả đăng ký và đăng nhập:

```json
{
  "accessToken": "<JWT>",
  "user": {
    "id": "<uuid>", "username": "nguyenvana", "email": "admin@gmail.com",
    "role": "USER", "avatarUrl": null, "createdAt": "<ISO date>", "updatedAt": "<ISO date>"
  }
}
```

`SafeUser` là object `user` ở trên, không có `passwordHash`. `UpdateUserBody`: `{ "username": "tenmoi", "avatarUrl": "<URL hoặc đường dẫn upload>" }`; chỉ gửi field muốn sửa. Tên 2–100 ký tự; `avatarUrl` nhận HTTP(S), đường dẫn từ upload hoặc `null` để bỏ avatar. Hiện chưa có API đổi email, mật khẩu, đăng xuất hoặc refresh token.

## 2. Danh mục cấp cha

| Chức năng | Method | Endpoint | Quyền | Payload / query | Kết quả |
|---|---|---|---|---|---|
| Danh sách | GET | `/api/v1/category-parents` | Public | Không | `CategoryParent[]` |
| Chi tiết | GET | `/api/v1/category-parents/:id` | Public | Không | `CategoryParent` |
| Tạo | POST | `/api/v1/category-parents` | ADMIN | `CategoryParentBody` | `CategoryParent` |
| Sửa | PATCH | `/api/v1/category-parents/:id` | ADMIN | Một phần `CategoryParentBody` | `CategoryParent` |
| Xóa | DELETE | `/api/v1/category-parents/:id` | ADMIN | Không | `204` |

**CategoryParentBody**

```json
{ "name": "Linh kiện máy tính", "description": "Nhóm linh kiện" }
```

`name` bắt buộc, 1–150 ký tự và duy nhất; `description`, `imageUrl` tùy chọn. Response gồm `id`, `name`, `description`, `imageUrl` (`string | null`), `createdAt`, `updatedAt`. Danh sách sắp theo tên tăng dần. Xóa danh mục cha đang chứa danh mục con trả `409`.

## 3. Danh mục con

| Chức năng | Method | Endpoint | Quyền | Payload / query | Kết quả |
|---|---|---|---|---|---|
| Danh sách, lọc theo cha | GET | `/api/v1/categories?parentId=<uuid>` | Public | `parentId` tùy chọn | `Category[]` |
| Chi tiết | GET | `/api/v1/categories/:id` | Public | Không | `Category` |
| Tạo | POST | `/api/v1/categories` | ADMIN | `CategoryBody` | `Category` |
| Sửa | PATCH | `/api/v1/categories/:id` | ADMIN | Một phần `CategoryBody` | `Category` |
| Xóa | DELETE | `/api/v1/categories/:id` | ADMIN | Không | `204` |

**CategoryBody**

```json
{ "name": "CPU", "description": "Bộ xử lý", "parentId": "<uuid danh mục cha>" }
```

`name` bắt buộc, 1–150 ký tự; `parentId` bắt buộc khi tạo và phải tồn tại; `description`, `imageUrl` tùy chọn. Response danh sách/chi tiết gồm `id`, `name`, `description`, `imageUrl` (`string | null`), `parentId`, `parent` (object danh mục cha), `createdAt`, `updatedAt`. Danh sách sắp theo tên tăng dần. Tên trùng trong cùng danh mục cha hoặc xóa danh mục đang có sản phẩm trả `409`.

## 4. Sản phẩm

| Chức năng | Method | Endpoint | Quyền | Payload / query | Kết quả |
|---|---|---|---|---|---|
| Danh sách, tìm kiếm, lọc | GET | `/api/v1/products` | Public | `page`, `pageSize`, `search`, `categoryId` | `Page<Product>` |
| Chi tiết | GET | `/api/v1/products/:id` | Public | Không | `Product` |
| Tạo | POST | `/api/v1/products` | ADMIN | `ProductBody` | `Product` |
| Sửa | PATCH | `/api/v1/products/:id` | ADMIN | Một phần `ProductBody` | `Product` |
| Ẩn sản phẩm | DELETE | `/api/v1/products/:id` | ADMIN | Không | `204` |

**ProductBody**

```json
{
  "name": "AMD Ryzen 7 7800X3D",
  "description": "CPU 8 nhân",
  "imageUrl": "https://example.com/product.jpg",
  "price": "8000000",
  "categoryId": "<uuid danh mục con>"
}
```

`name`: 1–200 ký tự; `price`: **string** số nguyên dương, tối đa 12 chữ số; `categoryId`: UUID của danh mục có thật. `description`, `imageUrl` tùy chọn; `imageUrl` nhận URL HTTP(S), đường dẫn trả về từ upload hoặc `null` để bỏ ảnh (tối đa 2048 ký tự). Query: `page` mặc định 1, `pageSize` mặc định 20 và tối đa 100, `search` tìm không phân biệt hoa thường trong tên/mô tả, `categoryId` lọc đúng danh mục con. Response danh sách:

```json
{
  "items": [{
    "id": "<uuid>", "name": "AMD Ryzen 7 7800X3D", "description": "CPU 8 nhân",
    "imageUrl": "https://example.com/product.jpg", "price": "8000000",
    "categoryId": "<uuid>", "isActive": true,
    "category": { "id": "<uuid>", "name": "CPU", "parentId": "<uuid>", "parent": { "id": "<uuid>", "name": "Linh kiện máy tính" } },
    "createdAt": "<ISO date>", "updatedAt": "<ISO date>"
  }],
  "totalCount": 1, "pageNumber": 1, "pageSize": 20, "totalPages": 1,
  "hasPreviousPage": false, "hasNextPage": false
}
```

Ví dụ `category`/`parent` ở trên lược bớt các field; object thực tế còn có `description`, `createdAt`, `updatedAt`. Sản phẩm bị ẩn (`isActive=false`) không xuất hiện ở GET danh sách/chi tiết; DELETE là **ẩn**, không xóa vật lý. Khi admin đổi giá, giá trong các giỏ hàng đang mở được cập nhật; đơn đã checkout giữ giá tại thời điểm checkout.

## 5. Giỏ hàng và đơn của người mua

Giỏ hàng là một order có `status="AddingItem"`. Mỗi tài khoản có tối đa một giỏ đang mở. Tất cả endpoint dưới đây cần JWT; backend lấy chủ sở hữu từ token, FE không gửi `userId`.

| Chức năng | Method | Endpoint | Payload | Kết quả |
|---|---|---|---|---|
| Xem giỏ | GET | `/api/v1/orders/cart` | Không | `Order` hoặc giỏ rỗng |
| Thêm sản phẩm | POST | `/api/v1/orders/cart/items` | `{ "productId": "<uuid>", "quantity": 2 }` | `Order` |
| Đổi số lượng | PATCH | `/api/v1/orders/cart/items/:itemId` | `{ "quantity": 3 }` | `Order` |
| Xóa một dòng | DELETE | `/api/v1/orders/cart/items/:itemId` | Không | `Order` |
| Xóa toàn bộ giỏ | DELETE | `/api/v1/orders/cart` | Không | `204` |
| Checkout | POST | `/api/v1/orders/checkout` | Không | `Order`, status `Processing` |
| Lịch sử đơn | GET | `/api/v1/orders` | Không | `Order[]` |
| Chi tiết đơn | GET | `/api/v1/orders/:id` | Không | `Order` |

`quantity` là số nguyên từ 1 đến 999. Thêm lại cùng sản phẩm sẽ tăng số lượng trên dòng cũ; tổng vượt 999 trả `400`. Các thao tác đổi/xóa một dòng cần dùng **`item.id`**, không dùng `productId`. Sau mỗi thao tác thêm/đổi/xóa dòng, API trả lại toàn bộ giỏ để FE cập nhật state.

Ví dụ giỏ/đơn có dữ liệu (object `product` còn có các field khác):

```json
{
  "id": "<uuid order>", "userId": "<uuid user>", "status": "AddingItem",
  "totalPrice": "16000000",
  "items": [{
    "id": "<uuid item>", "orderId": "<uuid order>", "productId": "<uuid product>",
    "quantity": 2, "unitPrice": "8000000",
    "product": { "id": "<uuid product>", "name": "AMD Ryzen 7 7800X3D", "price": "8000000", "isActive": true },
    "createdAt": "<ISO date>", "updatedAt": "<ISO date>"
  }],
  "createdAt": "<ISO date>", "updatedAt": "<ISO date>"
}
```

Nếu chưa có giỏ, `GET /orders/cart` trả **`200`** với `{ "id": null, "status": "AddingItem", "items": [], "totalPrice": "0" }`. Không có `userId` hay ngày giờ trong trường hợp này. Xóa một dòng cuối cùng trả giỏ còn tồn tại với `items: []`; xóa toàn bộ giỏ xóa order giỏ. Checkout giỏ rỗng trả `400`; không có giỏ trả `404`. Khi checkout, backend lấy lại giá sản phẩm và tính `totalPrice`; FE không gửi tổng tiền, địa chỉ, phương thức thanh toán. Lịch sử không bao gồm giỏ đang mở và sắp theo mới nhất; hiện không phân trang. Người dùng chỉ xem đơn của mình, đơn khác trả `404`.

## 6. Quản trị đơn hàng

| Chức năng | Method | Endpoint | Quyền | Payload / query | Kết quả |
|---|---|---|---|---|---|
| Danh sách đơn | GET | `/api/v1/admin/orders` | ADMIN | `page`, `pageSize`, `status` tùy chọn | `Page<Order>` |
| Chuyển trạng thái | PATCH | `/api/v1/admin/orders/:id/status` | ADMIN | `{ "status": "Preparing" }` | `Order` |

`page` mặc định 1; `pageSize` mặc định 20, tối đa 100. `status` có thể lọc `Processing`, `Preparing`, `Shipping`, `Done`; `AddingItem` trả `400` vì giỏ hàng không thuộc danh sách admin. `Page<Order>` có cùng các field phân trang như danh sách sản phẩm. Mỗi order ở danh sách admin có thêm object `user` (gồm `id`, `username`, `email`, `role`, `createdAt`, `updatedAt`) và `items[].product`.

Luồng trạng thái hợp lệ:

```text
AddingItem --checkout--> Processing --admin--> Preparing --admin--> Shipping --admin--> Done
```

Chỉ được đi đúng bước tiếp theo. Gửi lại trạng thái cũ, bỏ bước hoặc chuyển từ `Done` trả `409`.

## 7. Cửa hàng (module độc lập)

Module này hiện tồn tại trong backend nhưng không gắn với luồng sản phẩm/đơn hàng. **Tất cả** route dưới đây cần JWT; hiện không giới hạn role `ADMIN`.

| Chức năng | Method | Endpoint | Payload | Kết quả thực tế |
|---|---|---|---|---|
| Danh sách | GET | `/api/v1/stores` | Không | `Store[]` |
| Chi tiết | GET | `/api/v1/stores/:id` | Không | `Store` hoặc `null` nếu không thấy |
| Tạo | POST | `/api/v1/stores` | `StoreBody` | `Store` |
| Sửa | PATCH | `/api/v1/stores/:id` | Một phần `StoreBody` | TypeORM `UpdateResult` |
| Xóa | DELETE | `/api/v1/stores/:id` | Không | TypeORM `DeleteResult` |

**StoreBody**

```json
{
  "name": "Cửa hàng số 1", "description": "Mô tả",
  "address": "123 Nguyễn Trãi", "imageUrl": "https://example.com/store.jpg"
}
```

`name` phải là string không rỗng. Khi **tạo**, dù TypeScript đánh dấu ba field sau là tùy chọn, DTO hiện có `@IsString()` mà không có `@IsOptional()`; FE nên gửi cả `description`, `address`, `imageUrl` dưới dạng string. `PATCH` cho phép gửi một phần các field. Response `Store` gồm `id`, `name`, `description`, `address`, `imageUrl`, `createdAt`, `updatedAt`; không có bảo đảm `updatedAt` tự cập nhật. Với PATCH/DELETE, kiểm tra `affected` trong result nếu cần biết có bản ghi được sửa/xóa; route hiện không tự trả `404` khi ID không tồn tại.

## Gợi ý thứ tự tích hợp FE

1. Tải danh mục cha → danh mục con → danh sách/chi tiết sản phẩm (Public).
2. Đăng ký/đăng nhập, lưu `accessToken`, gọi `/auth/me` khi khôi phục phiên.
3. Thêm sản phẩm vào giỏ, dùng `item.id` để cập nhật/xóa, rồi checkout.
4. Hiển thị lịch sử và chi tiết đơn; trang admin dùng riêng các route `admin/orders`.

**Chưa có API** cho tồn kho, thanh toán, địa chỉ giao hàng, mã giảm giá, hủy đơn hoặc refresh token. Tài liệu `nestjs-ecommerce-modules.md` là bản thiết kế cũ, có endpoint dự kiến chưa được triển khai; khi tích hợp hãy dùng các endpoint trong tài liệu này và Swagger của server đang chạy.

## 8. Upload và thay đổi ảnh

| Chức năng | Method | Endpoint | Quyền |
|---|---|---|---|
| Upload avatar | POST | `/api/v1/images/avatars` | Đăng nhập |
| Upload ảnh sản phẩm | POST | `/api/v1/images/products` | ADMIN |
| Upload ảnh danh mục cha/con | POST | `/api/v1/images/categories` | ADMIN |

Body là `multipart/form-data` gồm **một file**, field tên `file`; không gửi thêm
field khác. JPEG, PNG, GIF, WebP tối đa **5 MB**; backend kiểm tra chữ ký nội dung
và MIME, không dựa vào tên file. Thiếu/sai file trả `400`, quá dung lượng trả `413`.
Thiếu JWT trả `401`, USER upload ảnh catalog trả `403`.

Response `201`:

```json
{
  "imageUrl": "/images/products/550e8400-e29b-41d4-a716-446655440000.png",
  "mimeType": "image/png",
  "size": 1024
}
```

`PUBLIC_BASE_URL` cấu hình trên backend sẽ thêm origin vào `imageUrl`; nếu chưa
cấu hình, FE hiển thị ảnh bằng `new URL(imageUrl, API_ORIGIN).href`.
Ví dụ `API_ORIGIN = "http://localhost:8080"`, không thêm `/api/v1`.
Ảnh tại `/images/...` là public, không cần token để hiển thị.

Luồng **chọn file từ máy**: upload → lấy `imageUrl` → gửi JSON để lưu bản ghi:

| Đích | API lưu ảnh | JSON |
|---|---|---|
| Avatar của mình | `PATCH /api/v1/users/me` | `{ "avatarUrl": "<imageUrl>" }` |
| Sản phẩm | `POST /api/v1/products` hoặc `PATCH /api/v1/products/:id` | Thêm `imageUrl` vào body |
| Danh mục con | `POST /api/v1/categories` hoặc `PATCH /api/v1/categories/:id` | Thêm `imageUrl` vào body |
| Danh mục cha | `POST /api/v1/category-parents` hoặc `PATCH /api/v1/category-parents/:id` | Thêm `imageUrl` vào body |

Luồng **nhập URL ảnh công khai từ hosting**: gửi trực tiếp URL HTTP(S) vào
`imageUrl` hoặc `avatarUrl` của API ở bảng trên. Backend lưu tham chiếu URL,
không tải bản sao về `images`; FE có thể preview URL trước khi lưu. URL tối đa
2048 ký tự. Gửi `null` để bỏ ảnh; không gửi field thì giữ ảnh hiện tại.

Ví dụ đổi avatar từ file trong trình duyệt:

```ts
const API_ORIGIN = 'http://localhost:8080';

async function changeAvatar(file: File, accessToken: string) {
  const form = new FormData();
  form.append('file', file);
  const headers = { Authorization: `Bearer ${accessToken}` };
  const upload = await fetch(`${API_ORIGIN}/api/v1/images/avatars`, {
    method: 'POST',
    headers, // Trình duyệt tự đặt Content-Type kèm multipart boundary.
    body: form,
  });
  if (!upload.ok) throw new Error(`Upload thất bại: ${upload.status}`);
  const { imageUrl } = await upload.json();
  const update = await fetch(`${API_ORIGIN}/api/v1/users/me`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarUrl: imageUrl }),
  });
  if (!update.ok) throw new Error(`Lưu avatar thất bại: ${update.status}`);
  return update.json(); // SafeUser với avatarUrl mới.
}
```

Upload không tự gắn ảnh vào bản ghi. File đã upload vẫn tồn tại nếu người dùng
hủy form, lưu bản ghi lỗi hoặc thay ảnh; chưa có API dọn/xóa file.
