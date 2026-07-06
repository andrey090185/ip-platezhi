import { db } from '../schema'
import type { Employee } from '@/types'

export const employeeRepo = {
  async getAll(ipId: number): Promise<Employee[]> {
    return db.employees.where('ipId').equals(ipId).toArray()
  },

  async getActive(ipId: number): Promise<Employee[]> {
    return db.employees.where({ ipId, status: 'active' }).toArray()
  },

  async getById(id: number): Promise<Employee | undefined> {
    return db.employees.get(id)
  },

  async add(emp: Omit<Employee, 'id'>): Promise<number> {
    return db.employees.add(emp as Employee)
  },

  async update(id: number, changes: Partial<Employee>): Promise<void> {
    await db.employees.update(id, { ...changes, updatedAt: new Date().toISOString() })
  },

  async archive(id: number): Promise<void> {
    await db.employees.update(id, { status: 'archived', updatedAt: new Date().toISOString() })
  },

  async hasPayroll(employeeId: number): Promise<boolean> {
    const count = await db.payrollRecords.where('employeeId').equals(employeeId).count()
    return count > 0
  }
}
