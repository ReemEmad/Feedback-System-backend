import { Router, Request, Response } from 'express';
import { query, get } from '../config/database';
import jwt from 'jsonwebtoken';

const router = Router();

/**
 * Simple authentication for demo purposes
 * In production, this would integrate with Azure AD
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find employee by email
    const employee = await get('SELECT * FROM employees WHERE email = ?', [email]);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: employee.id,
        email: employee.email,
        is_manager: employee.is_manager,
      },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      employee: {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        department: employee.department,
        role: employee.role,
        is_manager: employee.is_manager,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current user info
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    const employee = await get('SELECT * FROM employees WHERE id = ?', [decoded.id]);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({
      id: employee.id,
      email: employee.email,
      name: employee.name,
      department: employee.department,
      role: employee.role,
      is_manager: employee.is_manager,
      manager_id: employee.manager_id,
    });
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;

