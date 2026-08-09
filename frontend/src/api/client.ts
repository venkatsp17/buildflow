const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export type User = {
  id: number;
  email: string;
  role: string;
  active: boolean;
  priceListId?: number;
  createdAt: string;
  updatedAt: string;
};

type AuthResponse = { token: string; user: User };

// Registered by AuthContext so a 401 on any authenticated call can trigger an
// automatic logout, without api/client.ts needing to import React context.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const hadAuthHeader = !!(options.headers as Record<string, string> | undefined)?.Authorization;
    if (response.status === 401 && hadAuthHeader) {
      onUnauthorized?.();
    }
    throw new Error(body.error ?? `Request failed with status ${response.status}`);
  }

  return body as T;
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function me(token: string): Promise<{ user: User }> {
  return request<{ user: User }>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type OrderItem = {
  id: number;
  orderId: number;
  productId?: number;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type Order = {
  id: number;
  ticketNumber: string;
  customerId?: number;
  clientName: string;
  city: string;
  address: string;
  latitude?: number;
  longitude?: number;
  priceListName: string;
  status: string;
  rejectionReason?: string;
  urgency: string;
  value: number;
  currency: string;
  dueDate: string;
  createdById: number;
  createdBy?: User;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
};

export type Product = {
  id: number;
  name: string;
  unit: string;
  description: string;
  unitPrice?: number;
};

export type GeocodeResult = {
  displayName: string;
  city: string;
  latitude: number;
  longitude: number;
};

export function searchCustomers(token: string, search: string): Promise<{ customers: Customer[] }> {
  return request<{ customers: Customer[] }>(`/customers?search=${encodeURIComponent(search)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function searchProducts(token: string, search: string): Promise<{ products: Product[] }> {
  return request<{ products: Product[] }>(`/products?search=${encodeURIComponent(search)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function searchGeocode(token: string, query: string): Promise<{ results: GeocodeResult[] }> {
  return request<{ results: GeocodeResult[] }>(`/geocode/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type OrderSummary = {
  totalValue: number;
  currency: string;
  total: number;
  active: number;
  pending: number;
  urgent: number;
};

export type OrderSort = 'newest' | 'oldest' | 'due_asc' | 'due_desc' | 'value_asc' | 'value_desc';

export type ListOrdersParams = {
  search?: string;
  status?: string;
  customerId?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: OrderSort;
  limit?: number;
  offset?: number;
};

// Search, filtering, sorting, and paging all happen in the backend query,
// not in the frontend, so the order list stays fast and bounded as history
// grows — the response's `total` tells the caller how much more is left to
// page through via `offset`.
export function listOrders(token: string, params: ListOrdersParams = {}): Promise<{ orders: Order[]; total: number }> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.customerId) query.set('customerId', String(params.customerId));
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.sort) query.set('sort', params.sort);
  query.set('limit', String(params.limit ?? 20));
  query.set('offset', String(params.offset ?? 0));
  return request<{ orders: Order[]; total: number }>(`/orders?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Sales home's priority queue: urgent orders (capped at 5, soonest due date
// first), then all high-urgency orders, computed server-side.
export function getPriorityOrders(token: string): Promise<{ orders: Order[] }> {
  return request<{ orders: Order[] }>('/orders/priority', {
    headers: { Authorization: `Bearer ${token}` },
  });
}


export function getOrder(token: string, id: number | string): Promise<{ order: Order }> {
  return request<{ order: Order }>(`/orders/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getOrderSummary(token: string): Promise<OrderSummary> {
  return request<OrderSummary>('/orders/summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type RegionRevenue = {
  region: string;
  orders: number;
  revenue: number;
};

export type ManagerDashboard = {
  currency: string;
  totalValue: number;
  totalOrders: number;
  regionCount: number;
  inProgress: number;
  delayed: number;
  dispatchReady: number;
  completed: number;
  rejected: number;
  revenueByRegion: RegionRevenue[];
  // Mon..Sun order counts for the current calendar week.
  weeklyOrders: number[];
};

export function getManagerDashboard(token: string): Promise<ManagerDashboard> {
  return request<ManagerDashboard>('/orders/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type CreateOrderInput = {
  clientName: string;
  city: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  priceListName: string;
  urgency: string;
  currency?: string;
  dueDate: string;
  items: { productName: string; description?: string; quantity: number; unit: string }[];
};

export function createOrder(token: string, input: CreateOrderInput): Promise<{ order: Order }> {
  return request<{ order: Order }>('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function updateOrderStatus(
  token: string,
  id: number | string,
  status: string,
  reason?: string,
): Promise<{ order: Order }> {
  return request<{ order: Order }>(`/orders/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, reason }),
  });
}

export type NotificationType = 'order_approved' | 'order_rejected' | 'dispatch_ready' | 'order_delayed';

export type Notification = {
  id: number;
  userId: number;
  orderId: number;
  order?: Order;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function listNotifications(token: string): Promise<{ notifications: Notification[]; unreadCount: number }> {
  return request<{ notifications: Notification[]; unreadCount: number }>('/notifications', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function markNotificationRead(token: string, id: number): Promise<void> {
  return request<void>(`/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function deleteNotification(token: string, id: number): Promise<void> {
  return request<void>(`/notifications/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function clearAllNotifications(token: string): Promise<void> {
  return request<void>('/notifications', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function registerPushToken(token: string, pushToken: string): Promise<void> {
  return request<void>('/push-tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: pushToken }),
  });
}

export function unregisterPushToken(token: string, pushToken: string): Promise<void> {
  return request<void>('/push-tokens', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: pushToken }),
  });
}

export type PriceListItemDetail = {
  id: number;
  priceListId: number;
  productId: number;
  product?: Product;
  unitPrice: number;
};

export type PriceList = {
  id: number;
  name: string;
  createdById: number;
  items: PriceListItemDetail[];
  createdAt: string;
  updatedAt: string;
};

export type PriceListInput = {
  name: string;
  items: { productId: number; unitPrice: number }[];
};

export function listPriceLists(token: string): Promise<{ priceLists: PriceList[] }> {
  return request<{ priceLists: PriceList[] }>('/price-lists', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getPriceList(token: string, id: number | string): Promise<{ priceList: PriceList; assignedUsers: User[] }> {
  return request<{ priceList: PriceList; assignedUsers: User[] }>(`/price-lists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createPriceList(token: string, input: PriceListInput): Promise<{ priceList: PriceList }> {
  return request<{ priceList: PriceList }>('/price-lists', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function updatePriceList(
  token: string,
  id: number | string,
  input: PriceListInput,
): Promise<{ priceList: PriceList }> {
  return request<{ priceList: PriceList }>(`/price-lists/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function listUsers(token: string, role?: string): Promise<{ users: User[] }> {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  return request<{ users: User[] }>(`/users${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type CreateUserInput = {
  email: string;
  password: string;
  role: string;
};

// There's no public signup — a manager provisions every account directly.
export function createUser(token: string, input: CreateUserInput): Promise<{ user: User }> {
  return request<{ user: User }>('/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function setUserActive(token: string, userId: number, active: boolean): Promise<{ user: User }> {
  return request<{ user: User }>(`/users/${userId}/active`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ active }),
  });
}

export function assignPriceList(
  token: string,
  userId: number,
  priceListId: number | null,
): Promise<{ user: User }> {
  return request<{ user: User }>(`/users/${userId}/price-list`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ priceListId }),
  });
}
