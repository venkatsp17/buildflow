const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export type User = {
  id: number;
  email: string;
  role: string;
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

export function signup(email: string, password: string, role: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
  });
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
  urgency: string;
  value: number;
  currency: string;
  dueDate: string;
  createdById: number;
  createdBy?: User;
  assigneeId?: number;
  assignee?: User;
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

export function listOrders(token: string): Promise<{ orders: Order[] }> {
  return request<{ orders: Order[] }>('/orders', {
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
  items: { productName: string; description?: string; quantity: number; unit: string; unitPrice?: number }[];
};

export function createOrder(token: string, input: CreateOrderInput): Promise<{ order: Order }> {
  return request<{ order: Order }>('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
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
