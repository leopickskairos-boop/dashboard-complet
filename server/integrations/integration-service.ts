import { storage } from "../storage";
import { createAdapter, isProviderSupported } from "./adapter-factory";
import { TestConnectionResult, SyncResult, CustomerData, OrderData, TransactionData } from "./adapters/base-adapter";

export class IntegrationService {
  
  async testConnection(connectionId: string, userId: string): Promise<TestConnectionResult> {
    const connection = await storage.getExternalConnectionWithCredentials(connectionId, userId);
    
    if (!connection) {
      return { success: false, message: "Connexion non trouvée" };
    }

    if (!isProviderSupported(connection.provider)) {
      return { success: false, message: `Provider ${connection.provider} non supporté pour le moment` };
    }

    const decrypted = {
      apiKey: connection.apiKey || undefined,
      apiSecret: connection.apiSecret || undefined,
      accessToken: connection.accessToken || undefined,
      refreshToken: connection.refreshToken || undefined,
      instanceUrl: connection.instanceUrl || undefined
    };

    const adapter = createAdapter(connection, decrypted);
    return adapter.testConnection();
  }

  async testCredentials(
    provider: string, 
    credentials: { apiKey?: string; apiSecret?: string; instanceUrl?: string }
  ): Promise<TestConnectionResult> {
    if (!isProviderSupported(provider)) {
      return { success: false, message: `Provider ${provider} non supporté pour le moment` };
    }

    const mockConnection = {
      id: 'test',
      userId: 'test',
      provider,
      name: 'Test Connection',
      authType: 'api_key',
      status: 'pending',
      syncEnabled: false,
      syncFrequency: 'daily',
      enabledEntities: [] as string[],
      lastSyncAt: null,
      lastError: null,
      connectedAt: null,
      createdAt: new Date(),
      description: null,
      instanceUrl: credentials.instanceUrl || null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      apiKey: null,
      apiSecret: null,
      accountId: null,
      metadata: null
    };

    const decrypted = {
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      instanceUrl: credentials.instanceUrl
    };

    const adapter = createAdapter(mockConnection, decrypted);
    return adapter.testConnection();
  }

  async syncConnection(connectionId: string, userId: string, fullSync: boolean = false): Promise<SyncResult> {
    const connection = await storage.getExternalConnectionWithCredentials(connectionId, userId);
    
    if (!connection) {
      return {
        success: false,
        customersImported: 0,
        ordersImported: 0,
        transactionsImported: 0,
        errors: ["Connexion non trouvée"],
        lastSyncedAt: new Date()
      };
    }

    if (!isProviderSupported(connection.provider)) {
      return {
        success: false,
        customersImported: 0,
        ordersImported: 0,
        transactionsImported: 0,
        errors: [`Provider ${connection.provider} non supporté pour le moment`],
        lastSyncedAt: new Date()
      };
    }

    const syncJob = await storage.createSyncJob({
      userId,
      connectionId,
      jobType: fullSync ? 'full' : 'incremental',
      status: 'running',
      startedAt: new Date()
    });

    try {
      const decrypted = {
        apiKey: connection.apiKey || undefined,
        apiSecret: connection.apiSecret || undefined,
        accessToken: connection.accessToken || undefined,
        refreshToken: connection.refreshToken || undefined,
        instanceUrl: connection.instanceUrl || undefined
      };

      const adapter = createAdapter(connection, decrypted);
      
      const since = fullSync ? undefined : connection.lastSyncAt || undefined;
      
      const result: SyncResult = {
        success: true,
        customersImported: 0,
        ordersImported: 0,
        transactionsImported: 0,
        errors: [],
        lastSyncedAt: new Date()
      };

      try {
        const customers = await adapter.fetchCustomers(since);
        for (const customer of customers) {
          await this.upsertCustomer(userId, connection.provider, customer);
          result.customersImported++;
        }
      } catch (error) {
        result.errors.push(`Customers: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        const orders = await adapter.fetchOrders(since);
        for (const order of orders) {
          await this.upsertOrder(userId, connection.provider, order);
          result.ordersImported++;
        }
      } catch (error) {
        result.errors.push(`Orders: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        const transactions = await adapter.fetchTransactions(since);
        for (const transaction of transactions) {
          await this.upsertTransaction(userId, connection.provider, transaction);
          result.transactionsImported++;
        }
      } catch (error) {
        result.errors.push(`Transactions: ${error instanceof Error ? error.message : String(error)}`);
      }

      result.success = result.errors.length === 0;

      await storage.updateSyncJob(syncJob.id, {
        status: result.success ? 'completed' : 'completed_with_errors',
        completedAt: new Date(),
        processedRecords: result.customersImported + result.ordersImported + result.transactionsImported,
        createdRecords: result.customersImported + result.ordersImported + result.transactionsImported,
        errors: result.errors.length > 0 ? result.errors : null
      });

      await storage.updateExternalConnection(connectionId, userId, {
        lastSyncAt: new Date(),
        status: result.success ? 'active' : 'error',
        lastError: result.errors.length > 0 ? result.errors.join('; ') : null
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await storage.updateSyncJob(syncJob.id, {
        status: 'failed',
        completedAt: new Date(),
        errors: [errorMessage]
      });

      await storage.updateExternalConnection(connectionId, userId, {
        status: 'error',
        lastError: errorMessage
      });

      return {
        success: false,
        customersImported: 0,
        ordersImported: 0,
        transactionsImported: 0,
        errors: [errorMessage],
        lastSyncedAt: new Date()
      };
    }
  }

  private async upsertCustomer(userId: string, source: string, data: CustomerData): Promise<void> {
    const existing = await storage.getExternalCustomerByExternalId(userId, data.externalId, source);
    
    if (existing) {
      await storage.updateExternalCustomer(existing.id, userId, {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        companyName: data.company,
        address: data.address,
        city: data.city,
        country: data.country,
        totalSpent: data.totalSpent,
        totalOrders: data.orderCount
      });
    } else {
      await storage.createExternalCustomer({
        userId,
        externalId: data.externalId,
        externalSource: source,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        companyName: data.company,
        address: data.address,
        city: data.city,
        country: data.country,
        totalSpent: data.totalSpent,
        totalOrders: data.orderCount
      });
    }
  }

  private async upsertOrder(userId: string, source: string, data: OrderData): Promise<void> {
    const existing = await storage.getExternalOrderByExternalId(userId, data.externalId, source);
    
    let customerId: string | undefined;
    if (data.customerExternalId) {
      const customer = await storage.getExternalCustomerByExternalId(userId, data.customerExternalId, source);
      customerId = customer?.id;
    }

    const orderData = {
      totalAmount: data.totalAmount,
      currency: data.currency || 'EUR',
      status: data.status || 'unknown',
      orderDate: data.orderDate,
      items: data.items,
      shippingAddress: data.shippingAddress,
      billingAddress: data.billingAddress,
      paymentMethod: data.paymentMethod,
      customerId
    };

    if (existing) {
      await storage.updateExternalOrder(existing.id, userId, orderData);
    } else {
      await storage.createExternalOrder({
        userId,
        externalId: data.externalId,
        externalSource: source,
        ...orderData
      });
    }
  }

  private async upsertTransaction(userId: string, source: string, data: TransactionData): Promise<void> {
    let customerId: string | undefined;
    if (data.customerExternalId) {
      const customer = await storage.getExternalCustomerByExternalId(userId, data.customerExternalId, source);
      customerId = customer?.id;
    }

    let orderId: string | undefined;
    if (data.orderId) {
      const order = await storage.getExternalOrderByExternalId(userId, data.orderId, source);
      orderId = order?.id;
    }

    await storage.createExternalTransaction({
      userId,
      externalId: data.externalId,
      externalSource: source,
      customerId,
      orderId,
      amount: data.amount,
      currency: data.currency || 'EUR',
      fee: data.fee,
      netAmount: data.netAmount,
      transactionType: data.transactionType,
      status: data.status,
      transactionDate: data.transactionDate,
      paymentMethod: data.paymentMethod,
      paymentProvider: data.paymentGateway,
      paymentReference: data.gatewayTransactionId
    });
  }

  async syncAllConnections(userId: string): Promise<{ synced: number; errors: string[] }> {
    const connections = await storage.getExternalConnections(userId);
    const activeConnections = connections.filter(c => c.status === 'active');
    
    let synced = 0;
    const errors: string[] = [];

    for (const connection of activeConnections) {
      try {
        const result = await this.syncConnection(connection.id, userId, false);
        if (result.success) {
          synced++;
        } else {
          errors.push(`${connection.name}: ${result.errors.join(', ')}`);
        }
      } catch (error) {
        errors.push(`${connection.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { synced, errors };
  }
}

export const integrationService = new IntegrationService();
