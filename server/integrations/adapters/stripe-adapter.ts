import { BaseIntegrationAdapter, TestConnectionResult, CustomerData, OrderData, TransactionData } from "./base-adapter";
import Stripe from "stripe";

export class StripeIntegrationAdapter extends BaseIntegrationAdapter {
  private stripe: Stripe | null = null;

  private getStripeClient(): Stripe {
    if (!this.stripe) {
      const apiKey = this.credentials.apiKey || this.credentials.accessToken;
      if (!apiKey) {
        throw new Error("Stripe API key not configured");
      }
      this.stripe = new Stripe(apiKey);
    }
    return this.stripe;
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const stripe = this.getStripeClient();
      const account = await stripe.accounts.retrieve();
      
      return {
        success: true,
        message: "Connexion Stripe réussie",
        accountInfo: {
          name: account.business_profile?.name || account.settings?.dashboard?.display_name || "Compte Stripe",
          email: account.email || undefined,
          id: account.id,
          plan: account.type
        }
      };
    } catch (error) {
      const message = error instanceof Stripe.errors.StripeError 
        ? error.message 
        : (error instanceof Error ? error.message : String(error));
      
      return {
        success: false,
        message: `Échec de connexion Stripe: ${message}`
      };
    }
  }

  async fetchCustomers(since?: Date): Promise<CustomerData[]> {
    const customers: CustomerData[] = [];
    const stripe = this.getStripeClient();
    
    try {
      const params: Stripe.CustomerListParams = {
        limit: 100,
      };
      
      if (since) {
        params.created = { gte: Math.floor(since.getTime() / 1000) };
      }

      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const response = await stripe.customers.list(params);
        
        for (const customer of response.data) {
          const address = customer.address;
          
          customers.push({
            externalId: customer.id,
            email: customer.email || "",
            firstName: customer.name?.split(" ")[0],
            lastName: customer.name?.split(" ").slice(1).join(" "),
            phone: customer.phone || undefined,
            address: address ? `${address.line1 || ""} ${address.line2 || ""}`.trim() : undefined,
            city: address?.city || undefined,
            country: address?.country || undefined,
            metadata: customer.metadata as Record<string, unknown>
          });
        }

        hasMore = response.has_more;
        if (response.data.length > 0) {
          startingAfter = response.data[response.data.length - 1].id;
        } else {
          hasMore = false;
        }
      }

      return customers;
    } catch (error) {
      console.error("Stripe fetchCustomers error:", error);
      throw error;
    }
  }

  async fetchOrders(since?: Date): Promise<OrderData[]> {
    const orders: OrderData[] = [];
    const stripe = this.getStripeClient();
    
    try {
      const params: Stripe.PaymentIntentListParams = {
        limit: 100,
      };
      
      if (since) {
        params.created = { gte: Math.floor(since.getTime() / 1000) };
      }

      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const response = await stripe.paymentIntents.list(params);
        
        for (const pi of response.data) {
          if (pi.status !== "succeeded") continue;
          
          orders.push({
            externalId: pi.id,
            customerExternalId: typeof pi.customer === 'string' ? pi.customer : pi.customer?.id,
            totalAmount: (pi.amount / 100).toFixed(2),
            currency: pi.currency.toUpperCase(),
            status: pi.status,
            orderDate: new Date(pi.created * 1000),
            paymentMethod: typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.type,
            metadata: pi.metadata as Record<string, unknown>
          });
        }

        hasMore = response.has_more;
        if (response.data.length > 0) {
          startingAfter = response.data[response.data.length - 1].id;
        } else {
          hasMore = false;
        }
      }

      return orders;
    } catch (error) {
      console.error("Stripe fetchOrders error:", error);
      throw error;
    }
  }

  async fetchTransactions(since?: Date): Promise<TransactionData[]> {
    const transactions: TransactionData[] = [];
    const stripe = this.getStripeClient();
    
    try {
      const params: Stripe.ChargeListParams = {
        limit: 100,
      };
      
      if (since) {
        params.created = { gte: Math.floor(since.getTime() / 1000) };
      }

      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const response = await stripe.charges.list(params);
        
        for (const charge of response.data) {
          const fee = charge.balance_transaction 
            ? (typeof charge.balance_transaction === 'string' ? 0 : (charge.balance_transaction.fee || 0) / 100)
            : 0;
          
          transactions.push({
            externalId: charge.id,
            customerExternalId: typeof charge.customer === 'string' ? charge.customer : charge.customer?.id,
            amount: (charge.amount / 100).toFixed(2),
            currency: charge.currency.toUpperCase(),
            fee: fee.toFixed(2),
            netAmount: ((charge.amount / 100) - fee).toFixed(2),
            transactionType: charge.refunded ? 'refund' : 'payment',
            status: charge.status === 'succeeded' ? 'completed' : 
                   charge.status === 'pending' ? 'pending' : 
                   charge.status === 'failed' ? 'failed' : 'pending',
            transactionDate: new Date(charge.created * 1000),
            paymentMethod: charge.payment_method_details?.type || 'card',
            paymentGateway: 'stripe',
            gatewayTransactionId: charge.id,
            metadata: charge.metadata as Record<string, unknown>
          });
        }

        hasMore = response.has_more;
        if (response.data.length > 0) {
          startingAfter = response.data[response.data.length - 1].id;
        } else {
          hasMore = false;
        }
      }

      const refundParams: Stripe.RefundListParams = {
        limit: 100,
      };
      
      if (since) {
        refundParams.created = { gte: Math.floor(since.getTime() / 1000) };
      }

      hasMore = true;
      startingAfter = undefined;

      while (hasMore) {
        if (startingAfter) {
          refundParams.starting_after = startingAfter;
        }

        const response = await stripe.refunds.list(refundParams);
        
        for (const refund of response.data) {
          transactions.push({
            externalId: refund.id,
            amount: `-${(refund.amount / 100).toFixed(2)}`,
            currency: refund.currency.toUpperCase(),
            fee: "0.00",
            netAmount: `-${(refund.amount / 100).toFixed(2)}`,
            transactionType: 'refund',
            status: refund.status === 'succeeded' ? 'completed' : 
                   refund.status === 'pending' ? 'pending' : 
                   refund.status === 'failed' ? 'failed' : 'pending',
            transactionDate: new Date(refund.created * 1000),
            paymentGateway: 'stripe',
            gatewayTransactionId: refund.id,
            metadata: refund.metadata as Record<string, unknown>
          });
        }

        hasMore = response.has_more;
        if (response.data.length > 0) {
          startingAfter = response.data[response.data.length - 1].id;
        } else {
          hasMore = false;
        }
      }

      return transactions;
    } catch (error) {
      console.error("Stripe fetchTransactions error:", error);
      throw error;
    }
  }
}
