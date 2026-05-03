import Dexie, { type Table } from 'dexie';

export interface Member {
  id?: number;
  name: string;
  phone: string;
  address: string;
  joinedAt: number;
}

export type LoanFrequency = 'weekly' | 'monthly';

export interface Loan {
  id?: number;
  memberId: number;
  principalAmount: number;
  interestRate: number; // percentage
  totalPayable: number;
  installmentAmount: number;
  numberOfInstallments: number;
  frequency: LoanFrequency;
  startDate: number;
  status: 'active' | 'completed' | 'overdue';
  description?: string;
}

export interface Installment {
  id?: number;
  loanId: number;
  dueDate: number;
  amount: number;
  paidDate?: number;
  status: 'pending' | 'paid' | 'overdue';
}

export class SomityDatabase extends Dexie {
  members!: Table<Member>;
  loans!: Table<Loan>;
  installments!: Table<Installment>;

  constructor() {
    super('SomityDB');
    this.version(1).stores({
      members: '++id, name, phone',
      loans: '++id, memberId, status, startDate',
      installments: '++id, loanId, dueDate, status'
    });
  }
}

export const db = new SomityDatabase();
