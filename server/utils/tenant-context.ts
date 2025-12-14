/**
 * Tenant Context Utilities
 * 
 * Phase 2 Multi-Tenant: Helper functions for resolving and working with tenant context
 * This file provides utilities for backward-compatible tenant resolution.
 */

import { storage } from '../storage';
import { Request } from 'express';

export interface TenantContext {
  tenantId: string | null;
  userId: string | null;
  agentId: string | null;
}

/**
 * Extract tenant context from Express request
 * Checks multiple sources in priority order:
 * 1. req.tenant (set by tenant-resolver middleware)
 * 2. req.user (authenticated user)
 * 3. Request params/body (agentId, agent_id)
 */
export function extractTenantContext(req: Request): TenantContext {
  const context: TenantContext = {
    tenantId: null,
    userId: null,
    agentId: null,
  };

  // From tenant middleware
  if ((req as any).tenant?.id) {
    context.tenantId = (req as any).tenant.id;
  }

  // From authenticated user
  if (req.user?.id) {
    context.userId = req.user.id;
  }

  // From request params or body (N8N webhooks)
  const agentId = req.params.agent_id || req.params.agentId || 
                  req.body?.agent_id || req.body?.agentId;
  if (agentId) {
    context.agentId = agentId;
  }

  return context;
}

/**
 * Resolve effective tenant ID from context
 * Uses storage.getEffectiveTenantId for resolution
 */
export async function resolveEffectiveTenantId(context: TenantContext): Promise<string | null> {
  return storage.getEffectiveTenantId({
    tenantId: context.tenantId,
    agentId: context.agentId,
    userId: context.userId,
  });
}

/**
 * Build query filter for dual-key lookup
 * Returns filter conditions that work with both old (userId) and new (tenantId) data
 */
export function buildDualKeyFilter(context: TenantContext): {
  userId?: string;
  tenantId?: string;
} {
  const filter: { userId?: string; tenantId?: string } = {};
  
  if (context.tenantId) {
    filter.tenantId = context.tenantId;
  }
  if (context.userId) {
    filter.userId = context.userId;
  }
  
  return filter;
}

/**
 * Middleware helper to require tenant context
 * Throws if no valid tenant context can be resolved
 */
export async function requireTenantContext(req: Request): Promise<{
  tenantId: string;
  userId: string | null;
}> {
  const context = extractTenantContext(req);
  const effectiveTenantId = await resolveEffectiveTenantId(context);
  
  if (!effectiveTenantId) {
    throw new Error('Tenant context required but not found');
  }
  
  return {
    tenantId: effectiveTenantId,
    userId: context.userId,
  };
}

/**
 * Get data owner context - returns either tenantId OR userId for query filtering
 * During migration period, data may have only userId (old) or tenantId (new)
 */
export async function getDataOwnerContext(req: Request): Promise<{
  useBy: 'tenantId' | 'userId';
  id: string;
}> {
  const context = extractTenantContext(req);
  const effectiveTenantId = await resolveEffectiveTenantId(context);
  
  if (effectiveTenantId) {
    return { useBy: 'tenantId', id: effectiveTenantId };
  }
  
  if (context.userId) {
    return { useBy: 'userId', id: context.userId };
  }
  
  throw new Error('No valid data owner context found');
}
