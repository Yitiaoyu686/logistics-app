import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const message = String(err?.message || 'Internal Server Error');
  const explicitStatus = Number(err?.statusCode || err?.status || 0);
  const errorCode = String(err?.code || '');
  const isConstraint = errorCode === 'SQLITE_CONSTRAINT';
  const looksLikeClientError = /(invalid|not found|already|missing|required|不存在|无效|缺少|不能为空|已存在|已装载|请选择|请输入)/i.test(message);
  const statusCode = explicitStatus > 0 ? explicitStatus : (isConstraint ? 409 : (looksLikeClientError ? 400 : 500));

  console.error(`[API ERROR] ${_req.method} ${_req.originalUrl}`);
  console.error('Status:', statusCode, 'Code:', errorCode || '-', 'Message:', message);
  if (err?.stack) {
    console.error('Stack:', err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    code: errorCode || undefined,
  });
}
