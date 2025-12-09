import { ExternalConnection } from "@shared/schema";
import { BaseIntegrationAdapter } from "./adapters/base-adapter";
import { HubSpotAdapter } from "./adapters/hubspot-adapter";
import { StripeIntegrationAdapter } from "./adapters/stripe-adapter";

export type SupportedProvider = 'hubspot' | 'stripe' | 'salesforce' | 'zoho' | 'pipedrive' | 'monday';

export function createAdapter(
  connection: ExternalConnection,
  decryptedCredentials: {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    instanceUrl?: string;
  }
): BaseIntegrationAdapter {
  const provider = connection.provider.toLowerCase();

  switch (provider) {
    case 'hubspot':
      return new HubSpotAdapter(connection, decryptedCredentials);
    
    case 'stripe':
    case 'stripe_integration':
      return new StripeIntegrationAdapter(connection, decryptedCredentials);
    
    case 'salesforce':
      throw new Error("Salesforce adapter coming soon - requires OAuth configuration");
    
    case 'zoho':
      throw new Error("Zoho adapter coming soon - requires OAuth configuration");
    
    case 'pipedrive':
      throw new Error("Pipedrive adapter coming soon");
    
    case 'monday':
      throw new Error("Monday.com adapter coming soon");
    
    default:
      throw new Error(`Provider non supporté: ${provider}`);
  }
}

export function isProviderSupported(provider: string): boolean {
  const supported = ['hubspot', 'stripe', 'stripe_integration'];
  return supported.includes(provider.toLowerCase());
}

export function getSupportedProviders(): Array<{
  id: string;
  name: string;
  category: string;
  authType: 'api_key' | 'oauth' | 'both';
  status: 'active' | 'coming_soon';
}> {
  return [
    { id: 'stripe', name: 'Stripe', category: 'payment', authType: 'api_key', status: 'active' },
    { id: 'hubspot', name: 'HubSpot', category: 'crm', authType: 'both', status: 'active' },
    { id: 'salesforce', name: 'Salesforce', category: 'crm', authType: 'oauth', status: 'coming_soon' },
    { id: 'zoho', name: 'Zoho CRM', category: 'crm', authType: 'oauth', status: 'coming_soon' },
    { id: 'pipedrive', name: 'Pipedrive', category: 'crm', authType: 'api_key', status: 'coming_soon' },
    { id: 'monday', name: 'Monday.com', category: 'crm', authType: 'api_key', status: 'coming_soon' },
  ];
}
