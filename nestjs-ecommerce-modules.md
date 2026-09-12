# NestJS Modules — Computer Parts E-commerce

## 1. Mục tiêu

Tài liệu này là điểm bắt đầu để xây dựng các module backend cho website bán linh kiện máy tính bằng **NestJS**.

Thiết kế hiện tại sử dụng `Order` để đại diện cho cả:

- Giỏ hàng (`AddingItem`)
- Đơn hàng đang xử lý (`Processing`)
- Đang chuẩn bị hàng (`Preparing`)
- Đang giao hàng (`Shipping`)
- Hoàn tất (`Done`)

Không tạo bảng `Cart` riêng.

---

## 2. Kiến trúc module đề xuất

```text
src/
├── app.module.ts
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── guards/
│   ├── strategies/
│   └── dto/
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── entities/
│   └── dto/
│
├── products/
│   ├── products.module.ts
│   ├── products.controller.ts
│   ├── products.service.ts
│   ├── entities/
│   └── dto/
│
├── categories/
│   ├── categories.module.ts
│   ├── categories.controller.ts
│   ├── categories.service.ts
│   ├── entities/
│   └── dto/
│
├── orders/
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   ├── entities/
│   │   ├── order.entity.ts
│   │   └── order-item.entity.ts
│   ├── dto/
│   └── enums/
│       └── order-status.enum.ts
│
└── common/
    ├── decorators/
    ├── guards/
    ├── filters/
    ├── interceptors/
    └── pipes/
```

> Cấu trúc trên là khung đề xuất. Có thể điều chỉnh theo ORM và kiến trúc hiện tại của project.

---

# 3. Các module chính

## 3.1 Auth Module

### Trách nhiệm

- Đăng nhập
- Xác thực user
- JWT
- Hash/verify password
- Phân quyền theo `role`

### API dự kiến

| Method | Endpoint | Mục đích |
|---|---|---|
| POST | `/auth/login` | Đăng nhập |
| POST | `/auth/register` | Đăng ký |
| GET | `/auth/me` | Lấy user hiện tại |

---

## 3.2 Users Module

### Trách nhiệm

- Quản lý thông tin user
- Xem/cập nhật profile
- Quản lý role

API sẽ được bổ sung theo nghiệp vụ admin.

---

## 3.3 Products Module

### Trách nhiệm

- Danh sách sản phẩm
- Chi tiết sản phẩm
- Tìm kiếm
- Lọc theo category
- Tạo/sửa/xóa sản phẩm
- Quản lý giá

### API dự kiến

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/products` | Danh sách sản phẩm |
| GET | `/products/:id` | Chi tiết |
| POST | `/products` | Tạo sản phẩm |
| PATCH | `/products/:id` | Cập nhật |
| DELETE | `/products/:id` | Xóa |

---

## 3.4 Categories Module

Quản lý:

- `category_parent`
- `category`

Quan hệ:

```text
CategoryParent 1 ─── N Category
Category 1 ─── N Product
```

---

# 4. Orders Module — module quan trọng nhất

Orders module quản lý cả **Cart và Order**.

## 4.1 Order Status

Tạo enum:

```ts
export enum OrderStatus {
  ADDING_ITEM = 'AddingItem',
  PROCESSING = 'Processing',
  PREPARING = 'Preparing',
  SHIPPING = 'Shipping',
  DONE = 'Done',
}
```

> Tên enum trong code dùng `UPPER_SNAKE_CASE`, còn giá trị lưu DB giữ đúng business status.

---

# 5. Cart nghiệp vụ

Không có `CartEntity`.

Một `Order` có:

```text
status = AddingItem
```

thì được xem là **Cart đang hoạt động**.

## 5.1 Lấy Cart hiện tại

Business rule:

> Mỗi user về mặt nghiệp vụ chỉ nên có một Cart đang hoạt động. Nếu database tồn tại nhiều Order có `AddingItem`, lấy record mới nhất.

Query logic:

```sql
SELECT *
FROM orders
WHERE user_id = ?
  AND status = 'AddingItem'
ORDER BY created_at DESC, id DESC
LIMIT 1;
```

Service nên có method:

```ts
findActiveCart(userId: number)
```

---

# 6. Cart API

## 6.1 Xem giỏ hàng

```http
GET /orders/cart
```

Flow:

```text
Request
  ↓
Authenticated User
  ↓
findActiveCart(userId)
  ↓
Load OrderItems
  ↓
Load Products
  ↓
Return cart
```

Nếu không có `AddingItem`:

```text
return empty cart
```

Không nhất thiết phải tạo Order ngay khi user mở trang cart.

---

## 6.2 Thêm sản phẩm

```http
POST /orders/cart/items
```

Request:

```json
{
  "productId": 1,
  "quantity": 2
}
```

Flow:

```text
Validate product
      ↓
Validate quantity
      ↓
Find latest AddingItem
      ↓
 ┌───────────────┐
 │               │
Có              Không
 │               │
 ↓               ↓
Reuse          Create Order
Order          status=AddingItem
 │               │
 └───────┬───────┘
         ↓
Find OrderItem
         ↓
 ┌───────────────┐
 │               │
Có              Không
 │               │
 ↓               ↓
quantity += N   Create item
         │
         ↓
Recalculate total
         │
         ↓
Save
```

Method:

```ts
addItem(userId: number, dto: AddCartItemDto)
```

---

## 6.3 Cập nhật số lượng

```http
PATCH /orders/cart/items/:itemId
```

Request:

```json
{
  "quantity": 3
}
```

Business rules:

- `quantity > 0`
- OrderItem phải thuộc Cart của user hiện tại
- Product phải còn tồn tại
- Kiểm tra tồn kho nếu project đã có inventory

---

## 6.4 Xóa sản phẩm

```http
DELETE /orders/cart/items/:itemId
```

Flow:

```text
Find active cart
      ↓
Find item
      ↓
Verify ownership
      ↓
Delete item
      ↓
Recalculate total_price
```

---

## 6.5 Xóa toàn bộ giỏ

```http
DELETE /orders/cart
```

Xóa toàn bộ `OrderItem` thuộc Order có:

```text
status = AddingItem
```

Có thể giữ lại Order rỗng hoặc xóa Order rỗng tùy business rule.

Khuyến nghị:

> Xóa Order rỗng để database không sinh quá nhiều record `AddingItem` không có item.

---

# 7. Tính total_price

`Order.total_price` là tổng tiền hiện tại của các OrderItem.

Công thức:

```text
total_price =
SUM(order_item.quantity * order_item.unit_price)
```

Tạo service method:

```ts
recalculateTotal(orderId: number)
```

Quan trọng:

- Không tin `total_price` từ request client.
- Backend luôn tự tính lại.
- Mọi thao tác thêm/sửa/xóa item phải recalculate.

---

# 8. Checkout

Endpoint:

```http
POST /orders/checkout
```

Flow:

```text
Get latest AddingItem
        ↓
Check cart not empty
        ↓
Validate products
        ↓
Validate quantity
        ↓
Check inventory
        ↓
Get current product price
        ↓
Snapshot unit_price
        ↓
Calculate total_price
        ↓
Change status
AddingItem → Processing
        ↓
Commit transaction
```

### Giá sản phẩm

Khuyến nghị:

> Chỉ chốt `unit_price` khi checkout.

Ví dụ:

```text
Product.price = 8.000.000

Cart:
quantity = 2

Checkout:
OrderItem.unit_price = 8.000.000
Order.total_price = 16.000.000
```

Nếu sau đó Product tăng giá lên 9.000.000, Order cũ vẫn giữ:

```text
unit_price = 8.000.000
```

---

# 9. Transaction khi Checkout

Checkout phải chạy trong **database transaction**.

Pseudo-code:

```ts
await transaction(async (manager) => {
  const order = await getActiveCart(userId, manager);

  validateOrder(order);

  for (const item of order.items) {
    const product = await getProduct(item.productId, manager);

    validateStock(product, item.quantity);

    item.unitPrice = product.price;
    await manager.save(item);
  }

  order.totalPrice = calculateTotal(order.items);
  order.status = OrderStatus.PROCESSING;

  await manager.save(order);
});
```

Mục tiêu:

> Hoặc toàn bộ checkout thành công, hoặc không thay đổi dữ liệu.

---

# 10. Order lifecycle

```text
AddingItem
    │
    │ Checkout
    ▼
Processing
    │
    │ Admin xác nhận / bắt đầu xử lý
    ▼
Preparing
    │
    │ Đã giao cho đơn vị vận chuyển
    ▼
Shipping
    │
    │ Giao thành công
    ▼
Done
```

## Transition rules

| Current | Allowed next |
|---|---|
| AddingItem | Processing |
| Processing | Preparing |
| Preparing | Shipping |
| Shipping | Done |
| Done | Không chuyển |

Không cho phép:

```text
Done → Processing
Shipping → AddingItem
Preparing → Done
```

trừ khi sau này bạn bổ sung nghiệp vụ đặc biệt như hủy đơn/hoàn hàng.

---

# 11. Order API

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/orders` | Danh sách đơn của user |
| GET | `/orders/:id` | Chi tiết đơn |
| POST | `/orders/checkout` | Checkout cart |
| PATCH | `/orders/:id/status` | Cập nhật trạng thái |
| GET | `/admin/orders` | Admin xem đơn |
| PATCH | `/admin/orders/:id/status` | Admin cập nhật trạng thái |

---

# 12. Ownership / Authorization

Một user chỉ được thao tác trên Order của chính mình.

Ví dụ:

```text
User A
  └── Order #1001

User B
  └── Order #1002
```

User B không được:

```http
PATCH /orders/1001/items/5
```

Backend phải kiểm tra:

```text
order.user_id === currentUser.id
```

Không chỉ dựa vào frontend.

---

# 13. Database Entity Relationship

```text
USER
 │
 │ 1:N
 ▼
ORDER
 │
 │ 1:N
 ▼
ORDER_ITEM
 │
 │ N:1
 ▼
PRODUCT
```

`ORDER.status` quyết định Order đang đóng vai trò gì:

```text
AddingItem  → Cart
Processing  → Order
Preparing   → Order
Shipping    → Order
Done        → Order
```

---

# 14. Index và constraint nên có

Đối với `order`:

```text
INDEX(user_id)
INDEX(user_id, status, created_at)
```

Đối với `order_item`:

```text
INDEX(order_id)
INDEX(product_id)
UNIQUE(order_id, product_id)
```

`UNIQUE(order_id, product_id)` đảm bảo:

```text
❌ Order #100
   Product #1 × 1
   Product #1 × 2

✅ Order #100
   Product #1 × 3
```

---

# 15. Race condition khi tạo AddingItem

Có thể xảy ra:

```text
Request A ──┐
            ├── Không tìm thấy AddingItem
Request B ──┘
            │
            ▼
       Cả hai tạo Order
```

Kết quả:

```text
User #3
├── Order #1001 AddingItem
└── Order #1002 AddingItem
```

Business rule vẫn xử lý bằng:

```sql
ORDER BY created_at DESC, id DESC
LIMIT 1
```

nhưng về lâu dài nên xử lý race condition bằng transaction/locking hoặc database-specific partial/functional unique constraint nếu DB hỗ trợ.

---

# 16. DTO dự kiến

## AddCartItemDto

```ts
export class AddCartItemDto {
  productId: number;
  quantity: number;
}
```

## UpdateCartItemDto

```ts
export class UpdateCartItemDto {
  quantity: number;
}
```

## UpdateOrderStatusDto

```ts
export class UpdateOrderStatusDto {
  status: OrderStatus;
}
```

---

# 17. Service structure

`OrdersService` có thể bắt đầu với:

```ts
class OrdersService {
  // Cart
  findActiveCart(userId: number);

  addItem(userId: number, dto: AddCartItemDto);

  updateCartItem(
    userId: number,
    itemId: number,
    dto: UpdateCartItemDto,
  );

  removeCartItem(userId: number, itemId: number);

  clearCart(userId: number);

  // Checkout
  checkout(userId: number);

  // Orders
  findUserOrders(userId: number);

  findOrderById(userId: number, orderId: number);

  updateOrderStatus(orderId: number, status: OrderStatus);

  // Calculation
  recalculateTotal(orderId: number);
}
```

---

# 18. Thứ tự triển khai

Nên triển khai theo thứ tự:

```text
Phase 1
├── Database connection
├── User
├── Product
└── Category

Phase 2
├── Order entity
├── OrderItem entity
├── OrderStatus enum
└── Relations

Phase 3
├── findActiveCart()
├── GET /orders/cart
├── POST /orders/cart/items
├── PATCH /orders/cart/items/:id
├── DELETE /orders/cart/items/:id
└── DELETE /orders/cart

Phase 4
├── Checkout
├── Transaction
├── Snapshot unit_price
├── Calculate total
└── AddingItem → Processing

Phase 5
├── Order management
├── Status transition
├── Admin APIs
└── Authorization

Phase 6
├── Inventory
├── Payment
├── Shipping
└── Order cancellation / refund
```

---

# 19. Definition of Done — Cart

Cart module được xem là hoàn thành khi:

- [ ] User có thể xem cart hiện tại.
- [ ] Cart được biểu diễn bằng `Order.status = AddingItem`.
- [ ] Có thể thêm product.
- [ ] Thêm cùng product sẽ tăng quantity thay vì tạo item mới.
- [ ] Có thể cập nhật quantity.
- [ ] Có thể xóa item.
- [ ] Có thể clear cart.
- [ ] `total_price` được backend tự tính.
- [ ] User không thể thao tác cart của user khác.
- [ ] Nếu có nhiều `AddingItem`, lấy record mới nhất.
- [ ] Checkout chuyển `AddingItem → Processing`.
- [ ] Checkout sử dụng transaction.
- [ ] Giá được snapshot vào `OrderItem.unit_price`.
- [ ] Không nhận `total_price` từ client.
- [ ] Không cho checkout cart rỗng.

---

# 20. Quy ước cần thống nhất trước khi code

Trước khi bắt đầu implement, cần xác định:

1. ORM đang sử dụng: **TypeORM / Prisma / Sequelize**.
2. Database: **PostgreSQL / MySQL / SQL Server / ...**
3. Authentication: JWT hay session.
4. Password hashing: bcrypt/argon2.
5. Có inventory/stock ngay từ version đầu hay chưa.
6. Có payment ngay trong version đầu hay chưa.
7. Có cancellation/refund hay chưa.

Sau khi xác định các điểm trên, có thể bắt đầu implement từ `OrdersModule`, vì đây là module bao phủ cả nghiệp vụ **Cart → Checkout → Order**.
