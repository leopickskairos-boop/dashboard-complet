import { ExternalConnection, ExternalCustomer, ExternalOrder, ExternalTransaction } from "@shared/schema";

export interface SyncResult {
  success: boolean;
  customersImported: number;
  ordersImported: number;
  transactionsImported: number;
  errors: string[];
  lastSyncedAt: Date;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  accountInfo?: {
    name?: string;
    email?: string;
    plan?: string;
    id?: string;
  };
}

export interface CustomerData {
  externalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  totalSpent?: string;
  orderCount?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface OrderData {
  externalId: string;
  customerId?: string;
  customerExternalId?: string;
  totalAmount: string;
  currency?: string;
  status?: string;
  orderDate: Date;
  items?: Array<{
    name: string;
    quantity: number;
    price: string;
    sku?: string;
  }>;
  shippingAddress?: string;
  billingAddress?: string;
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionData {
  externalId: string;
  orderId?: string;
  customerExternalId?: string;
  amount: string;
  currency?: string;
  fee?: string;
  netAmount?: string;
  transactionType: 'payment' | 'refund' | 'fee' | 'payout' | 'adjustment';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transactionDate: Date;
  paymentMethod?: string;
  paymentGateway?: string;
  gatewayTransactionId?: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseIntegrationAdapter {
  protected connection: ExternalConnection;
  protected credentials: {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    instanceUrl?: string;
  };

  constructor(connection: ExternalConnection, decryptedCredentials: {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    instanceUrl?: string;
  }) {
    this.connection = connection;
    this.credentials = decryptedCredentials;
  }

  abstract testConnection(): Promise<TestConnectionResult>;
  
  abstract fetchCustomers(since?: Date): Promise<CustomerData[]>;
  
  abstract fetchOrders(since?: Date): Promise<OrderData[]>;
  
  abstract fetchTransactions(since?: Date): Promise<TransactionData[]>;

  async sync(since?: Date): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      customersImported: 0,
      ordersImported: 0,
      transactionsImported: 0,
      errors: [],
      lastSyncedAt: new Date()
    };

    try {
      const customers = await this.fetchCustomers(since);
      result.customersImported = customers.length;
    } catch (error) {
      result.errors.push(`Customers: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const orders = await this.fetchOrders(since);
      result.ordersImported = orders.length;
    } catch (error) {
      result.errors.push(`Orders: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const transactions = await this.fetchTransactions(since);
      result.transactionsImported = transactions.length;
    } catch (error) {
      result.errors.push(`Transactions: ${error instanceof Error ? error.message : String(error)}`);
    }

    result.success = result.errors.length === 0;
    return result;
  }
}
