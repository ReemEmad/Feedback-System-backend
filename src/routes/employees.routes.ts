import { Router, Request, Response } from 'express';
import { query, run, get } from '../config/database';
import collaborationTracker from '../services/collaboration-tracker';
import peerRanker from '../services/peer-ranker';

const router = Router();

/**
 * Get all employees
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const employees = await query('SELECT * FROM employees ORDER BY name ASC');
    res.json(employees);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get employee by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const employeeId = parseInt(req.params.id);
    const employee = await get('SELECT * FROM employees WHERE id = ?', [employeeId]);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get employee's peer rankings
 */
router.get('/:id/rankings', async (req: Request, res: Response) => {
  try {
    const employeeId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 10;
    const rankings = await peerRanker.getRankedPeers(employeeId, limit);
    res.json(rankings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get employee's collaboration data
 */
router.get('/:id/collaborations', async (req: Request, res: Response) => {
  try {
    const employeeId = parseInt(req.params.id);
    const collaborations = await collaborationTracker.getCollaborations(employeeId);
    res.json(collaborations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get employee's direct reports (if manager)
 */
router.get('/:id/reports', async (req: Request, res: Response) => {
  try {
    const managerId = parseInt(req.params.id);
    const reports = await query('SELECT * FROM employees WHERE manager_id = ?', [managerId]);
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Seed sample employees (for demo)
 */
router.post('/seed', async (req: Request, res: Response) => {
  try {
    const sampleEmployees = [
      // Engineering Team
      { email: 'john.doe@company.com', name: 'John Doe', department: 'Engineering', role: 'Senior Developer', is_manager: 0 },
      { email: 'jane.smith@company.com', name: 'Jane Smith', department: 'Engineering', role: 'Developer', is_manager: 0 },
      { email: 'bob.johnson@company.com', name: 'Bob Johnson', department: 'Engineering', role: 'Tech Lead', is_manager: 1 },
      { email: 'diana.prince@company.com', name: 'Diana Prince', department: 'Engineering', role: 'QA Engineer', is_manager: 0 },
      { email: 'mike.chen@company.com', name: 'Mike Chen', department: 'Engineering', role: 'Frontend Developer', is_manager: 0 },
      { email: 'sarah.williams@company.com', name: 'Sarah Williams', department: 'Engineering', role: 'Backend Developer', is_manager: 0 },
      { email: 'alex.rodriguez@company.com', name: 'Alex Rodriguez', department: 'Engineering', role: 'DevOps Engineer', is_manager: 0 },
      { email: 'emma.davis@company.com', name: 'Emma Davis', department: 'Engineering', role: 'Mobile Developer', is_manager: 0 },
      { email: 'kevin.lee@company.com', name: 'Kevin Lee', department: 'Engineering', role: 'Senior QA Engineer', is_manager: 0 },
      { email: 'lisa.martinez@company.com', name: 'Lisa Martinez', department: 'Engineering', role: 'Data Engineer', is_manager: 0 },
      
      // Product Team
      { email: 'olivia.thompson@company.com', name: 'Olivia Thompson', department: 'Product', role: 'Product Manager', is_manager: 1 },
      { email: 'james.anderson@company.com', name: 'James Anderson', department: 'Product', role: 'Product Owner', is_manager: 0 },
      { email: 'sophia.garcia@company.com', name: 'Sophia Garcia', department: 'Product', role: 'Product Owner', is_manager: 0 },
      { email: 'noah.wilson@company.com', name: 'Noah Wilson', department: 'Product', role: 'Business Analyst', is_manager: 0 },
      { email: 'ava.taylor@company.com', name: 'Ava Taylor', department: 'Product', role: 'Scrum Master', is_manager: 0 },
      
      // Design Team
      { email: 'emily.brown@company.com', name: 'Emily Brown', department: 'Design', role: 'UX Designer', is_manager: 0 },
      { email: 'daniel.miller@company.com', name: 'Daniel Miller', department: 'Design', role: 'UI Designer', is_manager: 0 },
      { email: 'mia.moore@company.com', name: 'Mia Moore', department: 'Design', role: 'Lead Designer', is_manager: 1 },
      { email: 'william.jackson@company.com', name: 'William Jackson', department: 'Design', role: 'UX Researcher', is_manager: 0 },
      
      // Data & Analytics
      { email: 'isabella.white@company.com', name: 'Isabella White', department: 'Data', role: 'Data Analyst', is_manager: 0 },
      { email: 'ethan.harris@company.com', name: 'Ethan Harris', department: 'Data', role: 'Data Scientist', is_manager: 0 },
      { email: 'charlotte.clark@company.com', name: 'Charlotte Clark', department: 'Data', role: 'Analytics Manager', is_manager: 1 },
      
      // Marketing Team
      { email: 'alice.brown@company.com', name: 'Alice Brown', department: 'Marketing', role: 'Marketing Manager', is_manager: 1 },
      { email: 'evan.peters@company.com', name: 'Evan Peters', department: 'Marketing', role: 'Content Writer', is_manager: 0 },
      { email: 'sophia.martin@company.com', name: 'Sophia Martin', department: 'Marketing', role: 'SEO Specialist', is_manager: 0 },
      { email: 'liam.thompson@company.com', name: 'Liam Thompson', department: 'Marketing', role: 'Social Media Manager', is_manager: 0 },
      
      // Sales Team
      { email: 'charlie.wilson@company.com', name: 'Charlie Wilson', department: 'Sales', role: 'Sales Rep', is_manager: 0 },
      { email: 'fiona.green@company.com', name: 'Fiona Green', department: 'Sales', role: 'Sales Manager', is_manager: 1 },
      { email: 'oliver.king@company.com', name: 'Oliver King', department: 'Sales', role: 'Account Executive', is_manager: 0 },
      { email: 'amelia.scott@company.com', name: 'Amelia Scott', department: 'Sales', role: 'Sales Engineer', is_manager: 0 },
    ];

    for (const emp of sampleEmployees) {
      await run(
        `INSERT OR IGNORE INTO employees (email, name, department, role, is_manager)
         VALUES (?, ?, ?, ?, ?)`,
        [emp.email, emp.name, emp.department, emp.role, emp.is_manager]
      );
    }

    // Set manager relationships
    const bob = await get('SELECT id FROM employees WHERE email = ?', ['bob.johnson@company.com']);
    if (bob) {
      await run('UPDATE employees SET manager_id = ? WHERE email IN (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        bob.id,
        'john.doe@company.com',
        'jane.smith@company.com',
        'diana.prince@company.com',
        'mike.chen@company.com',
        'sarah.williams@company.com',
        'alex.rodriguez@company.com',
        'emma.davis@company.com',
        'kevin.lee@company.com',
        'lisa.martinez@company.com',
      ]);
    }

    const olivia = await get('SELECT id FROM employees WHERE email = ?', ['olivia.thompson@company.com']);
    if (olivia) {
      await run('UPDATE employees SET manager_id = ? WHERE email IN (?, ?, ?, ?)', [
        olivia.id,
        'james.anderson@company.com',
        'sophia.garcia@company.com',
        'noah.wilson@company.com',
        'ava.taylor@company.com',
      ]);
    }

    const mia = await get('SELECT id FROM employees WHERE email = ?', ['mia.moore@company.com']);
    if (mia) {
      await run('UPDATE employees SET manager_id = ? WHERE email IN (?, ?, ?)', [
        mia.id,
        'emily.brown@company.com',
        'daniel.miller@company.com',
        'william.jackson@company.com',
      ]);
    }

    const charlotte = await get('SELECT id FROM employees WHERE email = ?', ['charlotte.clark@company.com']);
    if (charlotte) {
      await run('UPDATE employees SET manager_id = ? WHERE email IN (?, ?)', [
        charlotte.id,
        'isabella.white@company.com',
        'ethan.harris@company.com',
      ]);
    }

    const alice = await get('SELECT id FROM employees WHERE email = ?', ['alice.brown@company.com']);
    if (alice) {
      await run('UPDATE employees SET manager_id = ? WHERE email IN (?, ?, ?)', [
        alice.id,
        'evan.peters@company.com',
        'sophia.martin@company.com',
        'liam.thompson@company.com',
      ]);
    }

    const fiona = await get('SELECT id FROM employees WHERE email = ?', ['fiona.green@company.com']);
    if (fiona) {
      await run('UPDATE employees SET manager_id = ? WHERE email IN (?, ?, ?)', [
        fiona.id,
        'charlie.wilson@company.com',
        'oliver.king@company.com',
        'amelia.scott@company.com',
      ]);
    }

    res.json({ 
      message: 'Sample employees created successfully', 
      count: sampleEmployees.length,
      departments: {
        Engineering: 10,
        Product: 5,
        Design: 4,
        Data: 3,
        Marketing: 4,
        Sales: 4
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

