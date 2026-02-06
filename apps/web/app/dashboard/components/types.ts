export interface Project {
  id: string;
  name: string;
  clientName?: string | null;
  clientContact?: string | null;
  siteLocation?: string | null;
  startDate?: string | Date | null;
  expectedEndDate?: string | Date | null;
  contractValue?: number | null;
  status: 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'CLOSED';
  assignedManager?: string | null;
  isActive: boolean;
  // New fields
  address?: string | null;
  projectManager?: string | null;
  projectEngineer?: string | null;
  companySiteName?: string | null;
  reference?: string | null;
  isMain?: boolean;
  parentProjectId?: string | null;
  parentProject?: { id: string; name: string } | null;
  budgetTotal?: number | null;
  // Computed fields
  entriesCount?: number;
  filesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'CASH' | 'BANK' | 'CHEQUE' | 'MOBILE';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
