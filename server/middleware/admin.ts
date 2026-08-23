import { Request, Response, NextFunction } from 'express';

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  const ownerEmail = process.env.OWNER_EMAIL;
  // req.user only has id + organizationId; email is on the full JWT payload (req.token)
  const tokenEmail = (req as any).token?.email;
  if (!ownerEmail || !tokenEmail || tokenEmail !== ownerEmail) {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}
