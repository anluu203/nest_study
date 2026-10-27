# Tích hợp chức năng bảo hành cho Frontend

Tài liệu cho trang `app/client/warranty/page.tsx`, `app/admin/warranty/page.tsx`
và phần bảo hành trong `lib/services/customer-services.ts` của FE.
Luồng dựa trên `lib/data/customer-services.json`; API dùng dữ liệu thật trong PostgreSQL.

## 1. Kết nối và xác thực

- Base URL local: `http://localhost:8080/api/v1`.
- Swagger: `http://localhost:8080/api-docs`.
- Tất cả endpoint dưới đây cần `Authorization: Bearer <accessToken>`.
- Body dùng JSON, `Content-Type: application/json`.
- `/warranties/*`: tài khoản đăng nhập chỉ đọc/gửi yêu cầu cho thiết bị của chính mình.
  Admin gọi các route này cũng chỉ thao tác dữ liệu của tài khoản admin đó.
- `/admin/warranties/*`: cần role `ADMIN`, truy cập dữ liệu của mọi tài khoản.
- User không truyền `userId`/`ownerId` để chọn tài khoản; backend lấy chủ sở hữu từ JWT.
- Ngày `purchasedAt`, `expiresAt`: `YYYY-MM-DD`; thời gian phiếu/timeline: ISO datetime.
- Không có tra cứu công khai theo số điện thoại hoặc serial của người khác.

## 2. Nguồn dữ liệu và thời điểm phát sinh bảo hành

```text
User checkout → Processing → Preparing → Shipping
Admin chuyển đơn sang Done
  → tự tạo hồ sơ bảo hành cho từng thiết bị trong đơn
User xem hồ sơ, tra cứu và gửi yêu cầu
  → received → checking → repairing → completed
```

Khi `PATCH /admin/orders/:id/status` với `{ "status": "Done" }` thành công:

1. Mỗi `OrderItem.quantity` tạo số lượng hồ sơ tương ứng. Mua hai GPU cùng loại
   thì có hai hồ sơ, với `unitNumber = 1` và `2`, có ID/serial/phiếu độc lập.
2. `purchasedAt` được lấy là **ngày bàn giao/chuyển Done theo giờ Việt Nam**.
   FE nên hiển thị "Ngày nhận hàng / bắt đầu bảo hành". Đây là quy ước triển khai,
   không lấy ngày tạo giỏ hàng làm ngày mua.
3. `warrantyMonths` được chụp từ sản phẩm tại thời điểm chuyển Done.
   Thay đổi chính sách trong catalog về sau không đổi hồ sơ đã tạo.
4. `expiresAt` = ngày bắt đầu cộng số tháng theo lịch. Ngày cuối tháng được giới hạn
   vào ngày cuối tháng đích: `2024-02-29 + 12 tháng = 2025-02-28`.
5. `serial` ban đầu là `null`; admin nhập serial thực tế bằng API cập nhật hồ sơ.
   Serial không phải điều kiện bắt buộc để gửi yêu cầu.
6. Chuyển Done và tạo hồ sơ nằm trong cùng transaction: lỗi tạo hồ sơ sẽ rollback
   trạng thái đơn. Hai thao tác chuyển Done đồng thời không tạo hồ sơ trùng.

Đơn chưa Done chưa xuất hiện trong danh sách sản phẩm bảo hành.
Đơn đã Done **trước khi triển khai API** không tự được gán ngày mua/hạn bảo hành.
Admin đăng ký hồ sơ bằng ngày và chính sách đã xác minh, xem mục 7.

## 3. Các ID và mapping từ mock

| FE mock                                  | API / database thật                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `warrantyProducts[].id`                  | UUID của hồ sơ `warranty_products`, đại diện một thiết bị đã mua               |
| `WarrantyRequestInput.productId`         | ID hồ sơ ở trên, **không phải** ID catalog `products`                          |
| `warrantyRequests[].id` dùng mã `BH-...` | `id` là UUID để gọi API; `ticketCode` là mã `BH-<UUID>` để hiển thị/tìm kiếm   |
| `request.productId`                      | ID hồ sơ thiết bị; nối với `WarrantyProduct.id`                                |
| `catalogProductId`                       | ID sản phẩm catalog; chỉ dùng khi cần link đến trang sản phẩm                  |
| `phone`                                  | Lưu vào `WarrantyTicket.contactPhone`                                          |
| `description`                            | Lưu vào `WarrantyTicket.issueDescription`                                      |
| `serial`                                 | Lưu ở hồ sơ thiết bị; sao chép vào `WarrantyTicket.serialNumber` khi tạo phiếu |
| `status` chữ thường                      | API dùng `received/checking/repairing/completed`; DB vẫn dùng enum chữ hoa     |
| `timeline[].date`                        | Thời điểm lưu sự kiện vào `warranty_events`                                    |
| `ownerId`                                | Chỉ response admin có field này; không lấy từ localStorage                     |

Không gửi ID demo như `warranty-gpu`, `BH-MAU-001` cho API. Không tự tạo ID,
mã phiếu, trạng thái ban đầu, serial hoặc lịch sử ở FE.

## 4. Endpoint tổng hợp

Các path trong bảng đã gồm prefix `/api/v1`.

| Method | Endpoint                                       | Quyền     | Kết quả                                    |
| ------ | ---------------------------------------------- | --------- | ------------------------------------------ |
| GET    | `/api/v1/warranties/products`                  | Đăng nhập | Phân trang thiết bị của mình               |
| GET    | `/api/v1/warranties/products/:id`              | Đăng nhập | Chi tiết một thiết bị của mình             |
| GET    | `/api/v1/warranties/requests`                  | Đăng nhập | Phân trang phiếu của mình, có timeline     |
| GET    | `/api/v1/warranties/requests/:id`              | Đăng nhập | Chi tiết phiếu của mình                    |
| POST   | `/api/v1/warranties/requests`                  | Đăng nhập | Tạo phiếu, trả `201` và phiếu mới          |
| GET    | `/api/v1/admin/warranties/products`            | ADMIN     | Phân trang thiết bị mọi tài khoản          |
| GET    | `/api/v1/admin/warranties/products/:id`        | ADMIN     | Chi tiết thiết bị                          |
| POST   | `/api/v1/admin/warranties/products`            | ADMIN     | Đăng ký thiết bị từ đơn Done cũ, trả `201` |
| PATCH  | `/api/v1/admin/warranties/products/:id`        | ADMIN     | Bổ sung serial/hiệu chỉnh hồ sơ, trả `200` |
| GET    | `/api/v1/admin/warranties/requests`            | ADMIN     | Phân trang mọi phiếu                       |
| GET    | `/api/v1/admin/warranties/requests/stats`      | ADMIN     | Tổng số phiếu theo trạng thái              |
| GET    | `/api/v1/admin/warranties/requests/:id`        | ADMIN     | Chi tiết phiếu bất kỳ                      |
| PATCH  | `/api/v1/admin/warranties/requests/:id/status` | ADMIN     | Cập nhật trạng thái/ghi chú, trả phiếu mới |

Mọi `:id` là UUID, không phải `ticketCode`. Muốn tìm mã BH thì dùng query `search`.
Không có API xóa phiếu, sửa mô tả đã gửi, hủy phiếu hoặc user tự đổi trạng thái.
Admin tiếp nhận và xử lý phiếu do user gửi; chưa có tạo phiếu thay user.

## 5. Danh sách, tìm kiếm và phân trang

Tất cả endpoint danh sách nhận:

| Query      | Kiểu    | Mặc định / giới hạn                       |
| ---------- | ------- | ----------------------------------------- |
| `page`     | integer | `1`, tối thiểu `1`                        |
| `pageSize` | integer | `20`, từ `1` đến `100`                    |
| `search`   | string  | Tối đa 200 ký tự, bỏ khoảng trắng hai đầu |

Danh sách **thiết bị** nhận thêm `coverage`:
`all` (mặc định), `active`, `expired`, `unknown`, `not_covered`, `not_started`.
Tìm kiếm không phân biệt hoa thường theo tên sản phẩm, serial hoặc mã đơn.

Danh sách **phiếu** nhận thêm:

- `status`: `received`, `checking`, `repairing`, `completed`; bỏ query nếu muốn tất cả.
- `productId`: UUID hồ sơ thiết bị, để lấy các phiếu của một thiết bị.
- `search`: tìm theo mã BH, tên liên hệ, điện thoại, tên sản phẩm, serial, mã đơn, UUID chủ sở hữu.

Hai danh sách của **admin** nhận thêm `ownerId` để lọc theo UUID tài khoản.
User gửi `ownerId` bị `400`. Mỗi bộ lọc kết hợp theo điều kiện AND.
Ký tự `%` và `_` trong từ khóa được tìm như ký tự thường, không mở rộng wildcard.

Ví dụ:

```text
GET /api/v1/warranties/products?coverage=active&search=GPU&page=1&pageSize=20
GET /api/v1/warranties/requests?productId=<warranty-product-uuid>
GET /api/v1/warranties/requests?search=BH-<uuid>
GET /api/v1/admin/warranties/requests?status=repairing&ownerId=<user-uuid>
```

Response chung:

```ts
interface Page<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
```

Thiết bị sắp xếp ngày bắt đầu mới nhất trước, phiếu theo ngày tạo mới nhất trước;
có ID làm tiêu chí phụ ổn định. Không có dữ liệu trả `items: []`, `totalPages: 0`.
Không dùng số lượng `items` của một trang để làm tổng số toàn bộ dữ liệu.

## 6. Luồng user

### Dữ liệu response

```ts
type WarrantyStatus = 'received' | 'checking' | 'repairing' | 'completed';
type CoverageStatus =
  | 'active'
  | 'expired'
  | 'unknown'
  | 'not_covered'
  | 'not_started';

interface WarrantyProduct {
  id: string;
  catalogProductId: string;
  orderItemId: string;
  unitNumber: number;
  name: string;
  serial: string | null;
  orderCode: string;
  purchasedAt: string; // YYYY-MM-DD
  expiresAt: string | null;
  warrantyMonths: number | null;
  coverageStatus: CoverageStatus;
  canRequest: boolean;
  activeRequestId: string | null;
  ownerId?: string; // chỉ admin
}

interface WarrantyRequest {
  id: string; // UUID dùng trong URL
  ticketCode: string; // BH-... dùng hiển thị
  productId: string | null; // nullable chỉ cho phiếu cũ
  catalogProductId: string;
  contactName: string;
  phone: string;
  description: string;
  status: WarrantyStatus;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string | null;
    catalogProductId: string;
    name: string;
    serial: string | null;
    orderCode: string | null;
    purchasedAt: string | null;
    expiresAt: string | null;
    warrantyMonths: number | null;
  };
  timeline: { status: WarrantyStatus; date: string; note: string }[];
  ownerId?: string | null; // chỉ admin, có thể null đối với phiếu cũ
}
```

`coverageStatus` và `canRequest` do backend tính:

| Giá trị       | Ý nghĩa / hiển thị                                             |
| ------------- | -------------------------------------------------------------- |
| `active`      | Còn hạn đến hết `expiresAt` theo ngày Việt Nam                 |
| `expired`     | Đã qua ngày hết hạn                                            |
| `unknown`     | Chưa có số tháng/ngày hết hạn; hiển thị "Chưa xác định"        |
| `not_covered` | Số tháng bằng `0`; hiển thị "Không có bảo hành"                |
| `not_started` | Chưa tới ngày bắt đầu; chủ yếu dự phòng dữ liệu nhập ngoài API |

Chỉ mở nút gửi khi `canRequest === true`. Một thiết bị còn hạn nhưng đang có phiếu
chưa completed sẽ có `canRequest: false`, `activeRequestId` trỏ tới phiếu đang xử lý.
Backend vẫn kiểm tra lại khi gửi; FE xử lý `409` nếu dữ liệu vừa thay đổi.
Không coi `unknown` hoặc `not_covered` là "hết hạn".

### Trình tự màn hình

1. Sau đăng nhập, gọi `GET /warranties/products` để hiển thị danh sách thiết bị.
2. Gọi `GET /warranties/requests` để hiển thị lịch sử; hoặc gọi theo `productId`
   khi người dùng mở chi tiết một thiết bị. Đọc đủ các trang khi cần toàn bộ lịch sử.
3. Tìm kiếm/lọc qua query server, đưa `page` về `1` khi đổi bộ lọc.
4. Hiển thị serial null là "Chưa cập nhật", ngày hết hạn null là "Chưa xác định".
5. Gửi form theo payload dưới đây, chờ `201` rồi hiển thị `ticketCode`.
6. Refresh danh sách thiết bị và phiếu sau khi gửi thành công để đồng bộ nút gửi.

### Gửi yêu cầu

```http
POST /api/v1/warranties/requests
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "productId": "<warranty-product-uuid>",
  "contactName": "Nguyễn Văn A",
  "phone": "0900000000",
  "description": "Màn hình xuất hiện sọc khi chạy ứng dụng đồ họa."
}
```

- `productId`: UUID thiết bị do API danh sách trả về.
- `contactName`: bắt buộc, trim, tối đa 200 ký tự.
- `phone`: `0` + 9 chữ số hoặc `+84` + 9 chữ số; server loại khoảng trắng, dấu chấm,
  dấu gạch nối trước khi kiểm tra. Ví dụ `090 000 0000` được lưu `0900000000`.
- `description`: bắt buộc, trim, tối đa 2000 ký tự.
- Không gửi `userId`, `orderCode`, `serial`, `status`, `ticketCode`, `timeline`.
  Field ngoài DTO bị `400`.

Thành công trả trực tiếp `WarrantyRequest`, không bọc `{ request, requests, warning }`
như service mock. Phiếu mới có `status: "received"` và một sự kiện tiếp nhận.
Backend tự lấy sản phẩm catalog, serial, đơn hàng và chủ sở hữu từ hồ sơ thiết bị.

Mỗi thiết bị chỉ có một phiếu chưa hoàn tất. Sau completed, user có thể gửi phiếu
mới nếu vẫn còn hạn; hoàn tất không tự gia hạn bảo hành. Hai submit đồng thời
được bảo vệ bằng transaction, khóa thiết bị và unique index: một `201`, một `409`.

## 7. Luồng admin

### Danh sách và bộ đếm

- Gọi `GET /admin/warranties/requests` để lấy danh sách có bộ lọc/phân trang.
- Gọi `GET /admin/warranties/requests/stats` cho bốn ô tổng số trạng thái:

```json
{
  "received": 8,
  "checking": 3,
  "repairing": 2,
  "completed": 12,
  "totalCount": 25
}
```

Đây là tổng toàn hệ thống, không theo bộ lọc danh sách. Endpoint stats không có query lọc.
Dùng `request.product` để hiện chi tiết sản phẩm ngay cả khi sản phẩm đó không nằm
trong trang danh sách thiết bị đã tải. Dùng `request.ticketCode` cho tên/mã phiếu.

### Cập nhật phiếu

```http
PATCH /api/v1/admin/warranties/requests/<ticket-uuid>/status
```

```json
{ "status": "checking", "note": "Kỹ thuật viên đang kiểm tra lỗi hiển thị." }
```

- `note` bắt buộc, trim, từ 1 đến 2000 ký tự, **hiển thị cho user** trong timeline.
- Chỉ giữ nguyên bước hiện tại hoặc tiến đúng một bước:
  `received → checking → repairing → completed`.
- Giữ nguyên trạng thái vẫn tạo thêm sự kiện, để bổ sung tiến độ.
- Không lùi bước, không nhảy bước. Phiếu completed không cập nhật tiếp, kể cả thêm ghi chú.
- Trạng thái hiện tại, ghi chú mới nhất (`techNotes`) và sự kiện mới được lưu cùng transaction.
- Response là `WarrantyRequest` đã cập nhật. Refresh danh sách và stats sau thành công.
- Timeline trả theo thứ tự sự kiện được ghi nhận, từ cũ đến mới; không tự dựng các bước còn thiếu.

### Đăng ký thiết bị cho đơn Done cũ

Lấy `orderItemId` từ `items[].id` của `GET /admin/orders`. Sau khi xác minh ngày
bàn giao và thời hạn thực tế, gọi:

```http
POST /api/v1/admin/warranties/products
```

```json
{
  "orderItemId": "<order-item-uuid>",
  "unitNumber": 1,
  "serial": "GPU-4060-002",
  "purchasedAt": "2026-06-15",
  "warrantyMonths": 36
}
```

- Đơn phải Done; `unitNumber` là integer từ `1` đến `OrderItem.quantity`.
- Mỗi cặp `(orderItemId, unitNumber)` chỉ được đăng ký một lần.
- `purchasedAt` bắt buộc, ngày hợp lệ định dạng `YYYY-MM-DD`, không ở tương lai.
- `warrantyMonths` là integer `0..1200`; bỏ hoặc null = chưa xác định,
  không tự lấy chính sách hiện tại để suy đoán cho đơn cũ.
- `serial` tùy chọn, trim và chuyển chữ hoa, tối đa 200 ký tự; null = chưa cập nhật.
  Serial khác null phải duy nhất trong các hồ sơ.
- Không truyền `productId`, `ownerId`, `orderCode`, `expiresAt`: backend tự xác định.
- Có thể đăng ký hồ sơ đã hết hạn để user tra cứu; gửi yêu cầu cho hồ sơ đó bị `409`.

### Bổ sung serial/hiệu chỉnh hồ sơ

```http
PATCH /api/v1/admin/warranties/products/<warranty-product-uuid>
```

```json
{ "serial": "GPU-4060-002", "purchasedAt": "2026-06-15", "warrantyMonths": 36 }
```

Chỉ gửi field muốn thay đổi; phải có ít nhất một field. Backend tính lại ngày hết hạn.
Quy tắc ngày/tháng/serial giống API đăng ký. `purchasedAt` không nhận null;
`warrantyMonths: null` chuyển về chưa xác định, `serial: null` bỏ serial khi được phép.

Khi chưa từng có phiếu, admin có thể hiệu chỉnh cả ba field. Khi đã có bất kỳ phiếu
nào, khóa ngày bắt đầu, số tháng và serial đã được gán để bảo toàn hồ sơ.
Nếu serial vẫn null, admin được bổ sung serial lần đầu; backend đồng thời bổ sung
serial cho các phiếu của thiết bị còn thiếu serial. Không đổi/xóa serial đó về sau.

## 8. Lỗi và cách FE xử lý

Response lỗi theo chuẩn Nest:

```json
{
  "statusCode": 409,
  "message": "Product already has an active warranty request",
  "error": "Conflict"
}
```

`message` có thể là mảng chuỗi với lỗi validation.

| HTTP | Tình huống                                                            | FE xử lý                              |
| ---- | --------------------------------------------------------------------- | ------------------------------------- |
| 400  | UUID, query, ngày, điện thoại, field lạ, form trống hoặc quá giới hạn | Hiển thị lỗi dữ liệu                  |
| 401  | Thiếu/hết hạn JWT                                                     | Yêu cầu đăng nhập lại                 |
| 403  | User gọi API admin                                                    | Hiển thị thiếu quyền                  |
| 404  | Không có thiết bị/phiếu; hoặc thuộc tài khoản khác                    | Hiển thị không tìm thấy               |
| 409  | Hết hạn/chưa xác định/không có bảo hành; phiếu đang xử lý             | Refresh dữ liệu, hiển thị lý do       |
| 409  | Nhảy/lùi trạng thái hoặc sửa phiếu completed                          | Refresh phiếu, chọn trạng thái hợp lệ |
| 409  | Serial/thiết bị trùng, sửa hồ sơ đã khóa, đăng ký đơn chưa Done       | Hiển thị xung đột cho admin           |

## 9. Thay service mock trong FE

| Service hiện tại                                                         | Thay bằng                                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `customerServices.getWarrantyProducts()`                                 | Async `GET /warranties/products`, đọc `items` và phân trang             |
| `customerServices.loadWarrantyRequests(userId)`                          | Async `GET /warranties/requests`; không truyền userId                   |
| `customerServices.createWarrantyRequest(userId, input)`                  | Async `POST /warranties/requests` với input, không gửi userId           |
| `adminCustomerServices.loadWarrantyRequests()`                           | Async `GET /admin/warranties/requests` + `/requests/stats`              |
| `adminCustomerServices.updateWarrantyRequest(ownerId, id, status, note)` | Async `PATCH /admin/warranties/requests/:id/status` với `{status,note}` |

- Các function trở thành async; form dùng `await`, loading/disabled khi gửi, catch lỗi HTTP.
- Dùng `id` UUID làm key/URL; hiển thị `ticketCode` thay chỗ FE đang hiển thị `request.id`.
- Đổi type `serial`, `expiresAt` sang nullable; xử lý thêm coverage chưa xác định/không được bảo hành.
- Ưu tiên `canRequest` từ backend thay cho chỉ tự tính ngày ở FE.
- Không ghép `warrantyRequests` mẫu vào tài khoản thật; bỏ localStorage/session Map cho bảo hành.
- Không dùng `ownerId: null` để nhận diện hồ sơ mẫu. API có thể trả null cho phiếu cũ
  không gắn tài khoản; user không xem được các phiếu không có chủ sở hữu này.
- Bỏ nhãn/thông báo "minh họa", "mã đơn mẫu", "chỉ lưu trình duyệt" sau khi chuyển sang API.
- `storage` event không đồng bộ với backend. Refresh khi mở trang, sau submit/update,
  khi quay lại tab hoặc polling nếu cần; hiện chưa có WebSocket/SSE.
- Không đổi luồng tư vấn linh kiện trong cùng file service; phần đó chưa thuộc API bảo hành.

## 10. Dữ liệu cũ và triển khai backend

Migration mới: `1793145600000-AddWarrantyWorkflow.ts`.

- Thêm `warranty_products`: hồ sơ theo từng thiết bị, ngày bắt đầu/hết hạn, serial.
- Thêm `warranty_events`: lịch sử trạng thái và ghi chú.
- Thêm `warranty_tickets.warrantyProductId` nullable và unique index cho phiếu đang xử lý.
- Giữ nguyên các field/liên kết cũ của phiếu; không xóa dữ liệu cũ.
- Phiếu trước migration được thêm một sự kiện ghi nhận trạng thái đang biết tại `updatedAt`.
  Không dựng giả các mốc received/checking/repairing đã qua.
- Phiếu cũ chưa được gắn thiết bị cụ thể có `productId: null` trong response,
  nhưng vẫn có `catalogProductId`, `product.name` và thông tin đơn/serial đã lưu.
  User xem được nếu phiếu có `userId` của mình; admin vẫn xem và xử lý được.
- Không tự ánh xạ phiếu cũ vào thiết bị mới đăng ký vì có thể một đơn mua nhiều thiết bị cùng loại.

Chạy ở backend sau khi cấu hình kết nối DB:

```sh
npm run migration:run
npm run build
npm run start:prod
```

Kiểm thử:

```sh
npm test -- --runInBand
npm run test:warranties
```

`test:warranties` cần PostgreSQL và quyền CREATE DATABASE. Script tạo database tạm
`be_study_warranty_test_<random>`, chạy migration và API HTTP với guard thật,
sau đó xóa chính database tạm đó. Không chạy migration trên database ứng dụng.
Migration bảo hành không tự rollback vì có dữ liệu bàn giao và lịch sử xử lý;
khi cần phục hồi phải dùng backup đã xác minh.
