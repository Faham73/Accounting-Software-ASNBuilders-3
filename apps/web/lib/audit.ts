import { NextRequest } from 'next/server';
import { prisma } from '@accounting/db';

export type EntityType = 'ACCOUNT' | 'VOUCHER' | 'VOUCHER_LINE' | 'User' | 'Credit' | 'ProjectInvestment' | 'ProjectLabor' | 'Purchase' | 'StockItem' | 'StockMovement';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'STATUS_CHANGE' | 'REVERSE' | 'USER_ACTIVATE' | 'USER_DEACTIVATE' | 'USER_RESET_PASSWORD' | 'LOGIN' | 'LOGIN_SUCCESS' | 'LOGIN_FAILURE';

interface CreateAuditLogParams {
  companyId?: string;
  actorUserId?: string;
  entityType?: EntityType;
  entityId?: string;
  action: AuditAction;
  metadata?: any;
  before?: any;
  after?: any;
  diffJson?: any;
  request?: NextRequest;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog({
  companyId,
  actorUserId,
  entityType,
  entityId,
  action,
  metadata,
  before,
  after,
  diffJson,
  request,
}: CreateAuditLogParams) {
  // Extract metadata from request if available
  const metaJson = request
    ? {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        url: request.url,
        ...(metadata || {}),
      }
    : metadata || null;

  await prisma.auditLog.create({
    data: {
      companyId: companyId ?? null,
      actorUserId: actorUserId ?? null,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      action,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      before: before ? JSON.parse(JSON.stringify(before)) : null,
      after: after ? JSON.parse(JSON.stringify(after)) : null,
      diffJson: diffJson ? JSON.parse(JSON.stringify(diffJson)) : null,
      metaJson: metaJson ? JSON.parse(JSON.stringify(metaJson)) : null,
    },
  });
}
