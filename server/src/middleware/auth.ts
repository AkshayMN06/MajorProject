import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token format' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      
      if (!user) {
        res.status(401).json({ success: false, error: 'Unauthorized: User not found' });
        return;
      }
      
      req.user = user;
      next();
    } catch (err) {
      res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
      return;
    }
  } catch (error) {
    next(error);
  }
};
