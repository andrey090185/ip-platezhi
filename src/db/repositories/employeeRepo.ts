import { db } from '../schema'
import type { Employee } from '@/types'
import { syncAdd, syncUpdate, syncDelete } from '@/firebase/syncManager'

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

  async add(emp: Omit<Employee, 'id'>, userId?: string): Promise<number> {
    const id = await db.employees.add(emp as Employee)
    if (userId) await syncAdd(userId, db.employees, id as number, { ...emp, id })
    return id
  },

  async update(id: number, changes: Partial<Employee>, userId?: string): Promise<void> {
    await db.employees.update(id, { ...changes, updatedAt: new Date().toISOString() })
    if (userId) await syncUpdate(userId, db.employees, id, { ...changes, id })
  },

  async archive(id: number, userId?: string): Promise<void> {
    await db.employees.update(id, { status: 'archived', updatedAt: new Date().toISOString() })
    if (userId) await syncUpdate(userId, db.employees, id, { id, status: 'archived' })
  },

  async hasPayroll(employeeId: number): Promise<boolean> {
    const count = await db.payrollRecords.where('employeeId').equals(employeeId).count()
    return count > 0
  }
}
