/**
 * MBR Job Service - Monthly Business Report Builder
 * Pure computation service - does NOT modify the database
 * DB persistence is handled by the legacy cron (monthly-report.cron.ts)
 */

import { MbrBuilderService } from "./mbr-builder.service";
import { MbrV1 } from "@shared/mbr-types";

export class MbrJobService {
  /**
   * Build mbr_v1 JSON for a user (pure computation, no DB writes)
   * @returns The mbr_v1 JSON object
   */
  static async buildMbrForUser(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    tenantId?: string
  ): Promise<MbrV1> {
    console.log(`[MbrJob] Building mbr_v1 for user ${userId}...`);
    const mbr = await MbrBuilderService.build(userId, periodStart, periodEnd, tenantId);
    console.log(`[MbrJob] mbr_v1 built successfully for user ${userId}`);
    return mbr;
  }
}
