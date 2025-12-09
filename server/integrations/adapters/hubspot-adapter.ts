import { BaseIntegrationAdapter, TestConnectionResult, CustomerData, OrderData, TransactionData } from "./base-adapter";

export class HubSpotAdapter extends BaseIntegrationAdapter {
  private baseUrl = "https://api.hubapi.com";

  private isOAuthToken(): boolean {
    return !!this.credentials.accessToken;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    let url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.isOAuthToken()) {
      headers["Authorization"] = `Bearer ${this.credentials.accessToken}`;
    } else if (this.credentials.apiKey) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}hapikey=${this.credentials.apiKey}`;
    }

    return fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers as Record<string, string> },
    });
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const response = await this.makeRequest("/account-info/v3/details");
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `Échec de connexion HubSpot: ${error.message || response.statusText}`
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        message: "Connexion HubSpot réussie",
        accountInfo: {
          name: data.portalId?.toString() || data.accountName,
          id: data.portalId?.toString(),
          plan: data.accountType
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Erreur de connexion: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async fetchCustomers(since?: Date): Promise<CustomerData[]> {
    const customers: CustomerData[] = [];
    
    try {
      if (since) {
        await this.fetchCustomersIncremental(customers, since);
      } else {
        await this.fetchCustomersFull(customers);
      }
      return customers;
    } catch (error) {
      console.error("HubSpot fetchCustomers error:", error);
      throw error;
    }
  }

  private async fetchCustomersFull(customers: CustomerData[]): Promise<void> {
    let after: string | undefined;
    
    do {
      const params = new URLSearchParams({
        limit: "100",
        properties: "email,firstname,lastname,phone,company,address,city,country,hs_object_id,createdate,lastmodifieddate"
      });
      
      if (after) {
        params.append("after", after);
      }

      const response = await this.makeRequest(`/crm/v3/objects/contacts?${params}`);
      
      if (!response.ok) {
        throw new Error(`HubSpot API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      for (const contact of data.results || []) {
        customers.push(this.mapContact(contact));
      }

      after = data.paging?.next?.after;
    } while (after);
  }

  private async fetchCustomersIncremental(customers: CustomerData[], since: Date): Promise<void> {
    let after: string | undefined;
    
    do {
      const searchBody = {
        filterGroups: [{
          filters: [{
            propertyName: "lastmodifieddate",
            operator: "GTE",
            value: since.getTime().toString()
          }]
        }],
        properties: ["email", "firstname", "lastname", "phone", "company", "address", "city", "country", "hs_object_id", "createdate", "lastmodifieddate"],
        limit: 100,
        after: after
      };

      const response = await this.makeRequest("/crm/v3/objects/contacts/search", {
        method: "POST",
        body: JSON.stringify(searchBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("HubSpot contacts search error:", errorText);
        throw new Error(`HubSpot search API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      for (const contact of data.results || []) {
        customers.push(this.mapContact(contact));
      }

      after = data.paging?.next?.after;
    } while (after);
  }

  private mapContact(contact: Record<string, unknown>): CustomerData {
    const props = contact.properties as Record<string, string> || {};
    return {
      externalId: contact.id as string,
      email: props.email || "",
      firstName: props.firstname,
      lastName: props.lastname,
      phone: props.phone,
      company: props.company,
      address: props.address,
      city: props.city,
      country: props.country,
      metadata: props
    };
  }

  async fetchOrders(since?: Date): Promise<OrderData[]> {
    const orders: OrderData[] = [];
    
    try {
      if (since) {
        await this.fetchOrdersIncremental(orders, since);
      } else {
        await this.fetchOrdersFull(orders);
      }
      return orders;
    } catch (error) {
      console.error("HubSpot fetchOrders error:", error);
      throw error;
    }
  }

  private async fetchOrdersFull(orders: OrderData[]): Promise<void> {
    let after: string | undefined;
    
    do {
      const params = new URLSearchParams({
        limit: "100",
        properties: "hs_object_id,amount,dealname,dealstage,closedate,pipeline,hs_lastmodifieddate"
      });
      
      if (after) {
        params.append("after", after);
      }

      const response = await this.makeRequest(`/crm/v3/objects/deals?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("HubSpot deals error:", errorText);
        break;
      }

      const data = await response.json();
      
      for (const deal of data.results || []) {
        orders.push(this.mapDeal(deal));
      }

      after = data.paging?.next?.after;
    } while (after);
  }

  private async fetchOrdersIncremental(orders: OrderData[], since: Date): Promise<void> {
    let after: string | undefined;
    
    do {
      const searchBody = {
        filterGroups: [{
          filters: [{
            propertyName: "hs_lastmodifieddate",
            operator: "GTE",
            value: since.getTime().toString()
          }]
        }],
        properties: ["hs_object_id", "amount", "dealname", "dealstage", "closedate", "pipeline", "hs_lastmodifieddate"],
        limit: 100,
        after: after
      };

      const response = await this.makeRequest("/crm/v3/objects/deals/search", {
        method: "POST",
        body: JSON.stringify(searchBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("HubSpot deals search error:", errorText);
        throw new Error(`HubSpot deals search API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      for (const deal of data.results || []) {
        orders.push(this.mapDeal(deal));
      }

      after = data.paging?.next?.after;
    } while (after);
  }

  private mapDeal(deal: Record<string, unknown>): OrderData {
    const props = deal.properties as Record<string, string> || {};
    return {
      externalId: deal.id as string,
      totalAmount: props.amount || "0",
      currency: "EUR",
      status: props.dealstage || "unknown",
      orderDate: new Date(props.closedate || (deal as Record<string, string>).createdAt),
      metadata: {
        dealName: props.dealname,
        pipeline: props.pipeline,
        ...props
      }
    };
  }

  async fetchTransactions(since?: Date): Promise<TransactionData[]> {
    return [];
  }
}
